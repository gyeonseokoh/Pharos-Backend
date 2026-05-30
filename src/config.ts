import 'dotenv/config'

/** 필수 환경변수 가져오기 */
function requireEnv(key: string): string {
    const value = process.env[key]

    if (!value) {
        console.error(`\n[config] 필수 환경 변수 누락: ${key}`)
        console.error(`[config] .env 파일에 ${key}=<값> 추가 필요\n`)
        process.exit(1)
    }

    return value
}

/** 선택적 환경변수 가져오기 */
function optionalEnv(key: string, fallback: string): string {
    return process.env[key] ?? fallback
}

// 환경변수값 메모리 로드
export const config = {
    PORT: +optionalEnv('PORT', '1234'),

    JWT_SECRET: requireEnv('JWT_SECRET'),
    DB_URL    : requireEnv('DB_URL'),

    GITHUB_APP_ID:         optionalEnv('GITHUB_APP_ID', ''),
    GITHUB_CLIENT_ID:      optionalEnv('GITHUB_CLIENT_ID', ''),
    GITHUB_CLIENT_SECRET:  optionalEnv('GITHUB_CLIENT_SECRET', ''),
    GITHUB_WEBHOOK_SECRET: optionalEnv('GITHUB_WEBHOOK_SECRET', ''),

    // ← 수정: 'obsidian://pharos' → 'obsidian://pharos-callback'
    //   auth/jwt.ts의 pharos-callback protocol handler와 일치해야 함
    CLIENT_URL: optionalEnv('CLIENT_URL', 'obsidian://pharos-callback'),

    // ← 수정: 후행 슬래시 제거 — auth.ts에서 URL 조합 시 이중 슬래시 방지
    SERVER_URL: optionalEnv('SERVER_URL', 'https://pharos-backend.onrender.com'),
} as const

export type Config = typeof config