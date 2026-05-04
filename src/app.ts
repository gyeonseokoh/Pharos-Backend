import express from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health.js'
import { webhookRouter } from './routes/webhook.js'

export const app = express()

app.use(cors({
    origin: [
        /\.github\.io$/,
        'http://localhost:1234'
    ],
    methods: ['GET']
}))

// /webhook/github 는 raw body 필요 → then, express.json() 보다 먼저, 별도 처리
app.use('/webhook/github', webhookRouter)

// 나머지 라우트는 json 파싱
app.use(express.json())
app.use('/health', healthRouter)