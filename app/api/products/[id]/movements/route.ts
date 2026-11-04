import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type MovementRow = {
  id: string
  movement_type: string
  quantity: string
  stock_before: string
  stock_after: string
  notes: string | null
  created_at: Date
}

type RouteContext = {
  params: Promise<{ id: string }>
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'No tienes permiso para consultar el historial del inventario' }, { status: 403 })
  const { id } = await context.params
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: 'Producto inválido' }, { status: 400 })
  }

  try {
    const result = await db.query<MovementRow>(`
      SELECT id, movement_type, quantity, stock_before, stock_after, notes, created_at
      FROM app.inventory_movements
      WHERE product_id = $1
      ORDER BY created_at DESC, id DESC
    `, [id])

    return NextResponse.json(result.rows.map((row) => ({
      id: row.id,
      type: row.movement_type,
      quantity: Number(row.quantity),
      stockBefore: Number(row.stock_before),
      stockAfter: Number(row.stock_after),
      reason: row.notes,
      createdAt: row.created_at.toISOString(),
    })), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('GET /api/products/[id]/movements failed', error)
    return NextResponse.json({ error: 'No se pudo consultar el historial del inventario' }, { status: 500 })
  }
}