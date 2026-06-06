import { Router } from 'express'

import { demoEvents, demoProducts, demoSeller } from '../services/demoData.js'

export const demoRouter = Router()

demoRouter.get('/snapshot', (_req, res) => {
  res.json({
    seller: demoSeller,
    products: demoProducts,
    events: demoEvents
  })
})

demoRouter.get('/events', (_req, res) => {
  res.json({ events: demoEvents })
})
