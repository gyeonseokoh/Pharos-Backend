import { db } from '../client.js'

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
  upsert(params: UpsertUserParams): User {
    return db.prepare<UpsertUserParams, User>(`
      INSERT INTO users (github_id, login, access_token)
      VALUES ($github_id, $login, $access_token)
      ON CONFLICT (github_id) DO UPDATE SET
        login        = excluded.login,
        access_token = excluded.access_token,
        updated_at   = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      RETURNING *
    `).get(params)!
  },

  findById(id: number): User | undefined {
    return db.prepare<{ id: number }, User>(
      `SELECT * FROM users WHERE id = $id`
    ).get({ id })
  },

  findByGithubId(github_id: number): User | undefined {
    return db.prepare<{ github_id: number }, User>(
      `SELECT * FROM users WHERE github_id = $github_id`
    ).get({ github_id })
  },
}