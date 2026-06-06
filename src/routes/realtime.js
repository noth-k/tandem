import { Router } from 'express'

import {
  createRealtimeClientSecret,
  createRealtimeTranscriptionCall
} from '../services/openaiService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const realtimeRouter = Router()

realtimeRouter.post('/client-secret', asyncHandler(async (_req, res) => {
  res.json(await createRealtimeClientSecret())
}))

realtimeRouter.post('/sdp', asyncHandler(async (req, res) => {
  if (typeof req.body !== 'string' || !req.body.includes('v=0')) {
    const err = new Error('SDP offer is required')
    err.statusCode = 400
    err.code = 'bad_request'
    throw err
  }

  const answer = await createRealtimeTranscriptionCall({ sdp: req.body })
  res.type('application/sdp').send(answer)
}))
