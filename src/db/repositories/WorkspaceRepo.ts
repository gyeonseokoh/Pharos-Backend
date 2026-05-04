import { pool } from '../client.js'

export interface Workspace {
    id:         number
    name:       string
    owner_id:   number
    created_at: string
}

export interface WorkspaceMember {
    workspace_id: number
    user_id:      number
    role:         'owner' | 'member'
    joined_at:    string
}

export const WorkspaceRepo = {
    async create(params: { name: string; owner_id: number }): Promise<Workspace> {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const { rows } = await client.query<Workspace>(`
                INSERT INTO workspaces (name, owner_id)
                VALUES ($1, $2)
                RETURNING *
            `, [params.name, params.owner_id])
            const workspace = rows[0]
            await client.query(`
                INSERT INTO workspace_members (workspace_id, user_id, role)
                VALUES ($1, $2, 'owner')
            `, [workspace.id, params.owner_id])
            await client.query('COMMIT')
            return workspace
        } catch (err) {
            await client.query('ROLLBACK')
            throw err
        } finally {
            client.release()
        }
    },

    async findById(id: number): Promise<Workspace | undefined> {
        const { rows } = await pool.query<Workspace>(
            `SELECT * FROM workspaces WHERE id = $1`, [id]
        )
        return rows[0]
    },

    async findByOwner(owner_id: number): Promise<Workspace[]> {
        const { rows } = await pool.query<Workspace>(
            `SELECT * FROM workspaces WHERE owner_id = $1`, [owner_id]
        )
        return rows
    },

    async addMember(params: { workspace_id: number; user_id: number }): Promise<WorkspaceMember | undefined> {
        const { rows } = await pool.query<WorkspaceMember>(`
            INSERT INTO workspace_members (workspace_id, user_id, role)
            VALUES ($1, $2, 'member')
            ON CONFLICT (workspace_id, user_id) DO NOTHING
            RETURNING *
        `, [params.workspace_id, params.user_id])
        return rows[0]
    },

    async getMembers(workspace_id: number): Promise<WorkspaceMember[]> {
        const { rows } = await pool.query<WorkspaceMember>(
            `SELECT * FROM workspace_members WHERE workspace_id = $1`, [workspace_id]
        )
        return rows
    },
}