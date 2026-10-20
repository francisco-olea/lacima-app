import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type SessionBody = {
  action?: unknown
  closingCash?: unknown
}

type CashSession = {
  id: string
  register: string
  opened_by?: string
  openedAt: string
  openingAmount: string
  sales: {
    id: string
    folio: string
    soldAt: string
    total: string
    items: number
    payments: { method: string; amount: string }[]
  }[]
}

async function requireUser() {
  const user = await getAuthenticatedUser()
  if (!user) return { response: NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 }) }
  return { user }
}

async function getSessionSales(client: Awaited<ReturnType<typeof db.connect>>, sessionId: string) {
  const result = await client.query<CashSession['sales'][number]>(`
    SELECT s.id,
           s.folio,
           s.sold_at AS "soldAt",
           s.total,
           COALESCE((SELECT SUM(si.quantity) FROM app.sale_items si WHERE si.sale_id = s.id), 0)::int AS items,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'method', sp.payment_method,
               'amount', sp.amount
             ) ORDER BY sp.paid_at)
             FROM app.sale_payments sp
             WHERE sp.sale_id = s.id
           ), '[]'::jsonb) AS payments
    FROM app.sales s
    WHERE s.cash_session_id = $1 AND s.status = 'completed'
    ORDER BY s.sold_at DESC
  `, [sessionId])
  return result.rows.map((sale) => ({
    ...sale,
    total: String(sale.total),
    payments: sale.payments.map((payment) => ({ ...payment, amount: String(payment.amount) })),
  }))
}

function sessionResponse(session: CashSession, sales: CashSession['sales']) {
  const totals = { cash: 0, card: 0, transfer: 0 }
  let total = 0
  for (const sale of sales) {
    total += Number(sale.total)
    for (const payment of sale.payments) {
      if (payment.method === 'cash' || payment.method === 'card' || payment.method === 'transfer') {
        totals[payment.method] += Number(payment.amount)
      }
    }
  }
  return {
    id: session.id,
    register: session.register,
    openedAt: session.openedAt,
    openingAmount: Number(session.openingAmount),
    total,
    totals,
    sales: sales.map((sale) => ({
      id: sale.id,
      folio: sale.folio,
      soldAt: sale.soldAt,
      total: Number(sale.total),
      items: Number(sale.items),
      payments: sale.payments.map((payment) => ({ method: payment.method, amount: Number(payment.amount) })),
    })),
  }
}

export async function POST(request: Request) {
  let body: SessionBody
  try {
    body = await request.json() as SessionBody
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const auth = await requireUser()
  if (auth.response) return auth.response
  if (body.action !== 'open' && body.action !== 'close') {
    return NextResponse.json({ error: 'Acción de caja inválida' }, { status: 400 })
  }
  if (body.action === 'close' && (typeof body.closingCash !== 'number'
    || !Number.isFinite(body.closingCash) || body.closingCash < 0)) {
    return NextResponse.json({ error: 'El efectivo contado debe ser una cantidad válida' }, { status: 400 })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const register = await client.query<{ id: string; name: string }>(`
      SELECT id, name
      FROM app.cash_registers
      WHERE active = true
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE
    `)
    if (!register.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No hay una caja activa configurada' }, { status: 503 })
    }

    if (body.action === 'open') {
      const existing = await client.query<CashSession>(`
        SELECT cs.id, cs.opened_by, cr.name AS register, cs.opened_at AS "openedAt",
               cs.opening_amount AS "openingAmount"
        FROM app.cash_sessions cs
        JOIN app.cash_registers cr ON cr.id = cs.register_id
        WHERE cs.register_id = $1 AND cs.status = 'open'
        FOR UPDATE OF cs
      `, [register.rows[0].id])
      if (existing.rowCount && existing.rows[0].opened_by !== auth.user.id) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'La caja sigue abierta por otro usuario. Solicita que realice su corte.' }, { status: 409 })
      }

      let session = existing.rows[0]
      if (!session) {
        const created = await client.query<CashSession>(`
          INSERT INTO app.cash_sessions (register_id, opened_by)
          VALUES ($1, $2)
          RETURNING id, opened_at AS "openedAt", opening_amount AS "openingAmount"
        `, [register.rows[0].id, auth.user.id])
        session = { ...created.rows[0], register: register.rows[0].name }
      }
      const sales = await getSessionSales(client, session.id)
      await client.query('COMMIT')
      return NextResponse.json(sessionResponse(session, sales))
    }

    const sessionResult = await client.query<CashSession>(`
      SELECT cs.id, cr.name AS register, cs.opened_at AS "openedAt",
             cs.opening_amount AS "openingAmount"
      FROM app.cash_sessions cs
      JOIN app.cash_registers cr ON cr.id = cs.register_id
      WHERE cs.register_id = $1 AND cs.opened_by = $2 AND cs.status = 'open'
      FOR UPDATE OF cs
    `, [register.rows[0].id, auth.user.id])
    if (!sessionResult.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No hay un turno abierto para realizar el corte' }, { status: 404 })
    }

    const session = sessionResult.rows[0]
    const openAccounts = await client.query<{ count: string }>(`
      SELECT COUNT(*) AS count
      FROM app.open_accounts
      WHERE cash_session_id = $1 AND status = 'open'
    `, [session.id])
    if (Number(openAccounts.rows[0].count) > 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({
        error: 'No puedes cerrar el turno mientras haya cuentas abiertas. Cóbralas antes de realizar el corte.',
      }, { status: 409 })
    }

    const sales = await getSessionSales(client, session.id)
    const totals = sales.reduce((result, sale) => {
      result.total += Number(sale.total)
      for (const payment of sale.payments) {
        if (payment.method === 'cash' || payment.method === 'card' || payment.method === 'transfer') {
          result[payment.method] += Number(payment.amount)
        }
      }
      return result
    }, { total: 0, cash: 0, card: 0, transfer: 0 })
    const expectedCash = Number(session.openingAmount) + totals.cash
    const closingCash = body.closingCash as number
    const difference = closingCash - expectedCash

    await client.query(`
      UPDATE app.cash_sessions
      SET closed_by = $1,
          closed_at = now(),
          closing_amount = $2,
          expected_amount = $3,
          difference_amount = $4,
          status = 'closed'
      WHERE id = $5
    `, [auth.user.id, closingCash, expectedCash, difference, session.id])
    await client.query('COMMIT')
    return NextResponse.json({
      ...sessionResponse(session, sales),
      closedAt: new Date().toISOString(),
      closingCash,
      expectedCash,
      difference,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('POST /api/cash-sessions failed', error)
    return NextResponse.json({ error: 'No se pudo actualizar el turno de caja' }, { status: 503 })
  } finally {
    client.release()
  }
}
