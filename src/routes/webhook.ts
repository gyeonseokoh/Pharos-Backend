import express from 'express'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { webhooks } from '../lib/githubWebhook.js'

export const webhookRouter = Router()

webhookRouter.post(
    '/',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
        const signature = req.headers['x-hub-signature-256'] as string | undefined
        const eventName = req.headers['x-github-event'] as string | undefined
        const deliveryId = req.headers['x-github-delivery'] as string | undefined

        if (!signature || !eventName || !deliveryId) {
            res.status(400).json({ error: 'missing github headers' })
            return
        }

        try {
            await webhooks.verifyAndReceive({
                id: deliveryId,
                name: eventName as any,
                signature,
                payload: req.body.toString()
            })
            res.status(200).json({ ok: true })
        } catch (err: any) {
            console.error('[webhook] verifyAndReceive failed:', err.message)
            res.status(401).json({ error: 'invalid signature' })
        }
    }
)