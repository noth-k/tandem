import OpenAI from 'openai'

import {
  listPendingReplyMessages,
  markMessageReplySent,
  saveAiResponseMessage
} from './dynamoService.js'

const IMPORTANT_CATEGORIES = new Set([
  'complaint',
  'authenticity_question',
  'negotiation',
  'purchase_intent'
])

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['response', 'important', 'reason'],
  properties: {
    response: {
      type: 'string'
    },
    important: {
      type: 'boolean'
    },
    reason: {
      type: 'string'
    }
  }
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

export async function respondToMessageIfNeeded({
  payload,
  classification
}) {
  if (!classification?.reply_needed) {
    return {
      responded: false,
      reason: 'replyNeeded is false'
    }
  }

  const message = {
    conversation_id: payload.conversation_id,
    conversation_timestamp: payload.conversation_timestamp,
    livestream_id: payload.livestream_id,
    buyer_username: payload.buyer_username,
    message: payload.message,
    product_id: payload.product_id,
    category: classification.category,
    priority: classification.priority,
    reply_needed: true,
    reply_sent: false
  }

  return respondToPendingMessage(message)
}

export async function respondToPendingMessages({
  livestream_id,
  limit = 25
} = {}) {
  const { messages } = await listPendingReplyMessages({
    livestream_id,
    limit
  })

  const results = []
  for (const message of messages) {
    results.push(await respondToPendingMessage(message))
  }

  return {
    processed: results.length,
    results
  }
}

async function respondToPendingMessage(message) {
  if (!message.reply_needed || message.reply_sent) {
    return {
      responded: false,
      conversation_id: message.conversation_id,
      reason: 'message is not pending a reply'
    }
  }

  const draft = await draftAgent3Response(message)
  const important = isImportantMessage(message, draft)

  const saved = await saveAiResponseMessage({
    originalMessage: message,
    responseText: draft.response,
    important
  })

  const updated = await markMessageReplySent({
    conversation_id: message.conversation_id,
    conversation_timestamp: message.conversation_timestamp,
    aiResponse: draft.response,
    important
  })

  return {
    responded: true,
    conversation_id: message.conversation_id,
    livestream_id: message.livestream_id,
    response_id: saved.responseId,
    response: draft.response,
    important,
    reason: draft.reason,
    saved,
    updated
  }
}

async function draftAgent3Response(message) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackAgent3Response(message)
  }

  try {
    const response = await getOpenAIClient().responses.create({
      model: process.env.OPENAI_RESPONDER_MODEL ?? 'gpt-4o-mini',
      input: [
        {
          role: 'system',
          content: [
            'You are Agent 3 for a live-commerce AI co-host.',
            'Write one concise buyer-facing chat reply.',
            'Keep it under 35 words, practical, warm, and commerce-focused.',
            'Do not claim actions that are not confirmed. For complaints, apologize and ask for order details.',
            'For high-value or risky messages, still provide a safe reply and set important=true.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({
            buyer_username: message.buyer_username,
            message: message.message,
            product_id: message.product_id,
            category: message.category,
            priority: message.priority
          })
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'agent3_response',
          strict: true,
          schema: RESPONSE_SCHEMA
        }
      },
      max_output_tokens: 220
    })

    return normalizeDraft(JSON.parse(extractOutputText(response)))
  } catch (error) {
    return {
      ...fallbackAgent3Response(message),
      reason: `OpenAI responder failed, used fallback: ${error.message}`
    }
  }
}

function fallbackAgent3Response(message) {
  const category = message.category ?? ''
  const productLabel = message.product_id ? `the ${message.product_id}` : 'this item'

  if (category === 'complaint') {
    return {
      response: `@${message.buyer_username} sorry about that. Please DM your order number so we can check and help right away.`,
      important: true,
      reason: 'Complaint should be acknowledged and flagged.'
    }
  }

  if (category === 'authenticity_question') {
    return {
      response: `@${message.buyer_username} this is from the official listing. We can show the verification details on stream too.`,
      important: true,
      reason: 'Authenticity questions are trust-sensitive.'
    }
  }

  if (category === 'shipping_question') {
    return {
      response: `@${message.buyer_username} yes, we can help with shipping details. Tell us your location and we will confirm timing.`,
      important: false,
      reason: 'Shipping question can be safely answered.'
    }
  }

  if (category === 'price_question') {
    return {
      response: `@${message.buyer_username} ${productLabel} price is shown in the basket. Tap the pinned product to check out.`,
      important: false,
      reason: 'Price question can be safely answered.'
    }
  }

  if (category === 'purchase_intent' || category === 'negotiation') {
    return {
      response: `@${message.buyer_username} tap the pinned product in the basket to checkout. We will keep an eye on your question too.`,
      important: true,
      reason: 'Purchase intent should be replied to and flagged.'
    }
  }

  return {
    response: `@${message.buyer_username} thanks for asking. The seller will cover ${productLabel} details live, and you can tap the basket anytime.`,
    important: false,
    reason: 'General product question can be answered safely.'
  }
}

function normalizeDraft(value) {
  return {
    response: typeof value.response === 'string' && value.response.trim()
      ? value.response.trim()
      : 'Thanks for asking. The seller will cover this live, and you can tap the basket anytime.',
    important: Boolean(value.important),
    reason: typeof value.reason === 'string' && value.reason.trim()
      ? value.reason.trim()
      : 'Responder did not provide a reason.'
  }
}

function isImportantMessage(message, draft) {
  return (
    Boolean(draft.important) ||
    IMPORTANT_CATEGORIES.has(message.category) ||
    Number(message.priority ?? 0) >= 85
  )
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
