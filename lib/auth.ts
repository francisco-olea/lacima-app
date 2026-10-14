import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'lc-session'

export type AuthUser = {
  id: string
  username: string
  role: 'admin' | 'cashier'
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const result = await db.query<AuthUser>(`
    SELECT u.id, u.username, r.code AS role
    FROM app.user_sessions s
    JOIN app.users u ON u.id = s.user_id
    JOIN app.roles r ON r.id = u.role_id
    WHERE s.token_hash = $1
      AND s.expires_at > now()
      AND u.active = true
  `, [hashToken(token)])

  return result.rows[0] ?? null
}

export function hashSessionToken(token: string) {
  return hashToken(token)
}
