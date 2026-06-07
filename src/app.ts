import express from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health.js'
import { webhookRouter } from './routes/webhook.js'
import { authRouter } from './routes/auth.js'
import { devConsoleRouter } from './routes/devConsole.js'
import { syncRouter } from './routes/sync.js'
import { workspacesRouter } from './routes/workspaces.js'
import { invitesRouter } from './routes/invites.js'

export const app = express()

app.use(cors({
    origin: [
        /\.github\.io$/,
        'http://localhost:1234',
        'app://obsidian.md',        // Obsidian 데스크탑 (Electron)
        'capacitor://localhost',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}))

// /webhook/github 는 raw body 필요 → express.json() 보다 먼저 처리
app.use('/webhook/github', webhookRouter)

// 나머지 라우트는 JSON 파싱
app.use(express.json())
app.use('/health', healthRouter)
app.use('/auth', authRouter)
app.use('/sync', syncRouter)
app.use('/workspaces', workspacesRouter)
app.use('/invites', invitesRouter)

// ⚠️ 개발용 — 데모 완료 후 아래 두 줄 삭제
app.use('/dev/console', express.urlencoded({ extended: false }))
app.use('/dev/console', devConsoleRouter)