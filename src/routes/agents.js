import { Router } from 'express'

import {
  classifyMessage,
  draftReply,
  parsePromo,
  summarizeDebrief
} from '../services/agentService.js'

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
