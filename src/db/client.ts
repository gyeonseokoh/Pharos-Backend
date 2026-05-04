import pkg from 'pg'
import { config } from '../config.js'

const { Pool } = pkg

export const pool = new Pool({ connectionString: config.DB_URL })

pool.on('error', (err) => {
    console.error('[db] idle client error', err)
})