import { Router } from 'express'

import {
  classifyAndQueueChatMessage,
  draftReply,
  parsePromo,
  summarizeDebrief
} from '../services/agentService.js'

export const agentsRouter = Router()

agentsRouter.post('/classify', async (req, res, next) => {
  try {
    const payload = getChatFilterPayload(req.body)

    res.json({
      result: await classifyAndQueueChatMessage(payload)
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

agentsRouter.post('/parse-promo', (req, res) => {
  const { transcript, products } = req.body
  assertText(transcript, 'transcript')

  res.json({
    result: parsePromo({ transcript, products })
  })
})

agentsRouter.post('/debrief', (req, res) => {
  const { events = [] } = req.body

  if (!Array.isArray(events)) {
    const err = new Error('events must be an array')
    err.statusCode = 400
    err.code = 'bad_request'
    throw err
  }

  res.json({
    result: summarizeDebrief({ events })
  })
})

function assertText(value, fieldName) {
  if (typeof value === 'string' && value.trim()) return

  const err = new Error(`${fieldName} is required`)
  err.statusCode = 400
  err.code = 'bad_request'
  throw err
}

function getChatFilterPayload(body) {
  const {
    conversation_id,
    message,
    product_id,
    buyer_username
  } = body

  assertText(conversation_id, 'conversation_id')
  assertText(message, 'message')
  assertText(product_id, 'product_id')
  assertText(buyer_username, 'buyer_username')

  return {
    conversation_id: conversation_id.trim(),
    message: message.trim(),
    product_id: product_id.trim(),
    buyer_username: buyer_username.trim()
  }
}
