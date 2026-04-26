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
    DB_PATH   : requireEnv('DB_PATH'),

    GITHUB_APP_ID:         optionalEnv('GITHUB_APP_ID', ''),
    GITHUB_CLIENT_ID:      optionalEnv('GITHUB_CLIENT_ID', ''),
    GITHUB_CLIENT_SECRET:  optionalEnv('GITHUB_CLIENT_SECRET', ''),
    GITHUB_WEBHOOK_SECRET: optionalEnv('GITHUB_WEBHOOK_SECRET', ''),
    CLIENT_URL:            optionalEnv('CLIENT_URL', 'obsidian://pharos')
} as const

export type Config = typeof config