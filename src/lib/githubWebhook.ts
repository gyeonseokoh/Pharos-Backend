import { Webhooks } from '@octokit/webhooks'
import { config } from '../config.js'

export const webhooks = new Webhooks({
    secret: config.GITHUB_WEBHOOK_SECRET
})

// push 이벤트
webhooks.on('push', ({ payload }) => {
    console.log(`[webhook] push → ${payload.repository.full_name} (${payload.ref})`)
    // TODO: 에이전트 트리거
})

// PR 이벤트
webhooks.on('pull_request', ({ payload }) => {
    console.log(`[webhook] pull_request → ${payload.action} #${payload.number}`)
    // TODO: 에이전트 트리거
})

// issue 이벤트
webhooks.on('issues', ({ payload }) => {
    console.log(`[webhook] issues → ${payload.action} #${payload.issue.number}`)
    // TODO: 에이전트 트리거
})

webhooks.onError((error) => {
    console.error('[webhook] error:', error.message)
})