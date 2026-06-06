import dotenv from 'dotenv'

import { createApp } from './app.js'

dotenv.config({ override: true })

const port = Number.parseInt(process.env.PORT ?? '4000', 10)
const app = createApp()

app.listen(port, () => {
  console.log(`Tandem backend listening on http://localhost:${port}`)
})
