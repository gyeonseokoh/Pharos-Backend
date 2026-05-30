import { Router } from 'express'
import type { Request, Response } from 'express'
import { config } from '../config.js'
import { UserRepo } from '../db/repositories/UserRepo.js'
import { signToken } from '../auth/jwt.js'

export const authRouter = Router()

// state 저장 Set — CSRF 방지 (Render 단일 인스턴스 기준 메모리로 충분)
const pendingStates = new Set<string>()
const PENDING_TIME_LIMIT_MS = 10 * 60 * 1000 // 10분

// ─── 1. GitHub OAuth 시작 ────────────────────────────────────────────────────
authRouter.get('/github', (_req: Request, res: Response) => {
    const state = crypto.randomUUID().replace(/-/g, '')
    pendingStates.add(state)
    setTimeout(() => pendingStates.delete(state), PENDING_TIME_LIMIT_MS)

    const params = new URLSearchParams({
        client_id:    config.GITHUB_CLIENT_ID,
        redirect_uri: `${config.SERVER_URL}/auth/github/callback`, // ← 수정: redirect_url → redirect_uri (GitHub 공식 파라미터명)
        scope:        'read:user',
        state,
    })

    res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// ─── 2. GitHub OAuth 콜백 ────────────────────────────────────────────────────
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

    // code → GitHub Access Token 교환
    let accessToken: string
    try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                Accept:         'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id:     config.GITHUB_CLIENT_ID,
                client_secret: config.GITHUB_CLIENT_SECRET,
                code,
            }),
        })
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string }

        if (!tokenData.access_token) {
            console.error('[auth] token exchange failed:', tokenData.error)
            res.status(400).send('Token exchange failed')
            return
        }
        accessToken = tokenData.access_token
    } catch (e) {
        console.error('[auth] token exchange error:', e)
        res.status(500).send('Token exchange error')
        return
    }

    // GitHub /user 조회
    let githubUser: { id: number; login: string }
    try {
        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept:        'application/vnd.github+json',
            },
        })
        if (!userRes.ok) {
            console.error('[auth] github user fetch status:', userRes.status)
            res.status(502).send('GitHub user fetch failed')
            return
        }
        githubUser = await userRes.json() as { id: number; login: string }
    } catch (e) {
        console.error('[auth] github user fetch error:', e)
        res.status(500).send('GitHub user fetch error')
        return
    }

    // UserRepo.upsert → 서버 JWT 발급 → obsidian://pharos-callback redirect
    try {
        const user = await UserRepo.upsert({
            github_id:    githubUser.id,
            login:        githubUser.login,
            access_token: accessToken,
        })

        const jwt = signToken({ sub: user.id, login: user.login })

        // 플러그인의 registerObsidianProtocolHandler("pharos-callback") 가 수신
        res.redirect(`${config.CLIENT_URL}?token=${jwt}`)
    } catch (e) {
        console.error('[auth] upsert/sign error:', e)
        res.status(500).send('Internal server error')
    }
})