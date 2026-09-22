import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type ProductRow = {
  id: string
  codigo: string
  nombre: string
  categoria: string
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
    precio: Number(row.precio),
    existencias: Number(row.existencias),
    inventarioMinimo: Number(row.inventarioMinimo),
    activo: row.activo,
  }
}

export async function GET() {
  try {
    const result = await db.query<ProductRow>(`
      SELECT p.id, p.sku AS codigo, p.name AS nombre, c.name AS categoria,
             p.unit_price AS precio, p.stock AS existencias,
             p.minimum_stock AS "inventarioMinimo", p.active AS activo
      FROM app.products p
      JOIN app.product_categories c ON c.id = p.category_id
      WHERE p.active = true
      ORDER BY p.name
    `)
    return NextResponse.json(result.rows.map(toProduct), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('GET /api/products failed', error)
    return NextResponse.json({ error: 'No se pudo consultar el inventario en PostgreSQL' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const body = await request.json() as {
    codigo?: string
    nombre?: string
    categoria?: string
    precio?: number
    existencias?: number
    inventarioMinimo?: number
  }

  if (!body.codigo?.trim() || !body.nombre?.trim() || !body.categoria?.trim() || !Number.isFinite(body.precio) || body.precio! < 0) {
    return NextResponse.json({ error: 'Datos de producto inválidos' }, { status: 400 })
  }

  try {
    const result = await db.query<ProductRow>(`
      INSERT INTO app.products (sku, name, category_id, unit_price, stock, minimum_stock, active)
      VALUES ($1, $2, (SELECT id FROM app.product_categories WHERE name = $3), $4, $5, $6, true)
      RETURNING id, sku AS codigo, name AS nombre, $3::text AS categoria,
                unit_price AS precio, stock AS existencias,
                minimum_stock AS "inventarioMinimo", active AS activo
    `, [body.codigo.trim(), body.nombre.trim(), body.categoria.trim(), body.precio, Math.max(0, body.existencias ?? 0), Math.max(0, body.inventarioMinimo ?? 0)])

    return NextResponse.json(toProduct(result.rows[0]), { status: 201 })
  } catch (error) {
    const databaseError = error as { code?: string; constraint?: string }
    if (databaseError.code === '23505' && databaseError.constraint?.includes('products_sku')) {
      return NextResponse.json({ error: `El código ${body.codigo.trim()} ya existe. Usa un código diferente.` }, { status: 409 })
    }
    if (databaseError.code === '23502' || databaseError.code === '23503') {
      return NextResponse.json({ error: 'La categoría seleccionada no existe.' }, { status: 400 })
    }
    console.error('POST /api/products failed', error)
    return NextResponse.json({ error: 'No se pudo guardar el producto en PostgreSQL' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const body = await request.json() as {
    codigo?: string
    nombre?: string
    nuevoCodigo?: string
    categoria?: string
    precio?: number
    existencias?: number
    inventarioMinimo?: number
  }
  const isEdit = body.nombre !== undefined || body.nuevoCodigo !== undefined || body.categoria !== undefined || body.precio !== undefined || body.inventarioMinimo !== undefined
  if (!body.codigo?.trim() || !Number.isFinite(body.existencias) || body.existencias! < 0) {
    return NextResponse.json({ error: 'Existencias inválidas' }, { status: 400 })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const product = await client.query<{ id: string; stock: string; sku: string }>(
      'SELECT id, stock, sku FROM app.products WHERE sku = $1 FOR UPDATE',
      [body.codigo.trim()],
    )
    if (product.rowCount === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    const currentStock = Number(product.rows[0].stock)
    const nextStock = body.existencias!
    const updated = await client.query<ProductRow>(`
      UPDATE app.products p
      SET sku = COALESCE($1, p.sku),
          name = COALESCE($2, p.name),
          category_id = COALESCE((SELECT id FROM app.product_categories WHERE name = $7), p.category_id),
          unit_price = COALESCE($3, p.unit_price),
          stock = $4,
          minimum_stock = COALESCE($5, p.minimum_stock),
          updated_at = now()
        WHERE p.id = $6 AND ($7::text IS NULL OR EXISTS (SELECT 1 FROM app.product_categories WHERE name = $7))
        RETURNING p.id, p.sku AS codigo, p.name AS nombre,
            (SELECT name FROM app.product_categories WHERE id = p.category_id) AS categoria,
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
    ])
    if (updated.rowCount === 0) {
      throw new Error('La categoría no existe')
    }
    if (nextStock !== currentStock) {
      await client.query(`
        INSERT INTO app.inventory_movements
          (product_id, movement_type, quantity, stock_before, stock_after, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [product.rows[0].id, nextStock > currentStock ? 'adjustment_in' : 'adjustment_out', Math.abs(nextStock - currentStock), currentStock, nextStock, 'Ajuste desde inventario'])
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
