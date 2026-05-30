import { pool } from './client.js'

const SCHEMA = /* sql */`
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL      PRIMARY KEY,
  github_id     INTEGER     NOT NULL UNIQUE,
  login         TEXT        NOT NULL,
  access_token  TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        NOT NULL,
  owner_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id  INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       INTEGER     NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  role          TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS repo_links (
  id               SERIAL      PRIMARY KEY,
  workspace_id     INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  github_repo_id   INTEGER     NOT NULL,
  full_name        TEXT        NOT NULL,
  installation_id  INTEGER     NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, github_repo_id)
);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id              SERIAL      PRIMARY KEY,
  repo_link_id    INTEGER     NOT NULL REFERENCES repo_links(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'done', 'failed')),
  triggered_by    TEXT        NOT NULL CHECK (triggered_by IN ('webhook', 'cron', 'manual')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL      PRIMARY KEY,
  -- documentName 형식: "{workspaceId}/{filePath}"
  -- 예: "3/Pharos/tasks/TASK-1.md"
  document_name TEXT        NOT NULL UNIQUE,
  -- Hocuspocus가 인코딩한 Yjs 상태 바이너리 (Y.encodeStateAsUpdate 결과)
  yjs_state     BYTEA       NOT NULL,
  workspace_id  INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invites (
  id            SERIAL      PRIMARY KEY,
  workspace_id  INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token         TEXT        NOT NULL UNIQUE,
  -- 초대받을 GitHub 로그인명. NULL이면 누구나 수락 가능.
  invitee_login TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export async function migrate(): Promise<void> {
    await pool.query(SCHEMA)
    console.log('[db] migration complete')
}