import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type UserBody = {
  id?: unknown
  name?: unknown
  password?: unknown
}

function getName(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function validName(name: string) {
  return name.length > 0 && name.length <= 80
}

async function requireAdmin() {
  const user = await getAuthenticatedUser()
  if (!user) return { response: NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 }) }
  if (user.role !== 'admin') return { response: NextResponse.json({ error: 'No tienes permiso para administrar usuarios' }, { status: 403 }) }
  return { user }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const result = await db.query<{ id: string; name: string }>(`
      SELECT u.id, u.full_name AS name
      FROM app.users u
      JOIN app.roles r ON r.id = u.role_id
      WHERE u.active = true AND r.code = 'cashier'
      ORDER BY lower(u.full_name)
    `)
    return NextResponse.json({ users: result.rows })
  } catch (error) {
    console.error('No se pudieron cargar los usuarios', error)
    return NextResponse.json({ error: 'No se pudieron cargar los usuarios' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  let body: UserBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const name = getName(body.name)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!validName(name)) return NextResponse.json({ error: 'Escribe un nombre de hasta 80 caracteres' }, { status: 400 })
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return NextResponse.json({ error: 'La contraseña debe tener entre 8 y 72 bytes' }, { status: 400 })
  }

  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const result = await db.query<{ id: string; name: string }>(`
      INSERT INTO app.users (role_id, username, full_name, password_hash, email)
      SELECT r.id, $1, $1, crypt($2, gen_salt('bf', 12)), NULL
      FROM app.roles r
      WHERE r.code = 'cashier'
      RETURNING id, full_name AS name
    `, [name, password])
    if (!result.rowCount) {
      return NextResponse.json({ error: 'No se encontró el rol de Caja' }, { status: 500 })
    }
    return NextResponse.json({ user: result.rows[0] }, { status: 201 })
  } catch (error) {
    if (isDuplicateUsername(error)) return NextResponse.json({ error: 'Ya existe un usuario con ese nombre' }, { status: 409 })
    console.error('No se pudo crear el usuario', error)
    return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  let body: UserBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  const name = getName(body.name)
  const password = typeof body.password === 'string' && body.password.length > 0 ? body.password : null
  if (!id || !validName(name)) return NextResponse.json({ error: 'Datos de usuario inválidos' }, { status: 400 })
  if (password && (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72)) {
    return NextResponse.json({ error: 'La contraseña debe tener entre 8 y 72 bytes' }, { status: 400 })
  }

  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const result = await db.query<{ id: string; name: string }>(`
      UPDATE app.users u
      SET username = $2,
          full_name = $2,
          password_hash = CASE WHEN $3::text IS NULL THEN u.password_hash ELSE crypt($3, gen_salt('bf', 12)) END,
          updated_at = now()
      FROM app.roles r
      WHERE u.id = $1
        AND u.role_id = r.id
        AND r.code = 'cashier'
        AND u.active = true
      RETURNING u.id, u.full_name AS name
    `, [id, name, password])
    if (!result.rowCount) return NextResponse.json({ error: 'No se encontró el usuario de Caja' }, { status: 404 })
    return NextResponse.json({ user: result.rows[0] })
  } catch (error) {
    if (isDuplicateUsername(error)) return NextResponse.json({ error: 'Ya existe un usuario con ese nombre' }, { status: 409 })
    console.error('No se pudo actualizar el usuario', error)
    return NextResponse.json({ error: 'No se pudo actualizar el usuario' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  let body: UserBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 })

  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    const result = await db.query(`
      WITH deactivated AS (
        UPDATE app.users u
        SET active = false, updated_at = now()
        FROM app.roles r
        WHERE u.id = $1
          AND u.role_id = r.id
          AND r.code = 'cashier'
          AND u.active = true
        RETURNING u.id
      ), revoked AS (
        DELETE FROM app.user_sessions s
        USING deactivated d
        WHERE s.user_id = d.id
      )
      SELECT id FROM deactivated
    `, [id])
    if (!result.rowCount) return NextResponse.json({ error: 'No se encontró el usuario de Caja' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('No se pudo eliminar el usuario', error)
    return NextResponse.json({ error: 'No se pudo eliminar el usuario' }, { status: 503 })
  }
}

function isDuplicateUsername(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
