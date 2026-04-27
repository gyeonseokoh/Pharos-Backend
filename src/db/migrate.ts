import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { db } from './client.js'

export function migrate(): void {
  const __filename = fileURLToPath(import.meta.url)
  const __dir      = dirname(__filename)
  const sql        = readFileSync(join(__dir, 'schema.sql'), 'utf-8')

  db.exec(sql)
  console.log('[db] migration complete')
}