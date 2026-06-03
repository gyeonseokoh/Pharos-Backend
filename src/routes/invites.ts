import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { WorkspaceRepo } from '../db/repositories/WorkspaceRepo.js'
import { pool } from '../db/client.js'

export const invitesRouter = Router()

const INVITE_TTL_MS = 24 * 60 * 60 * 1000  // 24시간

// invite_url 형식: obsidian://pharos-join?token=<t>&workspace=<w>
// 프론트 buildInviteUrl() 과 동일한 형식 유지
function buildInviteUrl(token: string, workspaceId: number): string {
    const t = encodeURIComponent(token)
    const w = encodeURIComponent(workspaceId)
    return `obsidian://pharos-join?token=${t}&workspace=${w}`
}

// ─── POST /invites ───────────────────────────────────────────────────────────
// body: { workspace_id, permission, email? }
// owner만 발급 가능. 응답: { token, expires_at, invite_url, permission }
invitesRouter.post('/', requireAuth, async (req: Request, res: Response) => {
    const userId: number = res.locals.user.sub
    const { workspace_id, permission, email } = req.body as {
        workspace_id?: number
        permission?: string
        email?: string
    }

    if (!workspace_id || !permission) {
        res.status(400).json({ error: 'workspace_id and permission are required' })
        return
    }
    if (!['READ', 'WRITE', 'ADMIN'].includes(permission)) {
        res.status(400).json({ error: 'permission must be READ, WRITE, or ADMIN' })
        return
    }

    const workspace = await WorkspaceRepo.findById(workspace_id)
    if (!workspace) {
        res.status(404).json({ error: 'Workspace not found' })
        return
    }
    if (workspace.owner_id !== userId) {
        res.status(403).json({ error: 'Only the workspace owner can issue invites' })
        return
    }

    const token      = crypto.randomUUID()
    const expires_at = new Date(Date.now() + INVITE_TTL_MS).toISOString()

    await pool.query(
        `INSERT INTO invites (workspace_id, token, permission, email, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [workspace_id, token, permission, email ?? null, expires_at]
    )

    res.status(201).json({
        token,
        expires_at,
        invite_url: buildInviteUrl(token, workspace_id),
        permission,
    })
})

// ─── POST /invites/:token/consume ────────────────────────────────────────────
// requireAuth. 일회용 소비 + workspace_members 등록.
// 응답: { workspace_id }
// ※ GET /:token 보다 먼저 등록해야 Express가 'consume'을 토큰값으로 오해하지 않음
invitesRouter.post('/:token/consume', requireAuth, async (req: Request, res: Response) => {
    const userId: number = res.locals.user.sub
    const { token } = req.params

    const { rows } = await pool.query<{
        workspace_id: number
        expires_at:   string
        accepted_at:  string | null
    }>(
        `SELECT workspace_id, expires_at, accepted_at FROM invites WHERE token = $1`,
        [token]
    )

    if (rows.length === 0) {
        res.status(404).json({ error: 'Invite not found' })
        return
    }

    const invite = rows[0]

    if (invite.accepted_at !== null) {
        res.status(410).json({ error: 'Invite already used' })
        return
    }
    if (new Date(invite.expires_at) < new Date()) {
        res.status(410).json({ error: 'Invite expired' })
        return
    }

    // 단일 클라이언트 트랜잭션:
    // addMember(INSERT ... ON CONFLICT DO NOTHING) + UPDATE accepted_at 을 함께 처리.
    // WorkspaceRepo.addMember()는 pool.query()를 사용해 별도 커넥션이므로
    // 트랜잭션 안전을 위해 인라인 SQL로 직접 실행.
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        await client.query(
            `INSERT INTO workspace_members (workspace_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (workspace_id, user_id) DO NOTHING`,
            [invite.workspace_id, userId]
        )
        await client.query(
            `UPDATE invites SET accepted_at = NOW() WHERE token = $1`,
            [token]
        )
        await client.query('COMMIT')
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('[invites] consume error:', err)
        res.status(500).json({ error: 'Failed to consume invite' })
        return
    } finally {
        client.release()
    }

    res.json({ workspace_id: invite.workspace_id })
})

// ─── GET /invites ─────────────────────────────────────────────────────────────
// requireAuth, owner 검증. 미소비·미만료 초대 목록.
// query: ?workspace_id=N
// 응답: { invites: Array<{ token, expiresAt, inviteUrl, permission }> }
// camelCase 키 — 프론트 IssuedInvite 인터페이스와 일치
invitesRouter.get('/', requireAuth, async (req: Request, res: Response) => {
    const userId      = res.locals.user.sub as number
    const workspaceId = Number(req.query.workspace_id)

    if (!workspaceId) {
        res.status(400).json({ error: 'workspace_id query param is required' })
        return
    }

    const workspace = await WorkspaceRepo.findById(workspaceId)
    if (!workspace) {
        res.status(404).json({ error: 'Workspace not found' })
        return
    }
    if (workspace.owner_id !== userId) {
        res.status(403).json({ error: 'Only the workspace owner can list invites' })
        return
    }

    const { rows } = await pool.query<{
        token:      string
        permission: string
        expires_at: string
    }>(
        `SELECT token, permission, expires_at
           FROM invites
          WHERE workspace_id = $1
            AND accepted_at  IS NULL
            AND expires_at   > NOW()
          ORDER BY created_at DESC`,
        [workspaceId]
    )

    res.json({
        invites: rows.map(r => ({
            token:      r.token,
            expiresAt:  r.expires_at,
            inviteUrl:  buildInviteUrl(r.token, workspaceId),
            permission: r.permission,
        })),
    })
})

// ─── GET /invites/:token ─────────────────────────────────────────────────────
// 인증 불필요. 토큰 검증용 (팀원 링크 클릭 시).
// 소비됨·만료: 410 / 없음: 404 / 정상: 200
invitesRouter.get('/:token', async (req: Request, res: Response) => {
    const { token } = req.params

    const { rows } = await pool.query<{
        token:        string
        permission:   string
        workspace_id: number
        expires_at:   string
        accepted_at:  string | null
    }>(
        `SELECT token, permission, workspace_id, expires_at, accepted_at
           FROM invites WHERE token = $1`,
        [token]
    )

    if (rows.length === 0) {
        res.status(404).json({ error: 'Invite not found' })
        return
    }

    const invite = rows[0]

    if (invite.accepted_at !== null) {
        res.status(410).json({ error: 'Invite already used' })
        return
    }
    if (new Date(invite.expires_at) < new Date()) {
        res.status(410).json({ error: 'Invite expired' })
        return
    }

    res.json({
        token:        invite.token,
        permission:   invite.permission,
        workspace_id: invite.workspace_id,
        expires_at:   invite.expires_at,
    })
})

// ─── DELETE /invites/:token ──────────────────────────────────────────────────
// requireAuth, owner 검증. 미소비 초대 강제 취소.
// 응답: 204 No Content
invitesRouter.delete('/:token', requireAuth, async (req: Request, res: Response) => {
    const userId: number = res.locals.user.sub
    const { token }      = req.params

    // 토큰으로 workspace 조회 후 owner 검증
    const { rows } = await pool.query<{ workspace_id: number }>(
        `SELECT workspace_id FROM invites WHERE token = $1`,
        [token]
    )
    if (rows.length === 0) {
        res.status(404).json({ error: 'Invite not found' })
        return
    }

    const workspace = await WorkspaceRepo.findById(rows[0].workspace_id)
    if (!workspace || workspace.owner_id !== userId) {
        res.status(403).json({ error: 'Only the workspace owner can revoke invites' })
        return
    }

    await pool.query(`DELETE FROM invites WHERE token = $1`, [token])
    res.status(204).send()
})