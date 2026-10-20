import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type SaleRow = {
  id: string
  folio: string
  soldAt: string
  total: string
  items: string
  payments: { method: 'cash' | 'card' | 'transfer'; amount: string }[]
}

type HourRow = { hour: number; amount: string }
type LowStockRow = {
  id: string
  name: string
  category: string
  stock: string
  minimumStock: string
}
type SponsorStats = { count: string; usedHours: string; totalHours: string }

const paymentNames = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
} as const

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permiso para consultar los reportes' }, { status: 403 })
    }

    const reportDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const [salesResult, hoursResult, inventoryResult, sponsorsResult] = await Promise.all([
      db.query<SaleRow>(`
        SELECT s.id,
               s.folio,
               s.sold_at AS "soldAt",
               s.total,
               COALESCE((
                 SELECT SUM(si.quantity)
                 FROM app.sale_items si
                 WHERE si.sale_id = s.id
               ), 0) AS items,
               COALESCE((
                 SELECT jsonb_agg(jsonb_build_object(
                   'method', sp.payment_method,
                   'amount', sp.amount
                 ) ORDER BY sp.paid_at)
                 FROM app.sale_payments sp
                 WHERE sp.sale_id = s.id
               ), '[]'::jsonb) AS payments
        FROM app.sales s
        WHERE s.status = 'completed'
          AND s.sold_at >= (($1::date)::timestamp AT TIME ZONE 'America/Mexico_City')
          AND s.sold_at < ((($1::date + 1)::timestamp) AT TIME ZONE 'America/Mexico_City')
        ORDER BY s.sold_at DESC
      `, [reportDate]),
      db.query<HourRow>(`
        SELECT EXTRACT(HOUR FROM s.sold_at AT TIME ZONE 'America/Mexico_City')::int AS hour,
               SUM(s.total) AS amount
        FROM app.sales s
        WHERE s.status = 'completed'
          AND s.sold_at >= (($1::date)::timestamp AT TIME ZONE 'America/Mexico_City')
          AND s.sold_at < ((($1::date + 1)::timestamp) AT TIME ZONE 'America/Mexico_City')
        GROUP BY hour
        ORDER BY hour
      `, [reportDate]),
      db.query<LowStockRow>(`
        SELECT p.id, p.name, c.name AS category, p.stock, p.minimum_stock AS "minimumStock"
        FROM app.products p
        JOIN app.product_categories c ON c.id = p.category_id
        WHERE p.active = true
          AND p.track_stock = true
          AND p.minimum_stock > 0
          AND p.stock <= p.minimum_stock
        ORDER BY p.stock, p.name
      `),
      db.query<SponsorStats>(`
        SELECT COUNT(*) AS count,
               COALESCE(SUM(u.used_hours), 0) AS "usedHours",
               COALESCE(SUM(s.benefit_hours), 0) AS "totalHours"
        FROM app.sponsors s
        LEFT JOIN (
          SELECT sponsor_id, SUM(quantity) AS used_hours
          FROM app.sponsor_benefit_usages
          WHERE benefit_type = 'court_hours'
          GROUP BY sponsor_id
        ) u ON u.sponsor_id = s.id
        WHERE s.active = true
          AND s.starts_on <= (now() AT TIME ZONE 'America/Mexico_City')::date
          AND s.ends_on >= (now() AT TIME ZONE 'America/Mexico_City')::date
      `),
    ])

    const sales = salesResult.rows.map((sale) => ({
      id: sale.id,
      folio: sale.folio,
      fecha: sale.soldAt,
      total: Number(sale.total),
      items: Number(sale.items),
      payments: sale.payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount),
      })),
    }))
    const paymentTotals = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 }
    for (const sale of sales) {
      for (const payment of sale.payments) {
        paymentTotals[paymentNames[payment.method]] += payment.amount
      }
    }

    const sponsorStats = sponsorsResult.rows[0]
    return NextResponse.json({
      date: reportDate,
      sales,
      totals: {
        sales: sales.reduce((sum, sale) => sum + sale.total, 0),
        tickets: sales.length,
        items: sales.reduce((sum, sale) => sum + sale.items, 0),
        payments: paymentTotals,
      },
      salesByHour: hoursResult.rows.map((row) => ({
        hour: Number(row.hour),
        amount: Number(row.amount),
      })),
      lowStockProducts: inventoryResult.rows.map((product) => ({
        id: product.id,
        nombre: product.name,
        categoria: product.category,
        existencias: Number(product.stock),
        inventarioMinimo: Number(product.minimumStock),
      })),
      sponsors: {
        active: Number(sponsorStats.count),
        hoursUsed: Number(sponsorStats.usedHours),
        hoursTotal: Number(sponsorStats.totalHours),
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/reports failed', error)
    return NextResponse.json({ error: 'No se pudieron consultar los reportes' }, { status: 503 })
  }
}
