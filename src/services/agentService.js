import OpenAI from 'openai'

import { saveChatMessage } from './dynamoService.js'
import { sendChatMessageToQueue } from './sqsService.js'

const INTENTS = {
  QUESTION: 'question',
  PURCHASE: 'purchase',
  COMPLAINT: 'complaint',
  SPAM: 'spam',
  GENERAL: 'general'
}

const CLASSIFIER_CATEGORIES = [
  'product_question',
  'price_question',
  'shipping_question',
  'payment_question',
  'stock_question',
  'purchase_intent',
  'complaint',
  'negotiation',
  'authenticity_question',
  'irrelevant',
  'spam',
  'other'
]

const CLASSIFIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply_needed: {
      type: 'boolean'
    },
    category: {
      type: 'string',
      enum: CLASSIFIER_CATEGORIES
    },
    priority: {
      type: 'integer',
      minimum: 0,
      maximum: 100
    },
    reason: {
      type: 'string'
    }
  },
  required: ['reply_needed', 'category', 'priority', 'reason']
}

let openaiClient

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  return openaiClient
}

export async function classifyAndQueueChatMessage(payload) {
  const classification = await classifyMessageWithOpenAI(payload)
  const result = {
    ...classification,
    queued: false
  }

  if (classification.reply_needed) {
    try {
      await sendChatMessageToQueue(payload)
      result.queued = true
    } catch (error) {
      result.queue_error = error.message
    }
  }

  try {
    await saveChatMessage({
      payload,
      classification,
      queued: result.queued
    })
    result.saved_to_dynamodb = true
  } catch (error) {
    result.saved_to_dynamodb = false
    result.dynamodb_error = error.message
  }

  return result
}

async function classifyMessageWithOpenAI(payload) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackChatFilter(payload.message)
  }

  try {
    const response = await getOpenAIClient().responses.create({
      model: process.env.OPENAI_CLASSIFIER_MODEL ?? 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: [
            'You are Agent 2 for a live-commerce AI co-host.',
            'Your only job is to decide if a buyer chat message needs a reply.',
            'Return reply_needed=true for messages that can affect sales, trust, fulfillment, complaints, product understanding, stock, shipping, payment, price, purchase intent, bundles, negotiation, or authenticity.',
            'Return reply_needed=false for compliments, hype, greetings, spam, gibberish, follow-for-follow, or reactions that do not require seller/responder action.',
            'Do not draft replies.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({
            conversation_id: payload.conversation_id,
            conversation_timestamp: payload.conversation_timestamp,
            message: payload.message,
            product_id: payload.product_id,
            buyer_username: payload.buyer_username
          })
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'chat_filter_result',
          strict: true,
          schema: CLASSIFIER_SCHEMA
        }
      },
      max_output_tokens: 250
    })

    return normalizeClassification(JSON.parse(extractOutputText(response)), 'openai')
  } catch (error) {
    return {
      ...fallbackChatFilter(payload.message),
      source: 'fallback',
      model_error: error.message
    }
  }
}

function extractOutputText(response) {
  if (response.output_text) return response.output_text

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text) return content.text
    }
  }

  throw new Error('OpenAI response did not include output text')
}

function normalizeClassification(value, source) {
  const category = CLASSIFIER_CATEGORIES.includes(value.category) ? value.category : 'other'
  const rawPriority = Number.isInteger(value.priority)
    ? Math.max(0, Math.min(100, value.priority))
    : value.reply_needed ? 50 : 0
  const priority = value.reply_needed ? Math.max(rawPriority, minimumPriorityFor(category)) : 0

  return {
    reply_needed: Boolean(value.reply_needed),
    category,
    priority,
    reason: typeof value.reason === 'string' && value.reason.trim()
      ? value.reason.trim()
      : 'Classifier did not provide a reason.',
    source
  }
}

function minimumPriorityFor(category) {
  if (category === 'complaint' || category === 'authenticity_question') return 90
  if (category === 'purchase_intent' || category === 'negotiation') return 80
  if (category === 'shipping_question' || category === 'payment_question' || category === 'stock_question') return 70
  if (category === 'price_question' || category === 'product_question') return 60
  return 50
}

function fallbackChatFilter(message) {
  const text = message.toLowerCase()

  if (/(free money|click here|crypto|scam|follow me|follow back|free iphone|check my profile)/i.test(message)) {
    return normalizeClassification({
      reply_needed: false,
      category: 'spam',
      priority: 0,
      reason: 'Spam or promotional noise does not need a reply.'
    }, 'fallback')
  }

  if (/(broken|refund|late|leaking|bad|angry|complaint|disappointed|damaged|fake|authentic|real)/i.test(message)) {
    return normalizeClassification({
      reply_needed: true,
      category: text.includes('fake') || text.includes('authentic') || text.includes('real')
        ? 'authenticity_question'
        : 'complaint',
      priority: 90,
      reason: 'Complaint or trust issue needs a reply.'
    }, 'fallback')
  }

  if (/(buy|cart|checkout|take|want|order|bundle|discount|deal|promo|stock|available|restock)/i.test(message)) {
    return normalizeClassification({
      reply_needed: true,
      category: /(bundle|discount|deal|promo)/i.test(message) ? 'negotiation' : 'purchase_intent',
      priority: 80,
      reason: 'Purchase-related message can affect conversion.'
    }, 'fallback')
  }

  if (/(ship|shipping|deliver|delivery|malaysia|johor|cebu|fee|payment|pay|cod)/i.test(message)) {
    return normalizeClassification({
      reply_needed: true,
      category: /(payment|pay|cod)/i.test(message) ? 'payment_question' : 'shipping_question',
      priority: 70,
      reason: 'Logistics or payment question needs a reply.'
    }, 'fallback')
  }

  if (/(how much|price|cost|\$|size|sizing|ingredient|skin|oily|acne|spf|sticky|white cast|lasts|hours|texture|color|colour)/i.test(message)) {
    return normalizeClassification({
      reply_needed: true,
      category: /(how much|price|cost|\$)/i.test(message) ? 'price_question' : 'product_question',
      priority: 65,
      reason: 'Product detail question needs a reply.'
    }, 'fallback')
  }

  if (message.includes('?') || /\b(how|what|when|where|does|is|can|do)\b/i.test(message)) {
    return normalizeClassification({
      reply_needed: true,
      category: 'product_question',
      priority: 50,
      reason: 'Question may need a reply.'
    }, 'fallback')
  }

  if (/(pretty|beautiful|cute|love you|first|omg|wow|haha|lol|slay|queen|fire|🔥|❤️|😍)/i.test(message)) {
    return normalizeClassification({
      reply_needed: false,
      category: 'irrelevant',
      priority: 0,
      reason: 'Compliment or hype does not need a reply.'
    }, 'fallback')
  }

  return normalizeClassification({
    reply_needed: false,
    category: 'irrelevant',
    priority: 0,
    reason: 'General chat does not need a reply.'
  }, 'fallback')
}

export function classifyMessage({ message, productContext }) {
  const text = message.toLowerCase()
  const product = productContext?.id ?? productContext?.productId ?? null

  if (/(free money|click here|crypto|scam)/i.test(message)) {
    return { intent: INTENTS.SPAM, route: 'hide', product, priority: 0 }
  }

  if (/(buy|cart|checkout|take|want|order|stock)/i.test(message)) {
    return {
      intent: INTENTS.PURCHASE,
      route: 'escalate',
      product,
      priority: 90,
      lead: true,
      escalation: 'High purchase intent detected'
    }
  }

  if (/(broken|refund|late|bad|angry|complaint)/i.test(message)) {
    return {
      intent: INTENTS.COMPLAINT,
      route: 'escalate',
      product,
      priority: 80,
      lead: false,
      escalation: 'Buyer issue needs seller review'
    }
  }

  if (text.includes('?') || /(how|what|when|where|is it|does it)/i.test(message)) {
    return { intent: INTENTS.QUESTION, route: 'auto', product, priority: 40 }
  }

  return { intent: INTENTS.GENERAL, route: 'auto', product, priority: 10 }
}

export function draftReply({ message, classification, productContext }) {
  const classified = classification ?? classifyMessage({ message, productContext })
  const productName = productContext?.name ?? 'this item'

  if (classified.route === 'hide') {
    return {
      route: 'hide',
      reply: null,
      reason: 'Message classified as spam'
    }
  }

  if (classified.route === 'escalate') {
    return {
      route: 'escalate',
      escalation: classified.escalation ?? 'Seller review recommended',
      suggested: `You can reply: Yes, ${productName} is available. I can pin it for you now.`
    }
  }

  return {
    route: 'auto',
    reply: `Thanks for asking. ${productName} is available, and the host will cover the details live.`
  }
}

export function parsePromo({ transcript, products = [] }) {
  const text = transcript.toLowerCase()
  const product = products.find((item) => text.includes(item.name?.toLowerCase())) ?? null
  const percentMatch = text.match(/(\d{1,2})\s*(percent|%)/)
  const dollarsMatch = text.match(/\$?\s*(\d{1,3})\s*(off|coupon|dollars?)/)

  if (!product && !percentMatch && !dollarsMatch) {
    return {
      promo: null,
      confidence: 0.25,
      reason: 'No product or offer terms detected'
    }
  }

  return {
    promo: {
      id: `promo_${Date.now()}`,
      product: product?.id ?? null,
      kind: percentMatch ? 'percent_discount' : 'fixed_discount',
      value: Number.parseInt((percentMatch ?? dollarsMatch)?.[1] ?? '0', 10),
      transcript
    },
    confidence: product ? 0.82 : 0.58
  }
}

export function summarizeDebrief({ events }) {
  const chatEvents = events.filter((event) => event.type === 'chat')
  const purchaseSignals = chatEvents.filter((event) =>
    /(buy|cart|checkout|take|want|order|stock)/i.test(event.message ?? '')
  )

  return {
    totals: {
      events: events.length,
      chatMessages: chatEvents.length,
      purchaseSignals: purchaseSignals.length
    },
    warmLeads: purchaseSignals.map((event) => ({
      buyer: event.buyer,
      product: event.product,
      message: event.message
    })),
    nextActions: [
      'Follow up with warm leads',
      'Review unanswered product questions',
      'Compare promo timing against purchase spikes'
    ]
  }
}
