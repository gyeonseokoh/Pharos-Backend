import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../db/client.js'
import * as Y from 'yjs'

export const syncRouter = Router()

// ─── POST /sync/batch ────────────────────────────────────────────────────────
// body: { workspaceId: number, items: Array<{ documentName: string, yjsState: string }> }
// 각 item: DB row 없으면 INSERT / 있으면 Y.applyUpdate 후 UPSERT
syncRouter.post('/batch', requireAuth, async (req: Request, res: Response) => {
    const userId: number = res.locals.user.sub

    const { workspaceId, items } = req.body as {
        workspaceId: number
        items: Array<{ documentName: string; yjsState: string }>
    }

    if (!workspaceId || !Array.isArray(items)) {
        res.status(400).json({ error: 'workspaceId and items are required' })
        return
    }

    // 멤버십 확인
    const { rowCount } = await pool.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId]
    )
    if (!rowCount) {
        res.status(403).json({ error: 'Not a member of this workspace' })
        return
    }

    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        for (const item of items) {
            const incoming = new Uint8Array(Buffer.from(item.yjsState, 'base64'))

            // 기존 row 조회
            const { rows } = await client.query<{ yjs_state: Buffer }>(
                `SELECT yjs_state FROM documents WHERE document_name = $1`,
                [item.documentName]
            )

            let merged: Uint8Array

            if (rows.length === 0) {
                // 신규 문서 — incoming 그대로 저장
                merged = incoming
            } else {
                // 기존 문서 — Y.applyUpdate로 병합 (서버 변경 보존)
                const doc = new Y.Doc()
                Y.applyUpdate(doc, new Uint8Array(rows[0].yjs_state))
                Y.applyUpdate(doc, incoming)
                merged = Y.encodeStateAsUpdate(doc)
                doc.destroy()
            }

            await client.query(
                `INSERT INTO documents (document_name, yjs_state, workspace_id, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (document_name)
                 DO UPDATE SET yjs_state = $2, updated_at = NOW()`,
                [item.documentName, Buffer.from(merged), workspaceId]
            )
        }

        await client.query('COMMIT')
        res.json({ ok: true, synced: items.length })
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('[sync] POST /batch error:', err)
        res.status(500).json({ error: 'Batch sync failed' })
    } finally {
        client.release()
    }
})

// ─── GET /sync/batch ─────────────────────────────────────────────────────────
// query: workspaceId=N
// 응답: { items: Array<{ documentName: string, yjsState: string /* base64 */ }> }
syncRouter.get('/batch', requireAuth, async (req: Request, res: Response) => {
    const userId: number = res.locals.user.sub
    const workspaceId = Number(req.query.workspaceId)

    if (!workspaceId) {
        res.status(400).json({ error: 'workspaceId is required' })
        return
    }

    // 멤버십 확인
    const { rowCount } = await pool.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId]
    )
    if (!rowCount) {
        res.status(403).json({ error: 'Not a member of this workspace' })
        return
    }

    const { rows } = await pool.query<{ document_name: string; yjs_state: Buffer }>(
        `SELECT document_name, yjs_state
           FROM documents
          WHERE workspace_id = $1
            AND document_name NOT LIKE '%/__trigger__'`,
        [workspaceId]
    )

    const items = rows.map(row => ({
        documentName: row.document_name,
        yjsState:     Buffer.from(row.yjs_state).toString('base64'),
    }))

    res.json({ items })
})