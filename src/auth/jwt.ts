import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export interface JwtPayload {
  sub:   number   // users.id
  login: string   // GitHub login
}

const EXPIRES_IN = '7d' // 7일 후 만료

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: EXPIRES_IN })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload & JwtPayload
    return { sub: decoded.sub as number, login: decoded.login }
  } catch {
    return null
  }
}