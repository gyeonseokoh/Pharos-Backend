import { db } from '../client.js'

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
  create(params: { name: string; owner_id: number }): Workspace {
    const workspace = db.prepare<typeof params, Workspace>(`
      INSERT INTO workspaces (name, owner_id)
      VALUES ($name, $owner_id)
      RETURNING *
    `).get(params)!

    // owner를 workspace_members에도 등록
    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (?, ?, 'owner')
    `).run(workspace.id, params.owner_id)

    return workspace
  },

  findById(id: number): Workspace | undefined {
    return db.prepare<{ id: number }, Workspace>(
      `SELECT * FROM workspaces WHERE id = $id`
    ).get({ id })
  },

  findByOwner(owner_id: number): Workspace[] {
    return db.prepare<{ owner_id: number }, Workspace>(
      `SELECT * FROM workspaces WHERE owner_id = $owner_id`
    ).all({ owner_id })
  },

  addMember(params: { workspace_id: number; user_id: number }): WorkspaceMember {
    return db.prepare<typeof params, WorkspaceMember>(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($workspace_id, $user_id, 'member')
      ON CONFLICT (workspace_id, user_id) DO NOTHING
      RETURNING *
    `).get(params)!
  },

  getMembers(workspace_id: number): WorkspaceMember[] {
    return db.prepare<{ workspace_id: number }, WorkspaceMember>(
      `SELECT * FROM workspace_members WHERE workspace_id = $workspace_id`
    ).all({ workspace_id })
  },
}