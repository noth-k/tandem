import { Router } from 'express'

import { agentsRouter } from './agents.js'
import { debriefRouter } from './debrief.js'
import { demoRouter } from './demo.js'
import { messagesRouter } from './messages.js'
import { realtimeRouter } from './realtime.js'
import { audioRouter } from './audio.js'

export const apiRouter = Router()

apiRouter.use('/agents', agentsRouter)
apiRouter.use('/audio', audioRouter)
apiRouter.use('/debrief', debriefRouter)
apiRouter.use('/demo', demoRouter)
apiRouter.use('/messages', messagesRouter)
apiRouter.use('/realtime', realtimeRouter)
