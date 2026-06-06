import { config } from '../lib/config.js'

const INTENT = {
  PURCHASE: 'purchase_intent',
  QUESTION: 'question',
  COMPLAINT: 'complaint',
  SPAM: 'spam',
  GENERAL: 'general'
}

const STOPWORDS = new Set([
  'the',
  'this',
  'that',
  'with',
  'for',
  'and',
  'you',
  'your',
  'have',
  'will',
  'there',
  'later',
  'does',
  'come',
  'using',
  'still',
  'need',
  'want',
  'where',
  'what',
  'when',
  'is',
  'it',
  'a',
  'an',
  'to',
  'in',
  'of',
  'on'
])

const PRODUCT_ALIASES = {
  serum: ['glow serum', 'hyaluronic', 'serum'],
  lip: ['lipstick', 'lip stick', 'lip tint', 'tint', 'rosewood', 'rhode'],
  spf: ['sunscreen', 'spf50', 'spf', 'white cast'],
  shirt: ['linen shirt', 'shirt', 'sand', 'size'],
  clip: ['hair clip', 'claw clip', 'clip']
}

const DEBRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'executiveSummary',
    'productDemand',
    'unansweredQuestions',
    'warmLeads',
    'topObjections',
    'discountImpact',
    'nextActions'
  ],
  properties: {
    executiveSummary: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'bullets'],
      properties: {
        headline: { type: 'string' },
        bullets: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    productDemand: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['productId', 'name', 'demandScore', 'mentions', 'purchaseSignals', 'questions', 'recommendedAction'],
        properties: {
          productId: { type: 'string' },
          name: { type: 'string' },
          demandScore: { type: 'number' },
          mentions: { type: 'number' },
          purchaseSignals: { type: 'number' },
          questions: { type: 'number' },
          recommendedAction: { type: 'string' }
        }
      }
    },
    unansweredQuestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['buyerId', 'buyerUsername', 'productId', 'productName', 'question', 'priority', 'suggestedFollowUp'],
        properties: {
          buyerId: { type: 'string' },
          buyerUsername: { type: 'string' },
          productId: { type: 'string' },
          productName: { type: 'string' },
          question: { type: 'string' },
          priority: { type: 'number' },
          suggestedFollowUp: { type: 'string' }
        }
      }
    },
    warmLeads: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['buyerId', 'buyerUsername', 'productId', 'productName', 'message', 'suggestedAction'],
        properties: {
          buyerId: { type: 'string' },
          buyerUsername: { type: 'string' },
          productId: { type: 'string' },
          productName: { type: 'string' },
          message: { type: 'string' },
          suggestedAction: { type: 'string' }
        }
      }
    },
    topObjections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'count', 'example', 'recommendedFix'],
        properties: {
          topic: { type: 'string' },
          count: { type: 'number' },
          example: { type: 'string' },
          recommendedFix: { type: 'string' }
        }
      }
    },
    discountImpact: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['discountId', 'productId', 'productName', 'offer', 'signalBefore', 'signalAfter', 'takeaway'],
        properties: {
          discountId: { type: 'string' },
          productId: { type: 'string' },
          productName: { type: 'string' },
          offer: { type: 'string' },
          signalBefore: { type: 'number' },
          signalAfter: { type: 'number' },
          takeaway: { type: 'string' }
        }
      }
    },
    nextActions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['priority', 'action', 'reason', 'owner'],
        properties: {
          priority: { type: 'number' },
          action: { type: 'string' },
          reason: { type: 'string' },
          owner: { type: 'string' }
        }
      }
    }
  }
}

export async function generatePostLiveDebrief({
  conversationId,
  products = [],
  messages = [],
  discounts = [],
  useAi = true
}) {
  const analytics = buildDebriefAnalytics({
    conversationId,
    products,
    messages,
    discounts
  })

  if (!useAi || !config.openai.apiKey) {
    return {
      source: 'heuristic',
      model: null,
      generatedAt: new Date().toISOString(),
      ...analytics
    }
  }

  try {
    const aiDebrief = await refineDebriefWithOpenAI(analytics)
    const sanitizedDebrief = sanitizeDebrief(aiDebrief, analytics)
    return {
      source: 'openai',
      model: config.openai.debriefModel,
      generatedAt: new Date().toISOString(),
      totals: analytics.totals,
      ...sanitizedDebrief
    }
  } catch (error) {
    return {
      source: 'heuristic',
      model: null,
      generatedAt: new Date().toISOString(),
      warning: `OpenAI debrief failed, returned deterministic fallback: ${error.message}`,
      ...analytics
    }
  }
}

export function buildDebriefAnalytics({ conversationId, products, messages, discounts }) {
  const productById = new Map(products.map((product) => [getProductId(product), normalizeProduct(product)]))
  const normalizedMessages = messages
    .map((message) => normalizeMessage(message))
    .sort((a, b) => a.timestampMs - b.timestampMs)
  const normalizedDiscounts = discounts
    .map((discount) => normalizeDiscount(discount, productById))
    .sort((a, b) => a.startAt - b.startAt)

  const productStats = new Map()
  for (const product of productById.values()) {
    productStats.set(product.productId, {
      productId: product.productId,
      name: product.name,
      mentions: 0,
      purchaseSignals: 0,
      questions: 0,
      complaints: 0,
      demandScore: 0,
      sampleMessages: []
    })
  }

  const unansweredQuestions = []
  const warmLeads = []
  const objectionBuckets = new Map()

  for (const message of normalizedMessages) {
    const product = resolveProductForMessage(message, productById)
    const intent = classifyIntent(message)
    const productId = product?.productId ?? message.productId ?? 'unknown'
    const productName = product?.name ?? 'Unknown product'

    if (intent !== INTENT.SPAM && product) {
      const stats = productStats.get(product.productId)
      stats.mentions += 1
      if (intent === INTENT.PURCHASE) stats.purchaseSignals += 1
      if (intent === INTENT.QUESTION) stats.questions += 1
      if (intent === INTENT.COMPLAINT) stats.complaints += 1
      if (stats.sampleMessages.length < 3) stats.sampleMessages.push(message.messageText)
    }

    const objection = detectObjection(message.messageText)
    if (objection) {
      const current = objectionBuckets.get(objection.topic) ?? {
        topic: objection.topic,
        count: 0,
        example: message.messageText,
        recommendedFix: objection.recommendedFix
      }
      current.count += 1
      objectionBuckets.set(objection.topic, current)
    }

    if ((intent === INTENT.QUESTION || intent === INTENT.COMPLAINT) && !message.replySent) {
      unansweredQuestions.push({
        buyerId: message.buyerId,
        buyerUsername: message.buyerUsername,
        productId,
        productName,
        question: message.messageText,
        priority: scoreQuestionPriority(message.messageText, productId),
        suggestedFollowUp: buildSuggestedQuestionReply(message.messageText, productName, intent)
      })
    }

    if (intent === INTENT.PURCHASE && !message.converted) {
      warmLeads.push({
        buyerId: message.buyerId,
        buyerUsername: message.buyerUsername,
        productId,
        productName,
        message: message.messageText,
        suggestedAction: buildLeadAction(message.messageText, productName)
      })
    }
  }

  const productDemand = [...productStats.values()]
    .map((stats) => ({
      ...stats,
      demandScore: Math.min(100, (stats.mentions * 4) + (stats.questions * 8) + (stats.purchaseSignals * 16) + (stats.complaints * 10)),
      recommendedAction: buildProductAction(stats)
    }))
    .filter((stats) => stats.mentions > 0 || stats.purchaseSignals > 0 || stats.questions > 0)
    .sort((a, b) => b.demandScore - a.demandScore)

  const discountImpact = normalizedDiscounts.map((discount) => {
    const related = normalizedMessages.filter((message) => {
      const product = resolveProductForMessage(message, productById)
      return product?.productId === discount.productId || message.productId === discount.productId
    })
    const signalBefore = related.filter((message) =>
      classifyIntent(message) === INTENT.PURCHASE &&
      message.timestampMs < discount.startAt &&
      message.timestampMs >= discount.startAt - 10 * 60 * 1000
    ).length
    const signalAfter = related.filter((message) =>
      classifyIntent(message) === INTENT.PURCHASE &&
      message.timestampMs >= discount.startAt &&
      message.timestampMs <= discount.endAt
    ).length

    return {
      discountId: discount.discountId,
      productId: discount.productId,
      productName: discount.productName,
      offer: formatOffer(discount),
      signalBefore,
      signalAfter,
      takeaway: signalAfter > signalBefore
        ? 'The offer drove more purchase-intent messages after it was mentioned.'
        : 'The offer did not create a clear purchase-intent lift yet; repeat it or pin it more visibly.'
    }
  })

  const topObjections = [...objectionBuckets.values()].sort((a, b) => b.count - a.count)

  return {
    conversationId: conversationId ?? 'all-streams',
    totals: {
      products: products.length,
      messages: normalizedMessages.length,
      discounts: normalizedDiscounts.length,
      purchaseSignals: warmLeads.length,
      unansweredQuestions: unansweredQuestions.length,
      topObjections: topObjections.length
    },
    executiveSummary: buildExecutiveSummary({ productDemand, unansweredQuestions, warmLeads, topObjections, discountImpact }),
    productDemand,
    unansweredQuestions: unansweredQuestions.sort((a, b) => b.priority - a.priority).slice(0, 20),
    warmLeads: warmLeads.slice(0, 30),
    topObjections: topObjections.slice(0, 10),
    discountImpact,
    nextActions: buildNextActions({ productDemand, unansweredQuestions, warmLeads, topObjections, discountImpact })
  }
}

async function refineDebriefWithOpenAI(analytics) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.openai.debriefModel,
      store: false,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You are Tandem, an AI operations analyst for Shopee Live skincare and beauty sellers.',
                'Convert the computed stream analytics into a seller-facing post-live debrief of about 200 words.',
                'Do not invent metrics. Preserve product IDs, buyer IDs, counts, and table-ready structure.',
                'productDemand must include only products that already appear in the provided productDemand array.',
                'Do not add unknown products or infer new product rows; map buyer messages to an existing catalog product where possible.',
                'For each unansweredQuestions item, rewrite suggestedFollowUp as a specific seller action based on the buyer question and product context.',
                'Do not use generic service recovery or order-number language unless the buyer is reporting a past order issue, damage, leakage, refund, or delivery problem.',
                'For authenticity or fake-product concerns, suggest reassuring the buyer and sharing official listing, QR seal, batch, or verification proof.',
                'Focus on missed revenue, buyer follow-up, objection handling, and next-stream actions/improvements.'
              ].join(' ')
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(analytics)
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'post_live_debrief',
          strict: true,
          schema: DEBRIEF_SCHEMA
        }
      }
    })
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI request failed with ${response.status}`)
  }

  const text = payload.output_text ?? extractOutputText(payload)
  if (!text) {
    throw new Error('OpenAI response did not include output text')
  }

  return JSON.parse(text)
}

function extractOutputText(payload) {
  const output = payload.output ?? []
  const message = output.find((item) => item.type === 'message')
  const content = message?.content ?? []
  const text = content.find((item) => item.type === 'output_text')
  return text?.text ?? null
}

function normalizeProduct(product) {
  return {
    productId: getProductId(product),
    name: product.name ?? 'Unknown product',
    stockQty: Number(product.stockQty ?? 0),
    price: Number(product.price ?? 0),
    currency: product.currency ?? 'SGD',
    tags: product.tags ?? []
  }
}

function normalizeMessage(message) {
  const text = message.messageText ?? message.buyerMessage ?? message.message ?? ''
  return {
    messageId: message.messageId ?? '',
    conversationId: message.conversationId ?? '',
    messageTimestamp: message.messageTimestamp ?? message.createdAt ?? '',
    timestampMs: Date.parse(message.messageTimestamp ?? message.createdAt ?? '') || 0,
    buyerId: message.buyerId ?? '',
    buyerUsername: message.buyerUsername ?? message.buyer ?? '',
    messageText: text,
    productId: message.productId ?? message.product ?? null,
    aiCategory: message.aiCategory ?? '',
    aiResponse: message.aiResponse ?? '',
    replySent: Boolean(message.replySent || message.aiResponse),
    priority: Number(message.priority ?? 0),
    escalated: Boolean(message.escalated),
    converted: Boolean(message.converted || message.orderPlaced || message.conversionStatus === 'converted')
  }
}

function normalizeDiscount(discount, productById) {
  const productId = discount.productId ?? ''
  const product = productById.get(productId)
  const startAt = Number(discount.startAt ?? 0)
  const endAt = Number(discount.endAt ?? startAt)
  return {
    discountId: discount.discountId ?? '',
    productId,
    productName: product?.name ?? productId,
    valueAmount: Number(discount.valueAmount ?? discount.discountValueAmount ?? 0),
    valuePercent: Number(discount.valuePercent ?? discount.discountValuePercent ?? 0),
    startAt,
    endAt,
    sellerTranscript: discount.sellerTranscript ?? '',
    acceptedBySeller: Boolean(discount.acceptedBySeller)
  }
}

function classifyIntent(message) {
  const text = message.messageText.toLowerCase()
  const category = message.aiCategory.toLowerCase()

  if (category.includes('spam') || /(free phones|follow me|click here|crypto|scam)/i.test(text)) return INTENT.SPAM
  if (category.includes('complaint') || /(refund|fake|authentic|broken|late|leaking|angry|disappointed)/i.test(text)) return INTENT.COMPLAINT
  if (category.includes('purchase') || /(buy|checkout|cart|order|take|want|bundle|discount|deal|how much|stock|ship today)/i.test(text)) return INTENT.PURCHASE
  if (category.includes('question') || text.includes('?') || /\b(is|does|can|will|what|when|where|how|got)\b/i.test(text)) return INTENT.QUESTION
  return INTENT.GENERAL
}

function resolveProductForMessage(message, productById) {
  if (message.productId && productById.has(message.productId)) return productById.get(message.productId)

  const tokens = tokenize(message.messageText)
  const text = message.messageText.toLowerCase()
  let best = null
  let bestScore = 0

  for (const product of productById.values()) {
    const productTokens = tokenize(product.name)
    const score = productTokens.filter((token) => tokens.includes(token)).length
    const aliasScore = (PRODUCT_ALIASES[product.productId] ?? [])
      .reduce((total, alias) => total + (text.includes(alias) ? 2 : 0), 0)
    const totalScore = score + aliasScore
    if (totalScore > bestScore) {
      best = product
      bestScore = totalScore
    }
  }

  return bestScore > 0 ? best : null
}

function tokenize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token))
}

function detectObjection(text) {
  if (/(discount|deal|off|coupon|promo|bundle)/i.test(text)) {
    return {
      topic: 'discount timing and bundles',
      recommendedFix: 'Announce the next offer window clearly and pin active bundles.'
    }
  }
  if (/(usb-c|charger|cable|compatible|port)/i.test(text)) {
    return {
      topic: 'compatibility and charging',
      recommendedFix: 'Add a pinned compatibility FAQ for charger type, cable, and supported wattage.'
    }
  }
  if (/(warranty|authentic|fake|local set|original)/i.test(text)) {
    return {
      topic: 'warranty and authenticity',
      recommendedFix: 'Show warranty card or official Shopee listing proof on camera.'
    }
  }
  if (/(ship|shipping|deliver|today|arrive)/i.test(text)) {
    return {
      topic: 'shipping speed',
      recommendedFix: 'State same-day cutoff and delivery estimate before checkout pushes.'
    }
  }
  if (/(stock|left|available|restock)/i.test(text)) {
    return {
      topic: 'stock urgency',
      recommendedFix: 'Pin remaining quantity and call out low-stock items during demos.'
    }
  }
  return null
}

function scoreQuestionPriority(text, productId) {
  let score = productId === 'unknown' ? 35 : 50
  if (/(discount|deal|bundle|buy|checkout|stock|ship today)/i.test(text)) score += 30
  if (/(warranty|authentic|fake|refund)/i.test(text)) score += 20
  return Math.min(100, score)
}

function buildSuggestedQuestionReply(question, productName, intent = INTENT.QUESTION) {
  if (/(leaking|broken|damaged|refund|arrived|order)/i.test(question)) {
    return `Send a service recovery reply for ${productName} and ask for the buyer's order number.`
  }
  if (/(authentic|fake|original|real|qr|seal)/i.test(question)) {
    return `Reassure the buyer that ${productName} is authentic and share official listing or verification proof.`
  }
  if (/(usb-c|charger)/i.test(question)) {
    return `Answer compatibility details for ${productName} and confirm what is included before checkout.`
  }
  if (/(discount|deal|bundle)/i.test(question)) {
    return `We are tracking live offers for ${productName}. Send the buyer the active Shopee deal or next promo window.`
  }
  if (/(warranty)/i.test(question)) {
    return `Confirm ${productName} warranty or seller guarantee details and point the buyer to official proof.`
  }
  if (intent === INTENT.COMPLAINT) {
    return `Acknowledge the concern about ${productName} and send a specific trust-building reply.`
  }
  return `Follow up with a direct answer about ${productName} and include the Shopee checkout link.`
}

function buildLeadAction(message, productName) {
  if (/(discount|deal|bundle)/i.test(message)) return `DM active offer for ${productName} and set a short expiry.`
  if (/(where|checkout|cart|buy)/i.test(message)) return `Send direct Shopee checkout link for ${productName}.`
  if (/(stock|ship)/i.test(message)) return `Confirm availability and shipping timing for ${productName}, then nudge checkout.`
  return `Send a personalized checkout nudge for ${productName}.`
}

function buildProductAction(stats) {
  if (stats.purchaseSignals >= 3) return 'Prioritize a post-live DM blast and pin this product early next stream.'
  if (stats.questions >= 3) return 'Prepare a tighter FAQ card and demo script for this product.'
  if (stats.complaints > 0) return 'Address trust objections before pushing checkout.'
  return 'Keep this product in the rotation, but do not over-allocate airtime yet.'
}

function buildExecutiveSummary({ productDemand, unansweredQuestions, warmLeads, topObjections }) {
  const topProduct = productDemand[0]
  return {
    headline: topProduct
      ? `${topProduct.name} generated the strongest live demand signal.`
      : 'No strong product demand signal detected yet.',
    bullets: [
      `${warmLeads.length} buyer${warmLeads.length === 1 ? '' : 's'} showed purchase intent without confirmed conversion.`,
      `${unansweredQuestions.length} question${unansweredQuestions.length === 1 ? '' : 's'} should be followed up after the stream.`,
      topObjections[0]
        ? `Top objection: ${topObjections[0].topic}.`
        : 'No repeated objection theme detected.'
    ]
  }
}

function buildNextActions({ productDemand, unansweredQuestions, warmLeads, topObjections, discountImpact }) {
  const actions = []
  const topProduct = productDemand[0]

  if (warmLeads.length > 0) {
    actions.push({
      priority: 1,
      action: `DM ${Math.min(warmLeads.length, 10)} warm lead${warmLeads.length === 1 ? '' : 's'} with product-specific checkout links.`,
      reason: 'These buyers expressed purchase intent but have no confirmed conversion.',
      owner: 'seller'
    })
  }
  if (unansweredQuestions.length > 0) {
    actions.push({
      priority: 2,
      action: 'Answer unresolved high-priority product questions within the next hour.',
      reason: 'Fast follow-up can recover buyers who left the live before the seller responded.',
      owner: 'seller'
    })
  }
  if (topProduct) {
    actions.push({
      priority: 3,
      action: `Lead the next live with ${topProduct.name}.`,
      reason: `It has the highest demand score (${topProduct.demandScore}).`,
      owner: 'seller'
    })
  }
  if (topObjections[0]) {
    actions.push({
      priority: 4,
      action: topObjections[0].recommendedFix,
      reason: `Repeated objection theme: ${topObjections[0].topic}.`,
      owner: 'seller'
    })
  }
  if (discountImpact.some((discount) => discount.signalAfter > discount.signalBefore)) {
    actions.push({
      priority: 5,
      action: 'Reuse the best-performing discount window in the next stream.',
      reason: 'At least one offer created a visible post-discount demand lift.',
      owner: 'seller'
    })
  }

  return actions
}

function getProductId(product) {
  return product.productId ?? product.id ?? ''
}

function sanitizeDebrief(debrief, analytics) {
  const catalogProducts = new Map(analytics.productDemand.map((product) => [product.productId, product]))
  const productDemand = (debrief.productDemand ?? [])
    .filter((product) => catalogProducts.has(product.productId))

  const missingProducts = analytics.productDemand
    .filter((product) => !productDemand.some((item) => item.productId === product.productId))

  return {
    ...debrief,
    productDemand: [...productDemand, ...missingProducts]
      .sort((a, b) => b.demandScore - a.demandScore)
  }
}

function formatOffer(discount) {
  if (discount.valuePercent > 0) return `${discount.valuePercent}% off`
  if (discount.valueAmount > 0) return `$${discount.valueAmount.toFixed(2)} off`
  return 'Live offer'
}
