import { Router } from 'express'

import { getAudioState, interpretTranscript } from '../services/audioIntentService.js'
import { addEventClient } from '../services/eventBus.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const audioRouter = Router()

audioRouter.get('/state', asyncHandler(async (req, res) => {
  res.json({ state: await getAudioState(req.query.streamId) })
}))

audioRouter.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  })

  const cleanup = addEventClient(res)
  req.on('close', cleanup)
})

audioRouter.post('/interpret', asyncHandler(async (req, res) => {
  const { transcript, streamId } = req.body

  if (typeof transcript !== 'string' || !transcript.trim()) {
    const err = new Error('transcript is required')
    err.statusCode = 400
    err.code = 'bad_request'
    throw err
  }

  const normalizedTranscript = transcript.trim()
  console.info('audio.final_transcript', {
    streamId,
    transcript: normalizedTranscript,
    length: normalizedTranscript.length,
    receivedAt: new Date().toISOString()
  })

  const result = await interpretTranscript({
    transcript: normalizedTranscript,
    streamId
  })

  res.json(result)
}))
