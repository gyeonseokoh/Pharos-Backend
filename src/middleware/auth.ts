import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../auth/jwt.js'

/**
 * JWT 인증 미들웨어.
 *
 * Authorization: Bearer <token> 헤더를 검증하고
 * 유효하면 res.locals.user = { sub, login } 을 주입한다.
 * 이후 라우트 핸들러에서 res.locals.user 로 접근 가능.
 *
 * 사용처: routes/jobs.ts, routes/repo.ts
 * 
 * Bearer 관례는 갠적으로 여전히 맘에 안드네
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization

    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or malformed Authorization header' })
        return
    }

    const token = header.slice(7) // 'Bearer ' 이후
    const payload = verifyToken(token)

    if (!payload) {
        res.status(401).json({ error: 'Invalid or expired token' })
        return
    }

    // 이후 핸들러에서 res.locals.user.sub, res.locals.user.login 사용
    res.locals.user = payload
    next()
}