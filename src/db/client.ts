import Database from 'better-sqlite3'
import { config } from '../config.js'

// DB 연결 싱글턴 — 모듈 로드 시 1회만 생성
export const db = new Database(config.DB_PATH)

// 연결 즉시 적용되어야 하는 PRAGMA
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')