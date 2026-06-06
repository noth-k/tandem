import { Router } from 'express'

import { agentsRouter } from './agents.js'
<<<<<<< HEAD
import { debriefRouter } from './debrief.js'
=======
import { audioRouter } from './audio.js'
>>>>>>> 61a6761 (audio parser 1.0)
import { demoRouter } from './demo.js'
import { realtimeRouter } from './realtime.js'

export const apiRouter = Router()

apiRouter.use('/agents', agentsRouter)
<<<<<<< HEAD
apiRouter.use('/debrief', debriefRouter)
=======
apiRouter.use('/audio', audioRouter)
>>>>>>> 61a6761 (audio parser 1.0)
apiRouter.use('/demo', demoRouter)
apiRouter.use('/realtime', realtimeRouter)
