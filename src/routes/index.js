import { Router } from 'express'

import { agentsRouter } from './agents.js'
import { demoRouter } from './demo.js'

export const apiRouter = Router()

apiRouter.use('/agents', agentsRouter)
apiRouter.use('/demo', demoRouter)
