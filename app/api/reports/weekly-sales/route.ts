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

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permiso para consultar los reportes' }, { status: 403 })
    }

    const selectedDate = new URL(request.url).searchParams.get('date')
    if (!isValidDate(selectedDate)) {
      return NextResponse.json({ error: 'Selecciona una fecha válida para la semana' }, { status: 400 })
    }

    const weekStartDate = new Date(`${selectedDate}T00:00:00.000Z`)
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() - ((weekStartDate.getUTCDay() + 6) % 7))
    const weekStart = weekStartDate.toISOString().slice(0, 10)
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() + 6)
    const weekEnd = weekStartDate.toISOString().slice(0, 10)

    const salesResult = await db.query<SaleRow>(`
      WITH week AS (
        SELECT date_trunc('week', $1::date)::date AS starts_on
      )
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
      CROSS JOIN week
      WHERE s.status = 'completed'
        AND s.sold_at >= (week.starts_on::timestamp AT TIME ZONE 'America/Mexico_City')
        AND s.sold_at < ((week.starts_on + 7)::timestamp AT TIME ZONE 'America/Mexico_City')
      ORDER BY s.sold_at DESC
    `, [weekStart])

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
    return NextResponse.json({
      weekStart,
      weekEnd,
      sales,
      total: sales.reduce((sum, sale) => sum + sale.total, 0),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/reports/weekly-sales failed', error)
    return NextResponse.json({ error: 'No se pudieron consultar las ventas de la semana' }, { status: 503 })
  }
}
