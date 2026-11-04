import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { categoryForRole } from '@/lib/roles'

export const runtime = 'nodejs'

type ProductRow = {
  id: string
  codigo: string
  nombre: string
  categoria: string
  tipo: string
  precio: string
  existencias: string
  inventarioMinimo: string
  activo: boolean
}

function toProduct(row: ProductRow) {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    categoria: row.categoria,
    tipo: row.tipo === 'Inventario' || row.tipo === 'Servicio' ? row.tipo : 'Renta',
    precio: Number(row.precio),
    existencias: Number(row.existencias),
    inventarioMinimo: Number(row.inventarioMinimo),
    activo: row.activo,
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Inicia sesión para consultar el inventario' }, { status: 401 })
    const category = categoryForRole(user.role)
    const result = await db.query<ProductRow>(`
      SELECT p.id, p.sku AS codigo, p.name AS nombre, c.name AS categoria,
             CASE
               WHEN p.is_rental THEN 'Renta'
               WHEN p.track_stock THEN 'Inventario'
               ELSE 'Servicio'
             END AS tipo,
             p.unit_price AS precio,
             CASE WHEN p.track_stock THEN p.stock ELSE 0 END AS existencias,
             CASE WHEN p.track_stock THEN p.minimum_stock ELSE 0 END AS "inventarioMinimo",
             p.active AS activo
      FROM app.products p
      JOIN app.product_categories c ON c.id = p.category_id
      WHERE p.active = true
        AND ($1::text IS NULL OR c.name = $1)
      ORDER BY p.name
    `, [category])
    return NextResponse.json(result.rows.map(toProduct), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('GET /api/products failed', error)
    return NextResponse.json({ error: 'No se pudo consultar el inventario en PostgreSQL' }, { status: 500 })
  }
}

async function requireAdmin() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión para continuar' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'No tienes permiso para modificar el inventario' }, { status: 403 })
  return null
}

export async function POST(request: Request) {
  const authorizationError = await requireAdmin()
  if (authorizationError) return authorizationError
  const body = await request.json() as {
    codigo?: string
    nombre?: string
    categoria?: string
    tipo?: 'Inventario' | 'Renta' | 'Servicio'
    precio?: number
    existencias?: number
    inventarioMinimo?: number
    motivoInventario?: string
  }
  const initialStock = body.tipo === 'Inventario' ? Math.max(0, body.existencias ?? 0) : 0
  const inventoryReason = body.motivoInventario?.trim() ?? ''

  if (
    !body.codigo?.trim()
    || !body.nombre?.trim()
    || !body.categoria?.trim()
    || !Number.isFinite(body.precio)
    || body.precio! < 0
    || (body.tipo !== undefined && body.tipo !== 'Inventario' && body.tipo !== 'Renta' && body.tipo !== 'Servicio')
    || (body.existencias !== undefined && (!Number.isFinite(body.existencias) || body.existencias < 0))
    || (body.inventarioMinimo !== undefined && (!Number.isFinite(body.inventarioMinimo) || body.inventarioMinimo < 0))
    || (initialStock > 0 && (!inventoryReason || inventoryReason.length > 1000))
  ) {
    return NextResponse.json({ error: initialStock > 0 && !inventoryReason ? 'Indica el motivo de las existencias iniciales' : 'Datos de producto inválidos' }, { status: 400 })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<ProductRow>(`
      INSERT INTO app.products (sku, name, category_id, unit_price, stock, minimum_stock, track_stock, is_rental, active)
      VALUES ($1, $2, (SELECT id FROM app.product_categories WHERE name = $3), $4, $5, $6, $7, $8, true)
      RETURNING id, sku AS codigo, name AS nombre, $3::text AS categoria,
                CASE WHEN is_rental THEN 'Renta' WHEN track_stock THEN 'Inventario' ELSE 'Servicio' END AS tipo,
                unit_price AS precio, stock AS existencias,
                minimum_stock AS "inventarioMinimo", active AS activo
    `, [
      body.codigo.trim(),
      body.nombre.trim(),
      body.categoria.trim(),
      body.precio,
      initialStock,
      body.tipo === 'Inventario' ? Math.max(0, body.inventarioMinimo ?? 0) : 0,
      body.tipo === 'Inventario',
      body.tipo === 'Renta',
    ])

    if (initialStock > 0) {
      await client.query(`
        INSERT INTO app.inventory_movements
          (product_id, movement_type, quantity, stock_before, stock_after, notes)
        VALUES ($1, 'initial', $2, 0, $2, $3)
      `, [result.rows[0].id, initialStock, inventoryReason])
    }
    await client.query('COMMIT')
    return NextResponse.json(toProduct(result.rows[0]), { status: 201 })
  } catch (error) {
    await client.query('ROLLBACK')
    const databaseError = error as { code?: string; constraint?: string }
    if (databaseError.code === '23505' && databaseError.constraint?.includes('products_sku')) {
      return NextResponse.json({ error: `El código ${body.codigo.trim()} ya existe. Usa un código diferente.` }, { status: 409 })
    }
    if (databaseError.code === '23502' || databaseError.code === '23503') {
      return NextResponse.json({ error: 'La categoría seleccionada no existe.' }, { status: 400 })
    }
    console.error('POST /api/products failed', error)
    return NextResponse.json({ error: 'No se pudo guardar el producto en PostgreSQL' }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function PATCH(request: Request) {
  const authorizationError = await requireAdmin()
  if (authorizationError) return authorizationError
  const body = await request.json() as {
    codigo?: string
    nombre?: string
    nuevoCodigo?: string
    categoria?: string
    tipo?: 'Inventario' | 'Renta' | 'Servicio'
    precio?: number
    existencias?: number
    ajuste?: number
    inventarioMinimo?: number
    motivoInventario?: string
  }
  const isEdit = body.nombre !== undefined || body.nuevoCodigo !== undefined || body.categoria !== undefined || body.tipo !== undefined || body.precio !== undefined || body.inventarioMinimo !== undefined
  const isAdjustment = body.ajuste !== undefined
  if (
    !body.codigo?.trim()
    || (isAdjustment
      ? (!Number.isFinite(body.ajuste) || body.ajuste === 0)
      : (!Number.isFinite(body.existencias) || body.existencias! < 0))
    || (body.tipo !== undefined && body.tipo !== 'Inventario' && body.tipo !== 'Renta' && body.tipo !== 'Servicio')
    || (body.inventarioMinimo !== undefined && (!Number.isFinite(body.inventarioMinimo) || body.inventarioMinimo < 0))
  ) {
    return NextResponse.json({ error: 'Existencias inválidas' }, { status: 400 })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const product = await client.query<{ id: string; stock: string; sku: string; track_stock: boolean; is_rental: boolean }>(
      'SELECT id, stock, sku, track_stock, is_rental FROM app.products WHERE sku = $1 FOR UPDATE',
      [body.codigo.trim()],
    )
    if (product.rowCount === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const currentTrackStock = product.rows[0].track_stock
    const currentStock = currentTrackStock ? Number(product.rows[0].stock) : 0
    const nextTrackStock = body.tipo === undefined ? currentTrackStock : body.tipo === 'Inventario'
    const nextIsRental = body.tipo === undefined ? product.rows[0].is_rental : body.tipo === 'Renta'
    if (isAdjustment && (!currentTrackStock || !nextTrackStock)) {
      throw new Error('Solo puedes ajustar productos con inventario controlado')
    }
    const nextStock = isAdjustment
      ? currentStock + body.ajuste!
      : nextTrackStock ? body.existencias! : 0
    if (nextStock < 0) {
      throw new Error('No puedes retirar más existencias de las disponibles')
    }
    const updated = await client.query<ProductRow>(`
      UPDATE app.products p
      SET sku = COALESCE($1, p.sku),
          name = COALESCE($2, p.name),
          category_id = COALESCE((SELECT id FROM app.product_categories WHERE name = $7), p.category_id),
          unit_price = COALESCE($3, p.unit_price),
          stock = $4,
          minimum_stock = CASE WHEN $8 THEN COALESCE($5, p.minimum_stock) ELSE 0 END,
          track_stock = $8,
          is_rental = $9,
          updated_at = now()
        WHERE p.id = $6 AND ($7::text IS NULL OR EXISTS (SELECT 1 FROM app.product_categories WHERE name = $7))
        RETURNING p.id, p.sku AS codigo, p.name AS nombre,
            (SELECT name FROM app.product_categories WHERE id = p.category_id) AS categoria,
                CASE WHEN p.is_rental THEN 'Renta' WHEN p.track_stock THEN 'Inventario' ELSE 'Servicio' END AS tipo,
                p.unit_price AS precio, p.stock AS existencias,
                p.minimum_stock AS "inventarioMinimo", p.active AS activo
    `, [
      isEdit ? body.nuevoCodigo?.trim() || null : null,
      isEdit ? body.nombre?.trim() || null : null,
      isEdit ? body.precio : null,
      nextStock,
      isEdit ? body.inventarioMinimo : null,
      product.rows[0].id,
      isEdit ? body.categoria?.trim() || null : null,
      nextTrackStock,
      nextIsRental,
    ])
    if (updated.rowCount === 0) {
      throw new Error('La categoría no existe')
    }
    if ((currentTrackStock || nextTrackStock) && nextStock !== currentStock) {
      const inventoryReason = body.motivoInventario?.trim() ?? ''
      if (!inventoryReason || inventoryReason.length > 1000) {
        throw new Error('Indica el motivo del ajuste de existencias')
      }
      await client.query(`
        INSERT INTO app.inventory_movements
          (product_id, movement_type, quantity, stock_before, stock_after, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product.rows[0].id, nextStock > currentStock ? 'adjustment_in' : 'adjustment_out', Math.abs(nextStock - currentStock), currentStock, nextStock, inventoryReason])
    }
    await client.query('COMMIT')
    return NextResponse.json(toProduct(updated.rows[0]))
  } catch (error) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar el producto' }, { status: 400 })
  } finally {
    client.release()
  }
}

export async function DELETE(request: Request) {
  const authorizationError = await requireAdmin()
  if (authorizationError) return authorizationError
  const body = await request.json() as { codigo?: string }
  if (!body.codigo?.trim()) {
    return NextResponse.json({ error: 'Producto inválido' }, { status: 400 })
  }

  const result = await db.query(
    'UPDATE app.products SET active = false, updated_at = now() WHERE sku = $1 AND active = true RETURNING sku',
    [body.codigo.trim()],
  )
  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }
  return NextResponse.json({ codigo: body.codigo, eliminado: true })
}
