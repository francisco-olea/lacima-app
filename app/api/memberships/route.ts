import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type MembershipRow = {
  id: string
  number: string
  name: string
  email: string | null
  phone: string | null
  planId: string | null
  plan: string | null
  startsOn: string | null
  endsOn: string | null
  status: 'Activa' | 'Vencida'
}

type MembershipBody = {
  action?: unknown
  id?: unknown
  name?: unknown
  email?: unknown
  phone?: unknown
  planId?: unknown
  startsOn?: unknown
  endsOn?: unknown
}

type ValidMembershipBody = MembershipBody & {
  name: string
  email: string
  phone: string
  planId: string
  startsOn: string
  endsOn: string
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validDetails(body: MembershipBody): body is ValidMembershipBody {
  return typeof body.name === 'string'
    && body.name.trim().length > 0
    && body.name.trim().length <= 160
    && typeof body.email === 'string'
    && body.email.trim().length <= 254
    && typeof body.phone === 'string'
    && body.phone.trim().length <= 40
    && typeof body.planId === 'string'
    && isDate(body.startsOn)
    && isDate(body.endsOn)
    && body.endsOn >= body.startsOn
}

async function requireAdmin() {
  const user = await getAuthenticatedUser()
  if (!user) return { response: NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 }) }
  if (user.role !== 'admin') {
    return { response: NextResponse.json({ error: 'No tienes permiso para administrar membresías' }, { status: 403 }) }
  }
  return { user }
}

async function renewMembership(memberId: string, planId: string, startsOn: string, endsOn: string, userId: string) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const member = await client.query<{ id: string; number: string; name: string; email: string | null; phone: string | null }>(
      'SELECT id, member_number AS number, full_name AS name, email, phone FROM app.members WHERE id = $1 AND active = true FOR UPDATE',
      [memberId],
    )
    const plan = await client.query<{ id: string; name: string; price: string }>(
      'SELECT id, name, price FROM app.membership_plans WHERE id = $1 AND active = true',
      [planId],
    )
    if (!member.rowCount || !plan.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No se encontró el socio o el plan' }, { status: 404 })
    }
    await client.query(`
      UPDATE app.memberships
      SET status = 'expired'
      WHERE member_id = $1 AND status = 'active'
    `, [memberId])
    const membership = await client.query<{ id: string }>(`
      INSERT INTO app.memberships
        (member_id, plan_id, starts_on, ends_on, price_paid, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [memberId, plan.rows[0].id, startsOn, endsOn, plan.rows[0].price, userId])
    await client.query(`
      INSERT INTO app.membership_events (member_id, membership_id, user_id, event_type, previous_status, new_status)
      VALUES ($1, $2, $3, 'renewed', 'expired', 'active')
    `, [memberId, membership.rows[0].id, userId])
    await client.query('COMMIT')
    return NextResponse.json({
      id: member.rows[0].id,
      number: member.rows[0].number,
      name: member.rows[0].name,
      email: member.rows[0].email ?? '',
      phone: member.rows[0].phone ?? '',
      planId: plan.rows[0].id,
      plan: plan.rows[0].name,
      startsOn,
      endsOn,
      status: endsOn < new Date().toISOString().slice(0, 10) ? 'Vencida' : 'Activa',
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('POST /api/memberships renewal failed', error)
    return NextResponse.json({ error: 'No se pudo renovar la membresía' }, { status: 503 })
  } finally {
    client.release()
  }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const [members, plans] = await Promise.all([
      db.query<MembershipRow>(`
        SELECT m.id,
               m.member_number AS number,
               m.full_name AS name,
               COALESCE(m.email, '') AS email,
               COALESCE(m.phone, '') AS phone,
               latest.plan_id AS "planId",
               latest.plan_name AS plan,
               to_char(latest.starts_on, 'YYYY-MM-DD') AS "startsOn",
               to_char(latest.ends_on, 'YYYY-MM-DD') AS "endsOn",
               CASE WHEN latest.ends_on < current_date THEN 'Vencida' ELSE 'Activa' END AS status
        FROM app.members m
        LEFT JOIN LATERAL (
          SELECT ms.plan_id, mp.name AS plan_name, ms.starts_on, ms.ends_on
          FROM app.memberships ms
          JOIN app.membership_plans mp ON mp.id = ms.plan_id
          WHERE ms.member_id = m.id
            AND ms.status <> 'cancelled'
          ORDER BY ms.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE m.active = true
        ORDER BY m.created_at DESC, m.full_name
      `),
      db.query<{ id: string; name: string; months: number; price: string; benefits: string }>(`
        SELECT id, name, duration_months AS months, price,
               COALESCE((
                 SELECT string_agg(value, ', ')
                 FROM jsonb_array_elements_text(benefits)
               ), '') AS benefits
        FROM app.membership_plans
        WHERE active = true
        ORDER BY duration_months
      `),
    ])

    return NextResponse.json({
      members: members.rows,
      plans: plans.rows.map((plan) => ({ ...plan, price: Number(plan.price) })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/memberships failed', error)
    return NextResponse.json({ error: 'No se pudieron consultar las membresías' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  let body: MembershipBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const details = validDetails(body) ? body : null
  if (body.action === 'renew') {
    const renewalId = typeof body.id === 'string' ? body.id : ''
    const renewalPlanId = typeof body.planId === 'string' ? body.planId : ''
    const startsOn = isDate(body.startsOn) ? body.startsOn : ''
    const endsOn = isDate(body.endsOn) ? body.endsOn : ''
    if (!renewalId || !renewalPlanId || !startsOn || !endsOn || endsOn < startsOn) {
      return NextResponse.json({ error: 'Datos de renovación inválidos' }, { status: 400 })
    }
    const auth = await requireAdmin()
    if (auth.response) return auth.response
    return renewMembership(renewalId, renewalPlanId, startsOn, endsOn, auth.user.id)
  }
  if (!details) {
    return NextResponse.json({ error: 'Completa los datos del socio y una vigencia válida' }, { status: 400 })
  }

  const auth = await requireAdmin()
  if (auth.response) return auth.response

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const plan = await client.query<{ id: string; price: string }>(
      'SELECT id, price FROM app.membership_plans WHERE id = $1 AND active = true',
      [details.planId],
    )
    if (!plan.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'El plan seleccionado no está disponible' }, { status: 400 })
    }

    await client.query("SELECT pg_advisory_xact_lock(hashtext('app.members.member_number'))")
    const nextNumber = await client.query<{ number: string }>(`
      SELECT COALESCE(MAX(SUBSTRING(member_number FROM '^SOC-([0-9]+)$')::bigint), 0) + 1 AS number
      FROM app.members
    `)
    const memberNumber = `SOC-${String(nextNumber.rows[0].number).padStart(4, '0')}`
    const member = await client.query<{ id: string }>(`
      INSERT INTO app.members (member_number, full_name, email, phone)
      VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''))
      RETURNING id
    `, [memberNumber, details.name.trim(), details.email.trim(), details.phone.trim()])
    const membership = await client.query<{ id: string }>(`
      INSERT INTO app.memberships
        (member_id, plan_id, starts_on, ends_on, price_paid, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [member.rows[0].id, plan.rows[0].id, details.startsOn, details.endsOn, plan.rows[0].price, auth.user.id])
    await client.query(`
      INSERT INTO app.membership_events (member_id, membership_id, user_id, event_type, new_status)
      VALUES ($1, $2, $3, 'created', 'active')
    `, [member.rows[0].id, membership.rows[0].id, auth.user.id])
    await client.query('COMMIT')

    return NextResponse.json({
      id: member.rows[0].id,
      number: memberNumber,
      name: details.name.trim(),
      email: details.email.trim(),
      phone: details.phone.trim(),
      planId: plan.rows[0].id,
      startsOn: details.startsOn,
      endsOn: details.endsOn,
      status: details.endsOn < new Date().toISOString().slice(0, 10) ? 'Vencida' : 'Activa',
    }, { status: 201 })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('POST /api/memberships failed', error)
    return NextResponse.json({ error: 'No se pudo registrar el socio' }, { status: 503 })
  } finally {
    client.release()
  }
}

export async function PATCH(request: Request) {
  let body: MembershipBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  const details = validDetails(body) ? body : null
  if (!id || !details) {
    return NextResponse.json({ error: 'Completa los datos del socio y una vigencia válida' }, { status: 400 })
  }

  const auth = await requireAdmin()
  if (auth.response) return auth.response

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const member = await client.query<{ id: string; number: string }>(
      'SELECT id, member_number AS number FROM app.members WHERE id = $1 AND active = true FOR UPDATE',
      [id],
    )
    const plan = await client.query<{ id: string; price: string }>(
      'SELECT id, price FROM app.membership_plans WHERE id = $1 AND active = true',
      [details.planId],
    )
    if (!member.rowCount || !plan.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No se encontró el socio o el plan' }, { status: 404 })
    }

    await client.query(`
      UPDATE app.members
      SET full_name = $2, email = NULLIF($3, ''), phone = NULLIF($4, ''), updated_at = now()
      WHERE id = $1
    `, [id, details.name.trim(), details.email.trim(), details.phone.trim()])
    const latest = await client.query<{ id: string }>(`
      SELECT id FROM app.memberships
      WHERE member_id = $1 AND status <> 'cancelled'
      ORDER BY created_at DESC LIMIT 1
    `, [id])

    let membershipId: string
    if (latest.rowCount) {
      membershipId = latest.rows[0].id
      await client.query(`
        UPDATE app.memberships
          SET plan_id = $2, starts_on = $3, ends_on = $4
        WHERE id = $1
        `, [latest.rows[0].id, plan.rows[0].id, details.startsOn, details.endsOn])
    } else {
      const createdMembership = await client.query<{ id: string }>(`
        INSERT INTO app.memberships
          (member_id, plan_id, starts_on, ends_on, price_paid, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [id, plan.rows[0].id, details.startsOn, details.endsOn, plan.rows[0].price, auth.user.id])
      membershipId = createdMembership.rows[0].id
    }
    await client.query(`
      INSERT INTO app.membership_events (member_id, membership_id, user_id, event_type, new_status)
      VALUES ($1, $2, $3, 'updated', 'active')
    `, [id, membershipId, auth.user.id])
    await client.query('COMMIT')

    return NextResponse.json({
      id,
      number: member.rows[0].number,
      name: details.name.trim(),
      email: details.email.trim(),
      phone: details.phone.trim(),
      planId: plan.rows[0].id,
      startsOn: details.startsOn,
      endsOn: details.endsOn,
      status: details.endsOn < new Date().toISOString().slice(0, 10) ? 'Vencida' : 'Activa',
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('PATCH /api/memberships failed', error)
    return NextResponse.json({ error: 'No se pudo actualizar el socio' }, { status: 503 })
  } finally {
    client.release()
  }
}

export async function DELETE(request: Request) {
  let body: MembershipBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  if (typeof body.id !== 'string') return NextResponse.json({ error: 'Socio inválido' }, { status: 400 })

  const auth = await requireAdmin()
  if (auth.response) return auth.response

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const member = await client.query<{ id: string }>(
      'UPDATE app.members SET active = false, updated_at = now() WHERE id = $1 AND active = true RETURNING id',
      [body.id],
    )
    if (!member.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'No se encontró el socio' }, { status: 404 })
    }
    await client.query(`
      UPDATE app.memberships SET status = 'cancelled'
      WHERE member_id = $1 AND status IN ('active', 'suspended')
    `, [body.id])
    await client.query(`
      INSERT INTO app.membership_events (member_id, user_id, event_type, previous_status, new_status)
      VALUES ($1, $2, 'cancelled', 'active', 'cancelled')
    `, [body.id, auth.user.id])
    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('DELETE /api/memberships failed', error)
    return NextResponse.json({ error: 'No se pudo eliminar el registro' }, { status: 503 })
  } finally {
    client.release()
  }
}
