import { Router } from 'express'

import { loadDebriefData } from '../lib/dynamoDb.js'
import { generatePostLiveDebrief } from '../services/debriefService.js'

export const debriefRouter = Router()

debriefRouter.post('/', async (req, res, next) => {
  try {
    const {
      conversationId,
      products,
      messages,
      discounts,
      useAi = true
    } = req.body ?? {}

    const hasInlineData = Array.isArray(products) || Array.isArray(messages) || Array.isArray(discounts)
    const data = hasInlineData
      ? {
          products: products ?? [],
          messages: messages ?? [],
          discounts: discounts ?? []
        }
      : await loadDebriefData({ conversationId })

    const result = await generatePostLiveDebrief({
      conversationId,
      products: data.products,
      messages: data.messages,
      discounts: data.discounts,
      useAi
    })

    res.json({ result })
  } catch (error) {
    next(error)
  }
})

debriefRouter.get('/:conversationId', async (req, res, next) => {
  try {
    const data = await loadDebriefData({ conversationId: req.params.conversationId })
    const result = await generatePostLiveDebrief({
      conversationId: req.params.conversationId,
      products: data.products,
      messages: data.messages,
      discounts: data.discounts,
      useAi: req.query.ai !== 'false'
    })

    res.json({ result })
  } catch (error) {
    next(error)
  }
})
