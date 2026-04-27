import { migrate } from '../src/db/migrate.js'
import { UserRepo } from '../src/db/repositories/UserRepo.js'
import { WorkspaceRepo } from '../src/db/repositories/WorkspaceRepo.js'
import { RepoLinkRepo } from '../src/db/repositories/RepoLinkRepo.js'
import { db } from '../src/db/client.js'

// 테스트용 인메모리 DB 사용을 위해 DB_PATH를 :memory:로 설정
process.env['DB_PATH'] = ':memory:'

migrate()

let pass = true

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✅ ${label}`)
  } else {
    console.error(`  ❌ ${label}`)
    pass = false
  }
}

console.log('\n── S2-C: Repository 레이어 검증 ────────────────\n')

// ── UserRepo ──────────────────────────────────────────
console.log('[UserRepo]')

const user = UserRepo.upsert({ github_id: 1001, login: 'alice', access_token: 'token-a' })
assert('upsert: id 존재',          typeof user.id === 'number')
assert('upsert: login 일치',       user.login === 'alice')

const updated = UserRepo.upsert({ github_id: 1001, login: 'alice-renamed', access_token: 'token-b' })
assert('upsert: 중복 시 업데이트', updated.login === 'alice-renamed')
assert('upsert: created_at 보존',  updated.created_at === user.created_at)

const found = UserRepo.findById(user.id)
assert('findById: 조회 성공',      found?.login === 'alice-renamed')

const foundByGh = UserRepo.findByGithubId(1001)
assert('findByGithubId: 조회 성공', foundByGh?.id === user.id)

// ── WorkspaceRepo ─────────────────────────────────────
console.log('\n[WorkspaceRepo]')

const ws = WorkspaceRepo.create({ name: 'pharos-team', owner_id: user.id })
assert('create: id 존재',          typeof ws.id === 'number')
assert('create: name 일치',        ws.name === 'pharos-team')

const members = WorkspaceRepo.getMembers(ws.id)
assert('create: owner 자동 등록',  members.length === 1 && members[0].role === 'owner')

const user2 = UserRepo.upsert({ github_id: 1002, login: 'bob', access_token: 'token-c' })
WorkspaceRepo.addMember({ workspace_id: ws.id, user_id: user2.id })
WorkspaceRepo.addMember({ workspace_id: ws.id, user_id: user2.id }) // 중복 — 무시
const members2 = WorkspaceRepo.getMembers(ws.id)
assert('addMember: 중복 무시',     members2.length === 2)

const byOwner = WorkspaceRepo.findByOwner(user.id)
assert('findByOwner: 조회 성공',   byOwner.length === 1)

// ── RepoLinkRepo ──────────────────────────────────────
console.log('\n[RepoLinkRepo]')

const repo = RepoLinkRepo.create({
  workspace_id:    ws.id,
  github_repo_id:  9001,
  full_name:       'pharos-org/pharos',
  installation_id: 42,
})
assert('create: id 존재',          typeof repo.id === 'number')
assert('create: full_name 일치',   repo.full_name === 'pharos-org/pharos')

const repos = RepoLinkRepo.findByWorkspace(ws.id)
assert('findByWorkspace: 1건 조회', repos.length === 1)

// ── 결과 ──────────────────────────────────────────────
console.log('\n────────────────────────────────────────────────')
console.log(pass ? '✅  PASS — S2-C 완료' : '❌  FAIL')
console.log('────────────────────────────────────────────────\n')

db.close()
process.exit(pass ? 0 : 1)