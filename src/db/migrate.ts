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
  document_name TEXT        NOT NULL UNIQUE,
  yjs_state     BYTEA       NOT NULL,
  workspace_id  INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invites (
  id            SERIAL      PRIMARY KEY,
  workspace_id  INTEGER     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token         TEXT        NOT NULL UNIQUE,
  permission    TEXT        NOT NULL DEFAULT 'WRITE'
                CHECK (permission IN ('READ', 'WRITE', 'ADMIN')),
  email         TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

// CREATE TABLE IF NOT EXISTS 는 기존 테이블을 변경하지 않으므로
// invitee_login → permission/email 마이그레이션을 ALTER TABLE로 처리.
// 컬럼이 이미 존재하면 오류 없이 넘어가도록 DO $$ ... EXCEPTION WHEN duplicate_column 사용.
const ALTER_INVITES = /* sql */`
DO $$
BEGIN
  -- invitee_login 제거 (구버전 컬럼)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invites' AND column_name = 'invitee_login'
  ) THEN
    ALTER TABLE invites DROP COLUMN invitee_login;
  END IF;

  -- permission 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invites' AND column_name = 'permission'
  ) THEN
    ALTER TABLE invites
      ADD COLUMN permission TEXT NOT NULL DEFAULT 'WRITE'
      CHECK (permission IN ('READ', 'WRITE', 'ADMIN'));
  END IF;

  -- email 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invites' AND column_name = 'email'
  ) THEN
    ALTER TABLE invites ADD COLUMN email TEXT;
  END IF;
END $$;
`

export async function migrate(): Promise<void> {
    await pool.query(SCHEMA)
    await pool.query(ALTER_INVITES)
    console.log('[db] migration complete')
}