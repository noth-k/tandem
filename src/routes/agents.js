import { Router } from 'express'

import {
  classifyAndQueueChatMessage,
  draftReply,
  parsePromo
} from '../services/agentService.js'
import { generatePostLiveDebrief } from '../services/debriefService.js'
import { respondToPendingMessages } from '../services/responderService.js'

export const agentsRouter = Router()

agentsRouter.post('/classify', async (req, res, next) => {
  try {
    const payload = getChatFilterPayload(req.body)
    console.log('[agent2] received chat message', payload)
    const result = await classifyAndQueueChatMessage(payload)
    console.log('[agent2] classification result', result)

    res.json({
      result
    })
  } catch (error) {
    next(error)
  }
})

agentsRouter.post('/respond', (req, res) => {
  const { message, classification, productContext } = req.body
  assertText(message, 'message')

  res.json({
    result: draftReply({ message, classification, productContext })
  })
})

agentsRouter.post('/respond-pending', async (req, res, next) => {
  try {
    const { livestream_id, limit } = req.body ?? {}

    const result = await respondToPendingMessages({
      livestream_id: typeof livestream_id === 'string' ? livestream_id.trim() : '',
      limit
    })

    res.json({ result })
  } catch (error) {
    next(error)
  }
})

agentsRouter.post('/parse-promo', (req, res) => {
  const { transcript, products } = req.body
  assertText(transcript, 'transcript')

  res.json({
    result: parsePromo({ transcript, products })
  })
})

agentsRouter.post('/debrief', async (req, res, next) => {
  try {
    const {
      conversationId,
      products = [],
      messages,
      discounts = [],
      events = [],
      useAi = true
    } = req.body

    const normalizedMessages = Array.isArray(messages)
      ? messages
      : normalizeChatEvents(events)

    const result = await generatePostLiveDebrief({
      conversationId,
      products,
      messages: normalizedMessages,
      discounts,
      useAi
    })

    res.json({ result })
  } catch (error) {
    next(error)
  }
})

function assertText(value, fieldName) {
  if (typeof value === 'string' && value.trim()) return

  const err = new Error(`${fieldName} is required`)
  err.statusCode = 400
  err.code = 'bad_request'
  throw err
}

function normalizeChatEvents(events) {
  if (!Array.isArray(events)) {
    const err = new Error('events must be an array')
    err.statusCode = 400
    err.code = 'bad_request'
    throw err
  }

  return events
    .filter((event) => event.type === 'chat')
    .map((event) => ({
      messageId: event.id,
      messageTimestamp: event.timestamp ?? event.messageTimestamp ?? new Date(event.at ?? Date.now()).toISOString(),
      buyerId: event.buyerId ?? event.buyer,
      buyerUsername: event.buyerUsername ?? event.buyer,
      messageText: event.message ?? event.text,
      productId: event.productId ?? event.product,
      aiCategory: event.intent,
      replySent: Boolean(event.replySent || event.reply),
      converted: Boolean(event.converted)
    }))
}

function getChatFilterPayload(body) {
  const {
    conversation_id,
    conversation_timestamp,
    message,
    product_id,
    buyer_username,
    livestream_id
  } = body

  assertText(conversation_id, 'conversation_id')
  assertText(conversation_timestamp, 'conversation_timestamp')
  assertText(message, 'message')
  assertText(product_id, 'product_id')
  assertText(buyer_username, 'buyer_username')
  assertText(livestream_id, 'livestream_id')

  return {
    conversation_id: conversation_id.trim(),
    conversation_timestamp: conversation_timestamp.trim(),
    message: message.trim(),
    product_id: product_id.trim(),
    buyer_username: buyer_username.trim(),
    livestream_id: livestream_id.trim()
  }
}
