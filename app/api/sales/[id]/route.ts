import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type SaleRow = {
  id: string
  folio: string
  status: string
}

type StockMovementRow = {
  productId: string
  quantity: string
}

type ProductStockRow = {
  stock: string
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user: Awaited<ReturnType<typeof getAuthenticatedUser>>
  try {
    user = await getAuthenticatedUser()
  } catch (error) {
    console.error('DELETE /api/sales/[id] authentication failed', error)
    return NextResponse.json({ error: 'No se pudo validar la sesión' }, { status: 503 })
  }
  if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso para eliminar ventas' }, { status: 403 })
  }

  let body: { confirmation?: unknown } | null
  try {
    body = await request.json() as { confirmation?: unknown } | null
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  if (!body || body.confirmation !== 'Eliminar') {
    return NextResponse.json({ error: 'Escribe Eliminar para confirmar la acción' }, { status: 400 })
  }

  const { id } = await params
  let client: Awaited<ReturnType<typeof db.connect>> | undefined
  try {
    client = await db.connect()
    await client.query('BEGIN')

    const saleResult = await client.query<SaleRow>(
      'SELECT id, folio, status FROM app.sales WHERE id = $1 FOR UPDATE',
      [id],
    )
    const sale = saleResult.rows[0]
    if (!sale) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No se encontró la venta' }, { status: 404 })
    }
    if (sale.status !== 'completed') {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'La venta ya no está disponible para eliminarse' }, { status: 409 })
    }

    const account = await client.query<{ id: string }>(
      'SELECT id FROM app.open_accounts WHERE sale_id = $1 FOR UPDATE',
      [sale.id],
    )
    if (account.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({
        error: 'Esta venta está vinculada a una cuenta abierta y requiere revertir los abonos antes de eliminarse',
      }, { status: 409 })
    }

    const movements = await client.query<StockMovementRow>(`
      SELECT product_id AS "productId", SUM(quantity) AS quantity
      FROM app.inventory_movements
      WHERE reference_type = 'sale'
        AND reference_id = $1
        AND movement_type = 'sale'
      GROUP BY product_id
      ORDER BY product_id
    `, [sale.id])

    for (const movement of movements.rows) {
      const productResult = await client.query<ProductStockRow>(
        'SELECT stock FROM app.products WHERE id = $1 FOR UPDATE',
        [movement.productId],
      )
      const stockBefore = Number(productResult.rows[0].stock)
      const quantity = Number(movement.quantity)
      const stockAfter = stockBefore + quantity
      await client.query(
        'UPDATE app.products SET stock = $1, updated_at = now() WHERE id = $2',
        [stockAfter, movement.productId],
      )
      await client.query(`
        INSERT INTO app.inventory_movements
          (product_id, user_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id, notes)
        VALUES ($1, $2, 'return', $3, $4, $5, 'sale_cancellation', $6, $7)
      `, [
        movement.productId,
        user.id,
        quantity,
        stockBefore,
        stockAfter,
        sale.id,
        `Cancelación de venta ${sale.folio}`,
      ])
    }

    await client.query(
      "UPDATE app.sales SET status = 'cancelled' WHERE id = $1",
      [sale.id],
    )
    await client.query(`
      INSERT INTO app.audit_log (user_id, action, entity_type, entity_id, details)
      VALUES ($1, 'sale.cancelled', 'sale', $2, $3)
    `, [user.id, sale.id, JSON.stringify({ folio: sale.folio })])

    await client.query('COMMIT')
    return NextResponse.json({ id: sale.id, folio: sale.folio })
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    console.error('DELETE /api/sales/[id] failed', error)
    return NextResponse.json({ error: 'No se pudo eliminar la venta' }, { status: 503 })
  } finally {
    client?.release()
  }
}
