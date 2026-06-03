import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { WorkspaceRepo } from '../db/repositories/WorkspaceRepo.js'

export const workspacesRouter = Router()

// ─── POST /workspaces ────────────────────────────────────────────────────────
// body: { name: string }
// 워크스페이스 생성 + owner 자동 member 등록 (WorkspaceRepo.create 내 트랜잭션)
// 응답: { id, name, created_at }
workspacesRouter.post('/', requireAuth, async (req: Request, res: Response) => {
    const userId: number = res.locals.user.sub
    const { name } = req.body as { name?: string }

    if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'name is required' })
        return
    }

    try {
        const workspace = await WorkspaceRepo.create({
            name: name.trim(),
            owner_id: userId,
        })
        res.status(201).json({
            id:         workspace.id,
            name:       workspace.name,
            created_at: workspace.created_at,
        })
    } catch (err) {
        console.error('[workspaces] POST / error:', err)
        res.status(500).json({ error: 'Failed to create workspace' })
    }
})

// ─── GET /workspaces/mine ────────────────────────────────────────────────────
// 내가 owner 인 워크스페이스 목록 반환
// 응답: { workspaces: Array<{ id, name, created_at }> }
workspacesRouter.get('/mine', requireAuth, async (req: Request, res: Response) => {
    const userId: number = res.locals.user.sub

    try {
        const workspaces = await WorkspaceRepo.findByOwner(userId)
        res.json({
            workspaces: workspaces.map(w => ({
                id:         w.id,
                name:       w.name,
                created_at: w.created_at,
            })),
        })
    } catch (err) {
        console.error('[workspaces] GET /mine error:', err)
        res.status(500).json({ error: 'Failed to fetch workspaces' })
    }
})