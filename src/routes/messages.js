import { Router } from 'express'

import { listChatMessages } from '../services/dynamoService.js'

export const messagesRouter = Router()

messagesRouter.get('/', async (req, res, next) => {
  try {
    const livestream_id = typeof req.query.livestream_id === 'string'
      ? req.query.livestream_id.trim()
      : ''
    const limit = typeof req.query.limit === 'string'
      ? Number.parseInt(req.query.limit, 10)
      : 100

    const result = await listChatMessages({
      livestream_id,
      limit
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})
