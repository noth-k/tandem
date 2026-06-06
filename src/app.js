import cors from 'cors'
import express from 'express'
import morgan from 'morgan'

import { apiRouter } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'

export function createApp() {
  const app = express()

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }))
  app.use(express.json({ limit: '1mb' }))
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'tandem-backend',
      timestamp: new Date().toISOString()
    })
  })

  app.use('/api', apiRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
