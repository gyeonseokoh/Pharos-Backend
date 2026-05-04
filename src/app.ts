import express from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health.js'

export const app = express()

app.use(cors({
    origin: [
        /\.github\.io$/,      // GitHub Pages (모든 서브도메인 허용)
        'http://localhost:1234' // 로컬 개발용
    ],
    methods: ['GET']
}))

app.use(express.json())
app.use('/health', healthRouter)