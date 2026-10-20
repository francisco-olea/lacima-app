import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type Tier = 'Embajador' | 'Socio'

type SponsorBody = {
  action?: unknown
  id?: unknown
  company?: unknown
  contact?: unknown
  email?: unknown
  phone?: unknown
  tier?: unknown
  startsOn?: unknown
  endsOn?: unknown
  amount?: unknown
  hours?: unknown
  benefits?: unknown
  quantity?: unknown
}

type SponsorRow = {
  id: string
  company: string
  contact: string | null
  email: string | null
  phone: string | null
  tier: Tier
  startsOn: string
  endsOn: string
  amount: string
  hours: string
  usedHours: string
  benefits: string[]
}

type SponsorDetails = {
  company: string
  contact: string
  email: string
  phone: string
  tier: Tier
  startsOn: string
  endsOn: string
  amount: number
  hours: number
  benefits: string[]
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isTier(value: unknown): value is Tier {
  return value === 'Embajador' || value === 'Socio'
}

function isSponsorDetails(body: SponsorBody): body is SponsorBody & SponsorDetails {
  return typeof body.company === 'string'
    && body.company.trim().length > 0
    && body.company.trim().length <= 160
    && typeof body.contact === 'string'
    && body.contact.trim().length <= 160
    && typeof body.email === 'string'
    && body.email.trim().length <= 254
    && (body.email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
    && typeof body.phone === 'string'
    && body.phone.trim().length <= 40
    && isTier(body.tier)
    && isDate(body.startsOn)
    && isDate(body.endsOn)
    && body.endsOn >= body.startsOn
    && typeof body.amount === 'number'
    && Number.isFinite(body.amount)
    && body.amount >= 0
    && typeof body.hours === 'number'
    && Number.isFinite(body.hours)
    && body.hours >= 0
    && Array.isArray(body.benefits)
    && body.benefits.every((benefit) => typeof benefit === 'string' && benefit.trim().length <= 200)
}

async function requireAdmin() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return { response: NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 }) }
  }
  if (user.role !== 'admin') {
    return { response: NextResponse.json({ error: 'No tienes permiso para administrar patrocinadores' }, { status: 403 }) }
  }
  return { user }
}

function sponsorSelect(where = '') {
  return `
    SELECT s.id,
           s.company_name AS company,
           s.contact_name AS contact,
           s.contact_email AS email,
           s.contact_phone AS phone,
           s.tier,
           to_char(s.starts_on, 'YYYY-MM-DD') AS "startsOn",
           to_char(s.ends_on, 'YYYY-MM-DD') AS "endsOn",
           s.contract_amount AS amount,
           s.benefit_hours AS hours,
           COALESCE((
             SELECT SUM(u.quantity)
             FROM app.sponsor_benefit_usages u
             WHERE u.sponsor_id = s.id AND u.benefit_type = 'court_hours'
           ), 0) AS "usedHours",
           COALESCE((
             SELECT array_agg(b.name ORDER BY b.created_at)
             FROM app.sponsor_benefits b
             WHERE b.sponsor_id = s.id AND b.active = true
           ), ARRAY[]::text[]) AS benefits
    FROM app.sponsors s
    ${where}
  `
}

function toSponsor(row: SponsorRow) {
  return {
    ...row,
    contact: row.contact ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    amount: Number(row.amount),
    hours: Number(row.hours),
    usedHours: Number(row.usedHours),
    benefits: row.benefits ?? [],
  }
}

async function saveBenefits(client: Awaited<ReturnType<typeof db.connect>>, sponsorId: string, benefits: string[]) {
  await client.query('DELETE FROM app.sponsor_benefits WHERE sponsor_id = $1', [sponsorId])
  for (const benefit of [...new Set(benefits.map((value) => value.trim()).filter(Boolean))]) {
    await client.query(`
      INSERT INTO app.sponsor_benefits (sponsor_id, benefit_type, name)
      VALUES ($1, 'branding', $2)
    `, [sponsorId, benefit])
  }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth.response) return auth.response

    const result = await db.query<SponsorRow>(`
      ${sponsorSelect('WHERE s.active = true')}
      ORDER BY s.created_at DESC, s.company_name
    `)
    return NextResponse.json(result.rows.map(toSponsor), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('GET /api/sponsors failed', error)
    return NextResponse.json({ error: 'No se pudieron consultar los patrocinadores' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  let body: SponsorBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const auth = await requireAdmin()
  if (auth.response) return auth.response

  if (body.action === 'usage') {
    if (typeof body.id !== 'string' || !body.id || typeof body.quantity !== 'number'
      || !Number.isFinite(body.quantity) || body.quantity <= 0) {
      return NextResponse.json({ error: 'Cantidad de horas inválida' }, { status: 400 })
    }

    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const sponsor = await client.query<{ id: string; hours: string }>(`
        SELECT id, benefit_hours AS hours
        FROM app.sponsors
        WHERE id = $1 AND active = true
        FOR UPDATE
      `, [body.id])
      if (!sponsor.rowCount) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Patrocinador no encontrado' }, { status: 404 })
      }

      const usage = await client.query<{ used: string }>(`
        SELECT COALESCE(SUM(quantity), 0) AS used
        FROM app.sponsor_benefit_usages
        WHERE sponsor_id = $1 AND benefit_type = 'court_hours'
      `, [body.id])
      const available = Number(sponsor.rows[0].hours) - Number(usage.rows[0].used)
      if (body.quantity > available) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'La cantidad supera las horas disponibles' }, { status: 400 })
      }

      await client.query(`
        INSERT INTO app.sponsor_benefit_usages (sponsor_id, user_id, benefit_type, quantity)
        VALUES ($1, $2, 'court_hours', $3)
      `, [body.id, auth.user.id, body.quantity])
      await client.query('COMMIT')
      return NextResponse.json({ success: true })
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('POST /api/sponsors usage failed', error)
      return NextResponse.json({ error: 'No se pudo registrar el uso de horas' }, { status: 503 })
    } finally {
      client.release()
    }
  }

  if (!isSponsorDetails(body)) {
    return NextResponse.json({ error: 'Completa los datos del patrocinador y una vigencia válida' }, { status: 400 })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<{ id: string }>(`
      INSERT INTO app.sponsors
        (company_name, contact_name, contact_email, contact_phone, tier, starts_on, ends_on, contract_amount, benefit_hours)
      VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      body.company.trim(),
      body.contact.trim(),
      body.email.trim(),
      body.phone.trim(),
      body.tier,
      body.startsOn,
      body.endsOn,
      body.amount,
      body.hours,
    ])
    const sponsorId = result.rows[0].id
    await saveBenefits(client, sponsorId, body.benefits)
    const saved = await client.query<SponsorRow>(sponsorSelect('WHERE s.id = $1'), [sponsorId])
    await client.query('COMMIT')
    return NextResponse.json(toSponsor(saved.rows[0]), { status: 201 })
  } catch (error) {
    await client.query('ROLLBACK')
    const databaseError = error as { code?: string }
    if (databaseError.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un patrocinador con ese nombre' }, { status: 409 })
    }
    console.error('POST /api/sponsors failed', error)
    return NextResponse.json({ error: 'No se pudo guardar el patrocinador' }, { status: 503 })
  } finally {
    client.release()
  }
}

export async function PATCH(request: Request) {
  let body: SponsorBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  if (typeof body.id !== 'string' || !body.id || !isSponsorDetails(body)) {
    return NextResponse.json({ error: 'Datos del patrocinador inválidos' }, { status: 400 })
  }

  const auth = await requireAdmin()
  if (auth.response) return auth.response

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const currentSponsor = await client.query<{ id: string }>(`
      SELECT id
      FROM app.sponsors
      WHERE id = $1 AND active = true
      FOR UPDATE
    `, [body.id])
    if (!currentSponsor.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Patrocinador no encontrado' }, { status: 404 })
    }
    const usage = await client.query<{ used: string }>(`
      SELECT COALESCE(SUM(quantity), 0) AS used
      FROM app.sponsor_benefit_usages
      WHERE sponsor_id = $1 AND benefit_type = 'court_hours'
    `, [body.id])
    if (body.hours < Number(usage.rows[0].used)) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Las horas contratadas no pueden ser menores a las ya utilizadas' }, { status: 400 })
    }

    const updated = await client.query(`
      UPDATE app.sponsors
      SET company_name = $1,
          contact_name = NULLIF($2, ''),
          contact_email = NULLIF($3, ''),
          contact_phone = NULLIF($4, ''),
          tier = $5,
          starts_on = $6,
          ends_on = $7,
          contract_amount = $8,
          benefit_hours = $9,
          updated_at = now()
      WHERE id = $10 AND active = true
    `, [
      body.company.trim(),
      body.contact.trim(),
      body.email.trim(),
      body.phone.trim(),
      body.tier,
      body.startsOn,
      body.endsOn,
      body.amount,
      body.hours,
      body.id,
    ])
    if (!updated.rowCount) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Patrocinador no encontrado' }, { status: 404 })
    }

    await saveBenefits(client, body.id, body.benefits)
    const saved = await client.query<SponsorRow>(sponsorSelect('WHERE s.id = $1'), [body.id])
    await client.query('COMMIT')
    return NextResponse.json(toSponsor(saved.rows[0]))
  } catch (error) {
    await client.query('ROLLBACK')
    const databaseError = error as { code?: string }
    if (databaseError.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un patrocinador con ese nombre' }, { status: 409 })
    }
    console.error('PATCH /api/sponsors failed', error)
    return NextResponse.json({ error: 'No se pudo actualizar el patrocinador' }, { status: 503 })
  } finally {
    client.release()
  }
}
