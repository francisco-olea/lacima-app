import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
    return NextResponse.json({ username: user.username, role: user.role })
  } catch (error) {
    console.error('No se pudo validar la sesión', error)
    return NextResponse.json({ error: 'No se pudo validar la sesión' }, { status: 503 })
  }
}
