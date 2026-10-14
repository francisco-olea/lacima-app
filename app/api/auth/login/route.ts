import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashSessionToken, SESSION_COOKIE } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) {
    return NextResponse.json({ error: 'Escribe tu usuario y contraseña' }, { status: 400 })
  }

  try {
    const result = await db.query<{ id: string; username: string; role: 'admin' | 'cashier' }>(`
      SELECT u.id, u.username, r.code AS role
      FROM app.users u
      JOIN app.roles r ON r.id = u.role_id
      WHERE lower(u.username) = lower($1)
        AND u.active = true
        AND r.code IN ('admin', 'cashier')
        AND u.password_hash = crypt($2, u.password_hash)
      LIMIT 1
    `, [username, password])
    const user = result.rows[0]
    if (!user) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }

    const token = randomBytes(32).toString('hex')
    await db.query(`
      INSERT INTO app.user_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, now() + interval '30 days')
    `, [user.id, hashSessionToken(token)])
    await db.query('UPDATE app.users SET last_login_at = now() WHERE id = $1', [user.id])

    const response = NextResponse.json({ username: user.username, role: user.role })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  } catch (error) {
    console.error('No se pudo iniciar sesión', error)
    return NextResponse.json({ error: 'No se pudo conectar con el servidor' }, { status: 503 })
  }
}
