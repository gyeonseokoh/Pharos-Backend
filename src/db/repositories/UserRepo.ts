import { pool } from '../client.js'

export interface User {
    id:           number
    github_id:    number
    login:        string
    access_token: string
    created_at:   string
    updated_at:   string
}

export interface UpsertUserParams {
    github_id:    number
    login:        string
    access_token: string
}

export const UserRepo = {
    async upsert(params: UpsertUserParams): Promise<User> {
        const { rows } = await pool.query<User>(`
            INSERT INTO users (github_id, login, access_token)
            VALUES ($1, $2, $3)
            ON CONFLICT (github_id) DO UPDATE SET
                login        = EXCLUDED.login,
                access_token = EXCLUDED.access_token,
                updated_at   = NOW()
            RETURNING *
        `, [params.github_id, params.login, params.access_token])
        return rows[0]
    },

    async findById(id: number): Promise<User | undefined> {
        const { rows } = await pool.query<User>(
            `SELECT * FROM users WHERE id = $1`, [id]
        )
        return rows[0]
    },

    async findByGithubId(github_id: number): Promise<User | undefined> {
        const { rows } = await pool.query<User>(
            `SELECT * FROM users WHERE github_id = $1`, [github_id]
        )
        return rows[0]
    },
}