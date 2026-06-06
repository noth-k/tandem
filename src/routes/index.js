import { Router } from 'express'

import { agentsRouter } from './agents.js'
import { debriefRouter } from './debrief.js'
import { demoRouter } from './demo.js'
import { realtimeRouter } from './realtime.js'

export const apiRouter = Router()

apiRouter.use('/agents', agentsRouter)
apiRouter.use('/audio', audioRouter)
apiRouter.use('/debrief', debriefRouter)
apiRouter.use('/demo', demoRouter)
apiRouter.use('/realtime', realtimeRouter)
