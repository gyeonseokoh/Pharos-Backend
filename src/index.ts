import { createServer } from 'node:http'
import { config } from './config.js'
import { app } from './app.js'
import type { IncomingMessage } from 'node:http'
import { WebSocketServer } from 'ws'
import { hocuspocus } from './hocuspocus.js'
import { migrate } from './db/migrate.js'

// IncomingRequest -> web 표준 request 변환
// hocuspocus v4 의 handleConnection의 요구사항(web 표준 Request 요구)에 따름.
function toWebRequest(req: IncomingMessage): Request {
    const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`
    const headers = new Headers()

    for (const [key, val] of Object.entries(req.headers)) {
        if (val === undefined)
            continue
        headers.set(key, Array.isArray(val)? val.join(', '): val)
    }

    return new Request(url, { headers })
}

// 서버 시작 전 DB migrate
await migrate()


const server = createServer(app)
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        const request = toWebRequest(req)
        const clientConnection = hocuspocus.handleConnection(ws, request)

        // v4: message/close를 호출자가 직접 라우팅 필요
        ws.on('message', (data) => {
            let bytes: Uint8Array
            if (Buffer.isBuffer(data))      bytes = data
            else if (Array.isArray(data))   bytes = Buffer.concat(data)
            else                            bytes = new Uint8Array(data as ArrayBuffer)
            clientConnection.handleMessage(bytes)
        })

        ws.on('close', (code, reason) => {
            clientConnection.handleClose({ code, reason: reason.toString() })
        })
    })
})

server.listen(config.PORT, () => {
    console.log(`✓ Pharos server listening on port ${config.PORT}`)
})