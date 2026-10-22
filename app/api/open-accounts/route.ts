import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type OpenAccountBody = {
  action?: unknown
  customerName?: unknown
  accountId?: unknown
  productId?: unknown
  method?: unknown
  amount?: unknown
}

type AccountPaymentRow = {
  id: string
  accountId: string
  method: 'cash' | 'card' | 'transfer'
  amount: string
}

type AccountItemRow = {
  id: string
  accountId?: string
  productId: string | null
  sku: string | null
  description: string
  quantity: string
  unitPrice: string
  discountAmount: string
  lineTotal: string
}

type AccountRow = {
  id: string
  customerName: string
  createdAt: string
  items: AccountItemRow[]
  payments: AccountPaymentRow[]
}

async function readOpenAccounts(client: Awaited<ReturnType<typeof db.connect>>, sessionId: string) {
  const accounts = await client.query<Omit<AccountRow, 'items' | 'payments'>>(`
    SELECT id, customer_name AS "customerName", created_at AS "createdAt"
    FROM app.open_accounts
    WHERE cash_session_id = $1 AND status = 'open'
    ORDER BY created_at
  `, [sessionId])
  const items = await client.query<AccountItemRow>(`
    SELECT i.id,
           i.product_id AS "productId",
           i.sku,
           i.description,
           i.quantity,
           i.unit_price AS "unitPrice",
           i.discount_amount AS "discountAmount",
           i.line_total AS "lineTotal",
           i.account_id AS "accountId"
    FROM app.open_account_items i
    JOIN app.open_accounts a ON a.id = i.account_id
    WHERE a.cash_session_id = $1 AND a.status = 'open'
    ORDER BY i.created_at
  `, [sessionId])
  const payments = await client.query<AccountPaymentRow>(`
    SELECT p.id,
           p.account_id AS "accountId",
           p.payment_method AS method,
           p.amount
    FROM app.open_account_payments p
    JOIN app.open_accounts a ON a.id = p.account_id
    WHERE a.cash_session_id = $1 AND a.status = 'open'
    ORDER BY p.paid_at, p.id
  `, [sessionId])
  return accounts.rows.map((account) => ({
    ...account,
    total: 0,
    items: items.rows
      .filter((item) => item.accountId === account.id)
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        sku: item.sku,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount),
        lineTotal: Number(item.lineTotal),
      })),
    payments: payments.rows
      .filter((payment) => payment.accountId === account.id)
      .map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: Number(payment.amount),
      })),
  })).map((account) => ({
    ...account,
    total: account.items.reduce((sum, item) => sum + item.lineTotal, 0),
  }))
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })
    const result = await db.query<{ id: string }>(`
      SELECT id
      FROM app.cash_sessions
      WHERE opened_by = $1 AND status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1
    `, [user.id])
    if (!result.rowCount) return NextResponse.json([])

    const client = await db.connect()
    try {
      const accounts = await readOpenAccounts(client, result.rows[0].id)
      return NextResponse.json(accounts, { headers: { 'Cache-Control': 'no-store' } })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('GET /api/open-accounts failed', error)
    return NextResponse.json({ error: 'No se pudieron consultar las cuentas abiertas' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  let body: OpenAccountBody
  try {
    body = await request.json() as OpenAccountBody
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })
  if (body.action !== 'create' && body.action !== 'add-item' && body.action !== 'cancel' && body.action !== 'payment') {
    return NextResponse.json({ error: 'Acción de cuenta inválida' }, { status: 400 })
  }
  if (body.action === 'create' && (typeof body.customerName !== 'string'
    || !body.customerName.trim() || body.customerName.trim().length > 160)) {
    return NextResponse.json({ error: 'Ingresa el nombre del cliente (máximo 160 caracteres)' }, { status: 400 })
  }
  if (body.action !== 'create' && (typeof body.accountId !== 'string' || !body.accountId)) {
    return NextResponse.json({ error: 'Selecciona una cuenta válida' }, { status: 400 })
  }
  if (body.action === 'add-item' && (typeof body.productId !== 'string' || !body.productId)) {
    return NextResponse.json({ error: 'Selecciona una cuenta y un producto válidos' }, { status: 400 })
  }
  if (body.action === 'payment' && (
    (body.method !== 'cash' && body.method !== 'card' && body.method !== 'transfer')
    || typeof body.amount !== 'number'
    || !Number.isFinite(body.amount)
    || body.amount <= 0
  )) {
    return NextResponse.json({ error: 'Selecciona un método y un importe de abono válidos' }, { status: 400 })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const session = await client.query<{ id: string }>(`
      SELECT id
      FROM app.cash_sessions
      WHERE opened_by = $1 AND status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1
      FOR UPDATE
    `, [user.id])
    if (!session.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No hay un turno de caja abierto para este usuario' }, { status: 409 })
    }

    if (body.action === 'create') {
      const result = await client.query<{ id: string; customerName: string; createdAt: string }>(`
        INSERT INTO app.open_accounts (cash_session_id, customer_name)
        VALUES ($1, $2)
        RETURNING id, customer_name AS "customerName", created_at AS "createdAt"
      `, [session.rows[0].id, (body.customerName as string).trim()])
      await client.query('COMMIT')
      return NextResponse.json({
        ...result.rows[0],
        total: 0,
        items: [],
        payments: [],
      }, { status: 201 })
    }

    const account = await client.query<{ id: string }>(`
      SELECT id
      FROM app.open_accounts
      WHERE id = $1 AND cash_session_id = $2 AND status = 'open'
      FOR UPDATE
    `, [body.accountId, session.rows[0].id])
    if (!account.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'La cuenta abierta no está disponible' }, { status: 404 })
    }
    if (body.action === 'payment') {
      const items = await client.query<{ total: string }>(`
        SELECT COALESCE(SUM(line_total), 0) AS total
        FROM app.open_account_items
        WHERE account_id = $1
      `, [body.accountId])
      const existingPayments = await client.query<{ total: string }>(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM app.open_account_payments
        WHERE account_id = $1
      `, [body.accountId])
      const amountCents = Math.round((body.amount as number) * 100)
      const totalCents = Math.round(Number(items.rows[0].total) * 100)
      const paidCents = Math.round(Number(existingPayments.rows[0].total) * 100)
      if (totalCents === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Agrega artículos antes de registrar un abono' }, { status: 400 })
      }
      if (amountCents <= 0 || amountCents > totalCents - paidCents) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'El abono no puede superar el saldo pendiente' }, { status: 409 })
      }
      await client.query(`
        INSERT INTO app.open_account_payments (account_id, payment_method, amount)
        VALUES ($1, $2, $3)
      `, [body.accountId, body.method, amountCents / 100])
      const accounts = await readOpenAccounts(client, session.rows[0].id)
      const saved = accounts.find((openAccount) => openAccount.id === body.accountId)
      await client.query('COMMIT')
      return NextResponse.json(saved)
    }
    if (body.action === 'cancel') {
      const existingPayments = await client.query<{ count: string }>(`
        SELECT COUNT(*) AS count
        FROM app.open_account_payments
        WHERE account_id = $1
      `, [body.accountId])
      if (Number(existingPayments.rows[0].count) > 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'No se puede cancelar una cuenta con abonos registrados' }, { status: 409 })
      }
      await client.query(`
        UPDATE app.open_accounts
        SET status = 'cancelled', updated_at = now()
        WHERE id = $1
      `, [body.accountId])
      const accounts = await readOpenAccounts(client, session.rows[0].id)
      await client.query('COMMIT')
      return NextResponse.json(accounts)
    }

    const product = await client.query<{
      id: string
      sku: string
      name: string
      price: string
      stock: string
      trackStock: boolean
      active: boolean
    }>(`
      SELECT id, sku, name, unit_price AS price, stock,
             track_stock AS "trackStock", active
      FROM app.products
      WHERE id = $1
      FOR UPDATE
    `, [body.productId])
    if (!product.rowCount || !product.rows[0].active) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'El producto ya no está disponible' }, { status: 404 })
    }
    const item = product.rows[0]
    const previousItem = await client.query<{ id: string; quantity: string }>(`
      SELECT id, quantity
      FROM app.open_account_items
      WHERE account_id = $1 AND product_id = $2
      FOR UPDATE
    `, [body.accountId, item.id])
    const nextQuantity = Number(previousItem.rows[0]?.quantity ?? 0) + 1

    if (item.trackStock) {
      const reserved = await client.query<{ quantity: string }>(`
        SELECT COALESCE(SUM(i.quantity), 0) AS quantity
        FROM app.open_account_items i
        JOIN app.open_accounts a ON a.id = i.account_id
        WHERE i.product_id = $1 AND a.status = 'open'
      `, [item.id])
      if (Number(reserved.rows[0].quantity) + 1 > Number(item.stock)) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: `No hay existencias disponibles para ${item.name}` }, { status: 409 })
      }
    }

    const price = Number(item.price)
    const weekend = item.sku === '7501011'
      ? await client.query<{ weekend: boolean }>(`
          SELECT EXTRACT(DOW FROM now() AT TIME ZONE 'America/Mexico_City') IN (0, 6) AS weekend
        `)
      : null
    const isWeekendCourtRental = item.sku === '7501011' && weekend?.rows[0].weekend === true
    const lineTotal = isWeekendCourtRental ? Math.ceil(nextQuantity / 2) * price : nextQuantity * price
    const discount = nextQuantity * price - lineTotal
    if (previousItem.rowCount) {
      await client.query(`
        UPDATE app.open_account_items
        SET quantity = $1, discount_amount = $2, line_total = $3
        WHERE id = $4
      `, [nextQuantity, discount, lineTotal, previousItem.rows[0].id])
    } else {
      await client.query(`
        INSERT INTO app.open_account_items
          (account_id, product_id, sku, description, quantity, unit_price, discount_amount, line_total)
        VALUES ($1, $2, $3, $4, 1, $5, 0, $5)
      `, [body.accountId, item.id, item.sku, item.name, price])
      if (isWeekendCourtRental) {
        await client.query(`
          UPDATE app.open_account_items
          SET discount_amount = $1, line_total = $2
          WHERE account_id = $3 AND product_id = $4
        `, [discount, lineTotal, body.accountId, item.id])
      }
    }

    const accounts = await readOpenAccounts(client, session.rows[0].id)
    const saved = accounts.find((openAccount) => openAccount.id === body.accountId)
    await client.query('COMMIT')
    return NextResponse.json(saved)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('POST /api/open-accounts failed', error)
    return NextResponse.json({ error: 'No se pudo actualizar la cuenta abierta' }, { status: 503 })
  } finally {
    client.release()
  }
}

export async function PATCH(request: Request) {
      let body: OpenAccountBody & {
        folio?: unknown
        payersCount?: unknown
      }
      try {
        body = await request.json() as typeof body
      } catch {
        return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
      }

      if (body.action !== 'charge' || typeof body.accountId !== 'string' || !body.accountId
        || typeof body.folio !== 'string' || !body.folio.trim()
        || (body.payersCount !== undefined && (
          typeof body.payersCount !== 'number' || !Number.isInteger(body.payersCount) || body.payersCount < 1
        ))) {
        return NextResponse.json({ error: 'Datos de cobro de la cuenta incompletos' }, { status: 400 })
      }

      const user = await getAuthenticatedUser()
      if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })

      const client = await db.connect()
      try {
        await client.query('BEGIN')
        const session = await client.query<{ id: string }>(`
          SELECT id
          FROM app.cash_sessions
          WHERE opened_by = $1 AND status = 'open'
          ORDER BY opened_at DESC
          LIMIT 1
          FOR UPDATE
        `, [user.id])
        if (!session.rowCount) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'No hay un turno de caja abierto para este usuario' }, { status: 409 })
        }

        const account = await client.query<{ id: string; customerName: string }>(`
          SELECT id, customer_name AS "customerName"
          FROM app.open_accounts
          WHERE id = $1 AND cash_session_id = $2 AND status = 'open'
          FOR UPDATE
        `, [body.accountId, session.rows[0].id])
        if (!account.rowCount) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'La cuenta ya no está abierta' }, { status: 404 })
        }

        const items = await client.query<{
          productId: string | null
          sku: string | null
          description: string
          quantity: string
          unitPrice: string
          discountAmount: string
          lineTotal: string
        }>(`
          SELECT product_id AS "productId", sku, description, quantity,
                 unit_price AS "unitPrice", discount_amount AS "discountAmount",
                 line_total AS "lineTotal"
          FROM app.open_account_items
          WHERE account_id = $1
          ORDER BY created_at
        `, [body.accountId])
        if (!items.rowCount) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'Agrega artículos antes de cobrar la cuenta' }, { status: 400 })
        }
        const total = items.rows.reduce((sum, item) => sum + Number(item.lineTotal), 0)
        const paymentsResult = await client.query<{
          method: 'cash' | 'card' | 'transfer'
          amount: string
        }>(`
          SELECT payment_method AS method, amount
          FROM app.open_account_payments
          WHERE account_id = $1
          ORDER BY paid_at, id
        `, [body.accountId])
        const payments = paymentsResult.rows.map((payment) => ({
          method: payment.method,
          amount: Number(payment.amount),
        }))
        const paidCents = payments.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0)
        if (Math.round(total * 100) !== paidCents) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'Registra abonos que cubran el total completo antes de cerrar la cuenta' }, { status: 400 })
        }
        if (payments.length === 0) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'Registra al menos un abono antes de cerrar la cuenta' }, { status: 400 })
        }

        const sale = await client.query<{ id: string }>(`
          INSERT INTO app.sales
            (folio, cash_session_id, cashier_id, subtotal, discount_amount, tax_amount, total, payers_count)
          VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
          RETURNING id
        `, [
          body.folio.trim(),
          session.rows[0].id,
          user.id,
          items.rows.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0),
          items.rows.reduce((sum, item) => sum + Number(item.discountAmount), 0),
          total,
          body.payersCount ?? payments.length,
        ])

        for (const item of items.rows) {
          let productId = item.productId
          if (productId) {
            const product = await client.query<{ id: string; stock: string; trackStock: boolean }>(`
              SELECT id, stock, track_stock AS "trackStock"
              FROM app.products
              WHERE id = $1
              FOR UPDATE
            `, [productId])
            if (!product.rowCount) {
              productId = null
            } else if (product.rows[0].trackStock) {
              const stockBefore = Number(product.rows[0].stock)
              const quantity = Number(item.quantity)
              if (stockBefore < quantity) throw new Error(`Existencias insuficientes para ${item.description}`)
              const stockAfter = stockBefore - quantity
              await client.query('UPDATE app.products SET stock = $1, updated_at = now() WHERE id = $2', [stockAfter, productId])
              await client.query(`
                INSERT INTO app.inventory_movements
                  (product_id, user_id, movement_type, quantity, stock_before, stock_after, reference_type, reference_id)
                VALUES ($1, $2, 'sale', $3, $4, $5, 'sale', $6)
              `, [productId, user.id, quantity, stockBefore, stockAfter, sale.rows[0].id])
            }
          }

          await client.query(`
            INSERT INTO app.sale_items
              (sale_id, product_id, description, sku, quantity, unit_price, discount_amount, line_total)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            sale.rows[0].id,
            productId,
            item.description,
            item.sku,
            item.quantity,
            item.unitPrice,
            item.discountAmount,
            item.lineTotal,
          ])
        }

        for (const payment of payments) {
          await client.query(`
            INSERT INTO app.sale_payments (sale_id, payment_method, amount)
            VALUES ($1, $2, $3)
          `, [sale.rows[0].id, payment.method, payment.amount])
        }
        await client.query(`
          UPDATE app.open_accounts
          SET status = 'paid', sale_id = $1, updated_at = now()
          WHERE id = $2
        `, [sale.rows[0].id, body.accountId])

        await client.query('COMMIT')
        return NextResponse.json({
          id: sale.rows[0].id,
          folio: body.folio.trim(),
          customerName: account.rows[0].customerName,
          subtotal: items.rows.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0),
          discountAmount: items.rows.reduce((sum, item) => sum + Number(item.discountAmount), 0),
          total,
          payersCount: body.payersCount ?? payments.length,
          items: items.rows.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.lineTotal),
          })),
          payments: payments.map((payment) => ({ method: payment.method, amount: payment.amount })),
        }, { status: 201 })
      } catch (error) {
        await client.query('ROLLBACK')
        const databaseError = error as { code?: string }
        if (databaseError.code === '23505') {
          return NextResponse.json({ error: 'El folio ya existe' }, { status: 409 })
        }
        if (error instanceof Error && error.message.startsWith('Existencias insuficientes')) {
          return NextResponse.json({ error: error.message }, { status: 409 })
        }
        console.error('PATCH /api/open-accounts failed', error)
        return NextResponse.json({ error: 'No se pudo cobrar la cuenta abierta' }, { status: 503 })
      } finally {
        client.release()
      }
}
