import { Router } from 'express'
import type { Request, Response } from 'express'
import { config } from '../config.js'
import { UserRepo } from '../db/repositories/UserRepo.js'
import { signToken } from '../auth/jwt.js'

export const authRouter = Router()

// 1. github OAuth URL로 Redirect
// state = 랜덤 hex - CSRF 방지. 현재는 메모리 저장.(Render 단일 인스턴스 기준 충분)
const pendingStates = new Set<String>()

// 요청 만료 시간
const PENDING_TIME_LIMIT_MS = 10 * 60 * 1000

authRouter.get('/github', (_req: Request, res: Response) => {
    const state = crypto.randomUUID().replace(/-/g, '')
    pendingStates.add(state)

    // 10분 후 상태 만료
    setTimeout(() => pendingStates.delete(state), PENDING_TIME_LIMIT_MS)

    const params = new URLSearchParams({
        client_id: config.GITHUB_CLIENT_ID,
        redirect_url: `${config.SERVER_URL}/auth/github/callback`,
        scope: 'read:user user:email',
        state
    })

    res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})



// 2. Github 콜백 처리
authRouter.get('/github/callback', async (req: Request, res: Response) => {
    const { code, state } = req.query as { code?: string; state?: string }

    // state 검증
    if (!state || !pendingStates.has(state)) {
        res.status(400).send('Invalid or expired state')
        return
    }
    pendingStates.delete(state)

    if (!code) {
        res.status(400).send('Missing code')
        return
    }

    // code -> access token 교환
    let accessToken: string
    try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: config.GITHUB_CLIENT_ID,
                client_secret: config.GITHUB_CLIENT_SECRET,
                code
            })
        })
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string }

        if (!tokenData.access_token) {
            console.error('[auth] token exchange failed:', tokenData.error)
            res.status(400).send('Token exchange failed')
            return
        }
        accessToken = tokenData.access_token
    } catch(e) {
        console.error('[auth] token exchange error:', e)
        res.status(500).send('Token exchange error')
        return
    }

    // Github User 정보 조회
    let githubUser: { id: number; login: string; }
    try {
        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json'
            }
        })
        githubUser = await userRes.json() as { id: number; login: string; }
    } catch(e) {
        console.error('[auth] github user fetch error:', e)
        res.status(500).send('Github user fetch error')
        return
    }
})