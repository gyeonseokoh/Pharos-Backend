import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import WebSocket from 'ws'

const SERVER_URL = 'ws://localhost:1234'
const DOC_NAME   = 'sync-test'
const TIMEOUT_MS = 10_000

function waitForSync(
    name: string
): Promise<{ provider: HocuspocusProvider; doc: Y.Doc }> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`[${name}] sync timeout`)),
            TIMEOUT_MS
        )

        const doc = new Y.Doc()

        const provider = new HocuspocusProvider({
            url: SERVER_URL,
            name: DOC_NAME,
            document: doc,
            token: 'test-token',
            
            onSynced() {
                clearTimeout(timer)
                console.log(`[${name}] synced`)
                resolve({ provider, doc })
            },

            onAuthenticationFailed({ reason }: { reason: string }) {
                clearTimeout(timer)
                reject(new Error(`[${name}] auth failed: ${reason}`))
            },
        })

        
        // provider 생성 직후 uncaught error 포착
        provider.on('error', (err: unknown) => {
            clearTimeout(timer)
            reject(err)
        })
    })
}


async function main(): Promise<void> {
    console.log(`----- PoC 테스트 시작 -----`)

    // 클라A 연결 + 초기 sync
    const { provider: providerA, doc: docA } = await waitForSync('A')

    // 클라A 텍스트 삽입
    const textA = docA.getText('content')
    textA.insert(0, 'Hello! (from A)')
    console.log(`A inserted:`, textA.toString())

    // 클라B 연결 + 서버에서 현재 상태를 받아 sync
    const { provider: providerB, doc: docB } = await waitForSync('B')
    // 서버 메모리의 Y.Doc 상태가 B에게 전파됨
    await new Promise<void>((r) => setTimeout(r, 300))
    const textB = docB.getText('content')
    
    // 동기화 결과
    console.log('\n───────────────────────────────────────────────')
    console.log('[A] text :', JSON.stringify(textA.toString()))
    console.log('[B] text :', JSON.stringify(textB.toString()))

    const pass = textA.toString() === textB.toString() && textA.toString() !== ''
    console.log(pass ? '\n✅  PASS — 동기화 성공' : '\n❌  FAIL — 동기화 실패')
    console.log('───────────────────────────────────────────────\n')


    // 정리
    providerA.destroy()
    providerB.destroy()
    // destroy 후 소켓 닫힘 대기
    await new Promise<void>((r) => setTimeout(r, 300))

    process.exit(pass? 0: 1)
}

main().catch((err) => {
    console.error('에러:', err)
    process.exit(1)
})