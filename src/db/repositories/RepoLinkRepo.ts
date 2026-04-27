import { db } from '../client.js'

export interface RepoLink {
  id:              number
  workspace_id:    number
  github_repo_id:  number
  full_name:       string
  installation_id: number
  created_at:      string
}

export const RepoLinkRepo = {
  create(params: {
    workspace_id:    number
    github_repo_id:  number
    full_name:       string
    installation_id: number
  }): RepoLink {
    return db.prepare<typeof params, RepoLink>(`
      INSERT INTO repo_links
        (workspace_id, github_repo_id, full_name, installation_id)
      VALUES
        ($workspace_id, $github_repo_id, $full_name, $installation_id)
      RETURNING *
    `).get(params)!
  },

  findByWorkspace(workspace_id: number): RepoLink[] {
    return db.prepare<{ workspace_id: number }, RepoLink>(
      `SELECT * FROM repo_links WHERE workspace_id = $workspace_id`
    ).all({ workspace_id })
  },
}