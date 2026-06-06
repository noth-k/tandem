import { Router } from 'express'

import {
  classifyMessage,
  draftReply,
  parsePromo
} from '../services/agentService.js'
import { generatePostLiveDebrief } from '../services/debriefService.js'

export const agentsRouter = Router()

agentsRouter.post('/classify', (req, res) => {
  const { message, productContext } = req.body
  assertText(message, 'message')

  res.json({
    result: classifyMessage({ message, productContext })
  })
})

agentsRouter.post('/respond', (req, res) => {
  const { message, classification, productContext } = req.body
  assertText(message, 'message')

  res.json({
    result: draftReply({ message, classification, productContext })
  })
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
