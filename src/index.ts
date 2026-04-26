import { createServer } from 'node:http'
import { config } from './config.js'
import { app } from './app.js'

const server = createServer(app)

server.listen(config.PORT, () => {
  console.log(`✓ Pharos server listening on port ${config.PORT}`)
})