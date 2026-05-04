import { pool } from '../client.js'

export interface RepoLink {
    id:              number
    workspace_id:    number
    github_repo_id:  number
    full_name:       string
    installation_id: number
    created_at:      string
}

export const RepoLinkRepo = {
    async create(params: {
        workspace_id:    number
        github_repo_id:  number
        full_name:       string
        installation_id: number
    }): Promise<RepoLink> {
        const { rows } = await pool.query<RepoLink>(`
            INSERT INTO repo_links
                (workspace_id, github_repo_id, full_name, installation_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [params.workspace_id, params.github_repo_id, params.full_name, params.installation_id])
        return rows[0]
    },

    async findByWorkspace(workspace_id: number): Promise<RepoLink[]> {
        const { rows } = await pool.query<RepoLink>(
            `SELECT * FROM repo_links WHERE workspace_id = $1`, [workspace_id]
        )
        return rows
    },
}