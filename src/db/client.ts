import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 실행 환경의 상대 경로 추출(경로 깨짐 방지)
const __dirname = path.dirname( // 파일명 제거하고 디렉터리 경로만 추출
    fileURLToPath( // 절대 경로 문자열로 변환
        import.meta.url // file://... 형식의 현재 파일 경로
    )
)
// DB 파일 경로 설정
const DB_PATH = process.env.DB_PATH
    ?? path.join(__dirname, '../../pharos.db')

// Sqilte의 완전 동기형 DB 생성. singleton용 인스턴스.
export const db = new Database(DB_PATH)

// pragma 설정(연결이 열릴 때마다 필요)
db.pragma('journal_mode = WAL') // 동시 읽기/쓰기 성능 향상. 서버 환경 필수.
db.pragma('foreign_keys = ON') // FK 제약 강제. 위반 시 INSERT/UPDATE/DELETE 거부 -> 기본 OFF라 필요.