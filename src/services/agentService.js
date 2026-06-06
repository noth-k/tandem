const INTENTS = {
  QUESTION: 'question',
  PURCHASE: 'purchase',
  COMPLAINT: 'complaint',
  SPAM: 'spam',
  GENERAL: 'general'
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
