import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type ProductRow = { id: string; name: string; sku: string }
type DailySalesRow = { date: string; quantity: string; revenue: string }

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permiso para consultar los reportes' }, { status: 403 })
    }

    const productId = new URL(request.url).searchParams.get('productId')
    if (!productId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
      return NextResponse.json({ error: 'Selecciona un producto válido' }, { status: 400 })
    }

    const month = new URL(request.url).searchParams.get('month')
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: 'Selecciona un mes válido' }, { status: 400 })
    }

    const productResult = await db.query<ProductRow>(`
      SELECT id, name, sku
      FROM app.products
      WHERE id = $1
    `, [productId])
    if (productResult.rowCount === 0) {
      return NextResponse.json({ error: 'No se encontró el producto seleccionado' }, { status: 404 })
    }

    const salesResult = await db.query<DailySalesRow>(`
      SELECT to_char(days.day::date, 'YYYY-MM-DD') AS date,
             COALESCE(SUM(si.quantity), 0) AS quantity,
             COALESCE(SUM(si.line_total), 0) AS revenue
      FROM generate_series(
        $1::date,
        (date_trunc('month', $1::date) + interval '1 month - 1 day')::date,
        interval '1 day'
      ) AS days(day)
      LEFT JOIN app.sales s
        ON s.status = 'completed'
       AND s.sold_at >= (days.day::date::timestamp AT TIME ZONE 'America/Mexico_City')
       AND s.sold_at < ((days.day::date + 1)::timestamp AT TIME ZONE 'America/Mexico_City')
      LEFT JOIN app.sale_items si
        ON si.sale_id = s.id
       AND si.product_id = $2
      GROUP BY days.day
      ORDER BY days.day
    `, [`${month}-01`, productId])

    return NextResponse.json({
      product: {
        id: productResult.rows[0].id,
        nombre: productResult.rows[0].name,
        sku: productResult.rows[0].sku,
      },
      month,
      dailySales: salesResult.rows.map((day) => ({
        fecha: day.date,
        unidades: Number(day.quantity),
        ventas: Number(day.revenue),
      })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/reports/products failed', error)
    return NextResponse.json({ error: 'No se pudieron consultar las ventas del producto' }, { status: 503 })
  }
}
