PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id     INTEGER NOT NULL UNIQUE,
  login         TEXT    NOT NULL,
  access_token  TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS workspaces (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  role          TEXT    NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS repo_links (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id     INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  github_repo_id   INTEGER NOT NULL,
  full_name        TEXT    NOT NULL,
  installation_id  INTEGER NOT NULL,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (workspace_id, github_repo_id)
);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_link_id    INTEGER NOT NULL REFERENCES repo_links(id) ON DELETE CASCADE,
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'done', 'failed')),
  triggered_by    TEXT    NOT NULL CHECK (triggered_by IN ('webhook', 'cron', 'manual')),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at    TEXT
);