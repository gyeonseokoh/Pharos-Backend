import express from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health.js'
import { webhookRouter } from './routes/webhook.js'
import { authRouter } from './routes/auth.js'
import { devConsoleRouter } from './routes/devConsole.js'

export const app = express()

app.use(cors({
    origin: [
        /\.github\.io$/,
        'http://localhost:1234',
    ],
    // POST·PATCH 추가 — /jobs PATCH, /repo GET 등 향후 라우트 대비
    methods: ['GET', 'POST', 'PATCH'],
}))

// /webhook/github 는 raw body 필요 → express.json() 보다 먼저 처리
app.use('/webhook/github', webhookRouter)

// 나머지 라우트는 JSON 파싱
app.use(express.json())
app.use('/health', healthRouter)
app.use('/auth', authRouter) // authRouter 마운트만 추가

// ⚠️ 개발용 — 데모 완료 후 아래 두 줄 삭제
app.use('/dev/console', express.urlencoded({ extended: false }))
app.use('/dev/console', devConsoleRouter)