import { Hocuspocus } from '@hocuspocus/server'

export const hocuspocus = new Hocuspocus({
    name: 'pharos-server',
    debounce: 2000,
    maxDebounce: 10_000,

    async onAuthenticate(_data) {
        // 연결 요청 시 인증 절차
        // 현재는 인증 생략. 나중에 JWT 기반으로 추가.
    },

    async onConnect({ documentName, socketId }) {
        console.log(`[connect]    doc="${documentName}" socket=${socketId}`)
    },

    async onDisconnect({ documentName, socketId }) {
        console.log(`[disconnect] doc="${documentName}" socket=${socketId}`)
    }
})