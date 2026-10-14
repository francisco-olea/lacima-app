import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { hashSessionToken, SESSION_COOKIE } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  try {
    if (token) {
      await db.query('DELETE FROM app.user_sessions WHERE token_hash = $1', [hashSessionToken(token)])
    }
    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
    return response
  } catch (error) {
    console.error('No se pudo cerrar sesión', error)
    return NextResponse.json({ error: 'No se pudo cerrar sesión' }, { status: 503 })
  }
}
