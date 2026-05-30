import { Hocuspocus } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { verifyToken } from './auth/jwt.js'
import { pool } from './db/client.js'

/** onAuthenticate가 반환하는 context 타입 */
export interface HocuspocusContext {
    userId:      number
    login:       string
    workspaceId: number
}

function parseWorkspaceId(documentName: string): number | null {
    const slash = documentName.indexOf('/')
    if (slash === -1) return null
    const id = Number(documentName.slice(0, slash))
    return Number.isInteger(id) && id > 0 ? id : null
}

/** __trigger__ 채널은 DB 저장 대상 제외 */
function isTriggerChannel(documentName: string): boolean {
    return documentName.endsWith('/__trigger__')
}

export const hocuspocus = new Hocuspocus({
    name: 'pharos-server',
    debounce: 2000,
    maxDebounce: 10_000,

    extensions: [
        new Database({
            // ── fetch: 문서 로드 시 DB에서 Yjs 바이너리 복원 ──────────
            async fetch({ documentName }) {
                if (isTriggerChannel(documentName)) return null

                const { rows } = await pool.query<{ yjs_state: Buffer }>(
                    `SELECT yjs_state
                       FROM documents
                      WHERE document_name = $1`,
                    [documentName]
                )
                if (rows.length === 0) return null

                console.log(`[db] fetch "${documentName}" (${rows[0].yjs_state.byteLength} bytes)`)
                return new Uint8Array(rows[0].yjs_state)
            },

            // ── store: debounce 후 Yjs 상태 UPSERT ───────────────────
            async store({ documentName, state, lastContext }) {
                if (isTriggerChannel(documentName)) return

                const workspaceId = parseWorkspaceId(documentName)
                if (workspaceId === null) return

                // context는 onAuthenticate가 반환한 HocuspocusContext
                const ctx = lastContext as HocuspocusContext | undefined
                const wsId = ctx?.workspaceId ?? workspaceId

                await pool.query(
                    `INSERT INTO documents (document_name, yjs_state, workspace_id, updated_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (document_name) DO UPDATE SET
                         yjs_state    = EXCLUDED.yjs_state,
                         workspace_id = EXCLUDED.workspace_id,
                         updated_at   = NOW()`,
                    [documentName, state, wsId]
                )
                console.log(`[db] store "${documentName}" (${state.byteLength} bytes)`)
            },
        }),
    ],

    async onAuthenticate(data): Promise<HocuspocusContext> {
        const payload = verifyToken(data.token)
        if (!payload) {
            throw new Error('Unauthorized: invalid or expired token')
        }

        const workspaceId = parseWorkspaceId(data.documentName)
        if (workspaceId === null) {
            throw new Error(`Unauthorized: malformed documentName "${data.documentName}"`)
        }

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
    },
})