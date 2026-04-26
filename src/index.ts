import { Server } from '@hocuspocus/server'
import { config } from './config.js'

const PORT = config.PORT

const server = new Server({
  port: PORT,
  name: 'pharos-server',
  debounce: 2000,
  maxDebounce: 10000,

  onRequest(data) {
    return new Promise<void>((resolve, reject) => {
      const { request, response, instance } = data

      if( request.url == '/health' ) {
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        })
        response.end(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          connections: instance.getConnectionsCount()
        }))
        return reject()
      }

      resolve()
    })
  },

  async onConnect({ documentName, socketId }) {
    console.log(`[connect]  doc="${documentName}" socket=${socketId}`)
  },

  async onDisconnect({ documentName, socketId }) {
    console.log(`[disconnect]   doc="${documentName}" socket=${socketId}`)
  },

  async onListen({ port }) {
    console.log(`✓ Pharos server listening on port ${port}`)
  }
})


server.listen()