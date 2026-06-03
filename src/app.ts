import express from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health.js'
import { webhookRouter } from './routes/webhook.js'
import { authRouter } from './routes/auth.js'
import { devConsoleRouter } from './routes/devConsole.js'
import { syncRouter } from './routes/sync.js'
import { workspacesRouter } from './routes/workspaces.js'  // ← E-Back-1

export const app = express()

app.use(cors({
    origin: [
        /\.github\.io$/,
        'http://localhost:1234',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}))

// /webhook/github 는 raw body 필요 → express.json() 보다 먼저 처리
app.use('/webhook/github', webhookRouter)

// 나머지 라우트는 JSON 파싱
app.use(express.json())
app.use('/health', healthRouter)
app.use('/auth', authRouter)
app.use('/sync', syncRouter)
app.use('/workspaces', workspacesRouter)   // ← E-Back-1

// ⚠️ 개발용 — 데모 완료 후 아래 두 줄 삭제
app.use('/dev/console', express.urlencoded({ extended: false }))
app.use('/dev/console', devConsoleRouter)