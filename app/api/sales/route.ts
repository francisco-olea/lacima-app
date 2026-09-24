import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type SaleItem = {
  sku: string | null
  description: string
  quantity: number
  unitPrice: number
  discountAmount: number
  lineTotal: number
}

type SaleBody = {
  folio: string
  subtotal: number
  discountAmount: number
  total: number
  payersCount: number
  items: SaleItem[]
  payments: { method: 'cash' | 'card' | 'transfer'; amount: number }[]
}

export async function POST(request: Request) {
  const body = await request.json() as SaleBody
  if (!body.folio || !Array.isArray(body.items) || body.items.length === 0 || !Array.isArray(body.payments) || body.payments.length === 0) {
    return NextResponse.json({ error: 'Venta incompleta' }, { status: 400 })
  }

  let client: Awaited<ReturnType<typeof db.connect>> | undefined
  try {
    client = await db.connect()
    await client.query('BEGIN')
    const cashier = await client.query<{ id: string }>(`
      SELECT u.id
      FROM app.users u
      JOIN app.roles r ON r.id = u.role_id
      WHERE u.active = true AND r.code IN ('cashier', 'admin')
      ORDER BY CASE WHEN r.code = 'cashier' THEN 0 ELSE 1 END, u.created_at
      LIMIT 1
    `)
    if (cashier.rowCount === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No hay un usuario activo para registrar la venta' }, { status: 400 })
    }

    const sale = await client.query<{ id: string }>(`
      INSERT INTO app.sales (folio, cashier_id, subtotal, discount_amount, tax_amount, total, payers_count)
      VALUES ($1, $2, $3, $4, 0, $5, $6)
      RETURNING id
    `, [body.folio, cashier.rows[0].id, body.subtotal, body.discountAmount, body.total, Math.max(1, body.payersCount || 1)])

    for (const item of body.items) {
      let productId: string | null = null
      if (item.sku) {
        const product = await client.query<{ id: string; stock: string; track_stock: boolean }>(
          'SELECT id, stock, track_stock FROM app.products WHERE sku = $1 FOR UPDATE',
          [item.sku],
        )
        if (product.rowCount === 0) throw new Error(`Producto no encontrado: ${item.sku}`)
        productId = product.rows[0].id
        if (product.rows[0].track_stock) {
          const stockBefore = Number(product.rows[0].stock)
          if (stockBefore < item.quantity) throw new Error(`Existencias insuficientes para ${item.description}`)
          const stockAfter = stockBefore - item.quantity
          await client.query('UPDATE app.products SET stock = $1, updated_at = now() WHERE id = $2', [stockAfter, productId])
          await client.query(`
            INSERT INTO app.inventory_movements
              (product_id, user_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id)
            VALUES ($1, $2, 'sale', $3, $4, $5, 'sale', $6)
          `, [productId, cashier.rows[0].id, item.quantity, stockBefore, stockAfter, sale.rows[0].id])
        }
      }
      await client.query(`
        INSERT INTO app.sale_items
          (sale_id, product_id, description, sku, quantity, unit_price, discount_amount, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [sale.rows[0].id, productId, item.description, item.sku, item.quantity, item.unitPrice, item.discountAmount, item.lineTotal])
    }

    for (const payment of body.payments) {
      await client.query(`
        INSERT INTO app.sale_payments (sale_id, payment_method, amount)
        VALUES ($1, $2, $3)
      `, [sale.rows[0].id, payment.method, payment.amount])
    }

    await client.query('COMMIT')
    return NextResponse.json({ id: sale.rows[0].id, folio: body.folio }, { status: 201 })
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    const message = error instanceof Error ? error.message : 'No se pudo registrar la venta'
    return NextResponse.json({ error: message }, { status: client ? 400 : 503 })
  } finally {
    client?.release()
  }
}
