/**
 * devConsole.ts — 개발용 임시 DB 콘솔
 * ⚠️ 데모 완료 후 app.ts에서 마운트 제거 + 이 파일 삭제 필수
 */
import { Router } from 'express'
import type { Request, Response } from 'express'
import { pool } from '../db/client.js'
import { config } from '../config.js'

export const devConsoleRouter = Router()

// 허용 쿼리 접두사 (소문자 trim 기준)
const ALLOWED_PREFIXES = ['select', 'insert', 'update', 'delete', 'with']
// 차단 키워드 (허용 접두사를 통과해도 본문에 있으면 차단)
const BLOCKED_KEYWORDS = ['drop', 'truncate', 'alter', 'create', 'pg_', 'information_schema']

function isSafeQuery(sql: string): boolean {
    const lower = sql.trim().toLowerCase()
    const allowed = ALLOWED_PREFIXES.some(p => lower.startsWith(p))
    if (!allowed) return false
    return !BLOCKED_KEYWORDS.some(kw => lower.includes(kw))
}

const PAGE = (rows: unknown[] | null, cols: string[], error: string, authed: boolean) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Pharos Dev Console</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: monospace; background: #0d1117; color: #c9d1d9; padding: 24px; }
  h2 { color: #58a6ff; margin-bottom: 16px; }
  .warn { color: #f85149; font-size: 12px; margin-bottom: 16px; }
  form { display: flex; flex-direction: column; gap: 8px; max-width: 800px; }
  input[type=password], textarea {
    background: #161b22; border: 1px solid #30363d; color: #c9d1d9;
    border-radius: 6px; padding: 8px 12px; font-family: monospace; font-size: 14px;
  }
  textarea { height: 100px; resize: vertical; }
  button {
    align-self: flex-start; background: #238636; color: #fff;
    border: none; border-radius: 6px; padding: 8px 20px;
    font-size: 14px; cursor: pointer;
  }
  button:hover { background: #2ea043; }
  .error { color: #f85149; margin-top: 12px; font-size: 13px; }
  .result { margin-top: 20px; overflow-x: auto; }
  table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
  th { background: #161b22; color: #58a6ff; padding: 6px 12px; border: 1px solid #30363d; text-align: left; }
  td { padding: 6px 12px; border: 1px solid #30363d; white-space: pre; }
  tr:nth-child(even) td { background: #0d1117; }
  tr:nth-child(odd) td { background: #161b22; }
  .count { color: #8b949e; font-size: 12px; margin-top: 8px; }
</style>
</head>
<body>
<h2>⚠️ Pharos Dev Console</h2>
<p class="warn">개발용 임시 페이지 — SELECT / INSERT / UPDATE / DELETE 만 허용</p>
<form method="POST">
  ${!authed ? `<input type="password" name="secret" placeholder="ADMIN_SECRET 입력" required>` : `<input type="hidden" name="secret" value="__authed__">`}
  <textarea name="sql" placeholder="SQL 쿼리 입력&#10;예: SELECT * FROM users LIMIT 10">${''}</textarea>
  <button type="submit">실행</button>
</form>
${error ? `<p class="error">❌ ${error}</p>` : ''}
${rows ? `
<div class="result">
  <table>
    <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${(r as any)[c] ?? 'NULL'}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <p class="count">${rows.length} row(s) returned</p>
</div>` : ''}
</body></html>`

devConsoleRouter.get('/', (_req: Request, res: Response) => {
    res.send(PAGE(null, [], '', false))
})

devConsoleRouter.post('/', async (req: Request, res: Response) => {
    const { secret, sql } = req.body as { secret?: string; sql?: string }

    // 비밀번호 검증
    if (!config.ADMIN_SECRET || secret !== config.ADMIN_SECRET) {
        res.send(PAGE(null, [], '비밀번호가 틀렸습니다.', false))
        return
    }
    if (!sql?.trim()) {
        res.send(PAGE(null, [], '', true))
        return
    }

    // 쿼리 안전성 검사
    if (!isSafeQuery(sql)) {
        res.send(PAGE(null, [], `허용되지 않는 쿼리입니다: ${sql.trim().split('\n')[0]}`, true))
        return
    }

    try {
        const result = await pool.query(sql)
        const rows = result.rows ?? []
        const cols = rows.length > 0 ? Object.keys(rows[0]) : []
        res.send(PAGE(rows, cols, '', true))
    } catch (e: any) {
        res.send(PAGE(null, [], e.message ?? 'Query error', true))
    }
})