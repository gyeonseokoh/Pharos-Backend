import { Hocuspocus } from '@hocuspocus/server'
import { verifyToken } from './auth/jwt.js'
import { pool } from './db/client.js'

/** onAuthenticate가 반환하는 context 타입 */
export interface HocuspocusContext {
    userId:      number
    login:       string
    workspaceId: number
}

/**
 * documentName 파싱 유틸.
 * 형식: "{workspaceId}/{나머지}" (예: "3/Pharos/tasks/TASK-1.md")
 * 트리거 채널: "{workspaceId}/__trigger__"
 *
 * @returns workspaceId (숫자) 또는 null (형식 불일치)
 */
function parseWorkspaceId(documentName: string): number | null {
    const slash = documentName.indexOf('/')
    if (slash === -1) return null
    const id = Number(documentName.slice(0, slash))
    return Number.isInteger(id) && id > 0 ? id : null
}

export const hocuspocus = new Hocuspocus({
    name: 'pharos-server',
    debounce: 2000,
    maxDebounce: 10_000,

    async onAuthenticate(data): Promise<HocuspocusContext> {
        // ── 1. JWT 검증 ──────────────────────────────────────────────
        const payload = verifyToken(data.token)
        if (!payload) {
            throw new Error('Unauthorized: invalid or expired token')
        }

        // ── 2. documentName에서 workspaceId 파싱 ────────────────────
        const workspaceId = parseWorkspaceId(data.documentName)
        if (workspaceId === null) {
            throw new Error(`Unauthorized: malformed documentName "${data.documentName}"`)
        }

        // ── 3. workspace_members 멤버십 확인 ────────────────────────
        const { rowCount } = await pool.query(
            `SELECT 1
               FROM workspace_members
              WHERE workspace_id = $1
                AND user_id      = $2
              LIMIT 1`,
            [workspaceId, payload.sub]
        )
        if (!rowCount || rowCount === 0) {
            throw new Error(`Unauthorized: user ${payload.sub} is not a member of workspace ${workspaceId}`)
        }

        console.log(`[auth] ✅ user=${payload.login} workspace=${workspaceId} doc="${data.documentName}"`)

        return { userId: payload.sub, login: payload.login, workspaceId }
    },

    async onConnect({ documentName, socketId }) {
        console.log(`[connect]    doc="${documentName}" socket=${socketId}`)
    },

    async onDisconnect({ documentName, socketId }) {
        console.log(`[disconnect] doc="${documentName}" socket=${socketId}`)
    }
})