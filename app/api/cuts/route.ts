import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type NumericValue = number | string
type CutPayment = { method: string; amount: NumericValue }
type CutLine = {
  description: string
  quantity: NumericValue
  unitPrice: NumericValue
  lineTotal: NumericValue
}
type CutSale = {
  id: string
  folio: string
  soldAt: string
  total: NumericValue
  items: NumericValue
  payments: CutPayment[]
  lines: CutLine[]
}
type CutRow = {
  id: string
  register: string
  openedBy: string
  closedBy: string | null
  openedAt: string
  closedAt: string
  openingAmount: NumericValue
  closingCash: NumericValue | null
  expectedCash: NumericValue | null
  difference: NumericValue | null
  salesTotal: NumericValue
  payments: CutPayment[]
  sales: CutSale[]
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permiso para consultar los cortes de caja' }, { status: 403 })
    }

    const day = new URL(request.url).searchParams.get('date')
    if (!day || !isDate(day)) {
      return NextResponse.json({ error: 'Selecciona un día válido para consultar los cortes' }, { status: 400 })
    }

    const result = await db.query<CutRow>(`
      SELECT cs.id,
             cr.name AS register,
             opened_by.full_name AS "openedBy",
             closed_by.full_name AS "closedBy",
             cs.opened_at AS "openedAt",
             cs.closed_at AS "closedAt",
             cs.opening_amount AS "openingAmount",
             cs.closing_amount AS "closingCash",
             cs.expected_amount AS "expectedCash",
             cs.difference_amount AS difference,
             COALESCE((
               SELECT SUM(s.total)
               FROM app.sales s
               WHERE s.cash_session_id = cs.id AND s.status = 'completed'
             ), 0) AS "salesTotal",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'method', totals.payment_method,
                 'amount', totals.amount
               ) ORDER BY totals.payment_method)
               FROM (
                 SELECT sp.payment_method, SUM(sp.amount) AS amount
                 FROM app.sales s
                 JOIN app.sale_payments sp ON sp.sale_id = s.id
                 WHERE s.cash_session_id = cs.id AND s.status = 'completed'
                 GROUP BY sp.payment_method
               ) totals
             ), '[]'::jsonb) AS payments,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'id', s.id,
                 'folio', s.folio,
                 'soldAt', s.sold_at,
                 'total', s.total,
                 'items', COALESCE((
                   SELECT SUM(si.quantity)
                   FROM app.sale_items si
                   WHERE si.sale_id = s.id
                 ), 0),
                 'payments', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                     'method', sp.payment_method,
                     'amount', sp.amount
                   ) ORDER BY sp.paid_at)
                   FROM app.sale_payments sp
                   WHERE sp.sale_id = s.id
                 ), '[]'::jsonb),
                 'lines', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                     'description', si.description,
                     'quantity', si.quantity,
                     'unitPrice', si.unit_price,
                     'lineTotal', si.line_total
                   ) ORDER BY si.created_at)
                   FROM app.sale_items si
                   WHERE si.sale_id = s.id
                 ), '[]'::jsonb)
               ) ORDER BY s.sold_at DESC)
               FROM app.sales s
               WHERE s.cash_session_id = cs.id AND s.status = 'completed'
             ), '[]'::jsonb) AS sales
      FROM app.cash_sessions cs
      JOIN app.cash_registers cr ON cr.id = cs.register_id
      JOIN app.users opened_by ON opened_by.id = cs.opened_by
      LEFT JOIN app.users closed_by ON closed_by.id = cs.closed_by
      WHERE cs.status = 'closed'
        AND (cs.closed_at AT TIME ZONE 'America/Mexico_City')::date = $1::date
      ORDER BY cs.closed_at DESC
    `, [day])
    return NextResponse.json(result.rows.map((cut) => ({
      ...cut,
      openingAmount: Number(cut.openingAmount),
      closingCash: Number(cut.closingCash ?? 0),
      expectedCash: Number(cut.expectedCash ?? 0),
      difference: Number(cut.difference ?? 0),
      salesTotal: Number(cut.salesTotal),
      payments: cut.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
      sales: cut.sales.map((sale) => ({
        ...sale,
        total: Number(sale.total),
        items: Number(sale.items),
        payments: sale.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
        lines: sale.lines.map((line) => ({
          ...line,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          lineTotal: Number(line.lineTotal),
        })),
      })),
    })), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/cuts failed', error)
    return NextResponse.json({ error: 'No se pudieron consultar los cortes de caja' }, { status: 503 })
  }
}
