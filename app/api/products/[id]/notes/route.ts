import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type NoteRow = {
  id: string
  note: string
  created_at: Date
}

type RouteContext = {
  params: Promise<{ id: string }>
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getProductId(context: RouteContext) {
  const { id } = await context.params
  return uuidPattern.test(id) ? id : null
}

export async function GET(_request: Request, context: RouteContext) {
  const productId = await getProductId(context)
  if (!productId) {
    return NextResponse.json({ error: 'Artículo inválido' }, { status: 400 })
  }

  try {
    const product = await db.query(
      'SELECT id FROM app.products WHERE id = $1 AND active = true',
      [productId],
    )
    if (product.rowCount === 0) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    }

    const result = await db.query<NoteRow>(`
      SELECT id, note, created_at
      FROM app.product_notes
      WHERE product_id = $1
      ORDER BY created_at DESC, id DESC
    `, [productId])

    return NextResponse.json(result.rows.map((row) => ({
      id: row.id,
      note: row.note,
      createdAt: row.created_at.toISOString(),
    })), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('GET /api/products/[id]/notes failed', error)
    return NextResponse.json({ error: 'No se pudieron consultar las notas del artículo' }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  const productId = await getProductId(context)
  if (!productId) {
    return NextResponse.json({ error: 'Artículo inválido' }, { status: 400 })
  }

  let body: { note?: string }
  try {
    body = await request.json() as { note?: string }
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!note || note.length > 1000) {
    return NextResponse.json({ error: 'La nota debe tener entre 1 y 1000 caracteres' }, { status: 400 })
  }

  try {
    const result = await db.query<NoteRow>(`
      INSERT INTO app.product_notes (product_id, note)
      SELECT id, $2
      FROM app.products
      WHERE id = $1 AND active = true
      RETURNING id, note, created_at
    `, [productId, note])
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    }

    const savedNote = result.rows[0]
    return NextResponse.json({
      id: savedNote.id,
      note: savedNote.note,
      createdAt: savedNote.created_at.toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/products/[id]/notes failed', error)
    return NextResponse.json({ error: 'No se pudo guardar la nota del artículo' }, { status: 500 })
  }
}
