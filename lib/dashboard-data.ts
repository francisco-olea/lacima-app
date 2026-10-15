import { db } from '@/lib/db'

export type DashboardStats = {
  ventasDia: number
  ticketsDia: number
  inventarioBajo: number
  patrocinadoresActivos: number
  beneficiosUtilizados: number
  beneficiosTotales: number
}

export type DashboardProduct = {
  id: string
  nombre: string
  categoria: string
  precio: number
  existencias: number
  inventarioMinimo: number
}

export type DashboardSale = {
  id: string
  folio: string
  fecha: string
  usuario: string
  metodoPago: string
  estatus: 'Completada' | 'Cancelada' | 'Devuelta'
  total: number
}

export type DashboardActivity = {
  id: string
  tipo: 'venta' | 'inventario' | 'membresia' | 'patrocinador'
  descripcion: string
  usuario: string
  fecha: string
}

export type DashboardData = {
  stats: DashboardStats
  salesByHour: { hora: string; ventas: number }[]
  lowStockProducts: DashboardProduct[]
  recentSales: DashboardSale[]
  activity: DashboardActivity[]
}

type StatsRow = {
  ventasDia: string
  ticketsDia: string
  inventarioBajo: string
  patrocinadoresActivos: string
  beneficiosUtilizados: string
  beneficiosTotales: string
}

export async function getDashboardData(): Promise<DashboardData> {
  const [stats, salesByHour, lowStockProducts, recentSales, activity] = await Promise.all([
    db.query<StatsRow>(`
      WITH today AS (
        SELECT (date_trunc('day', now() AT TIME ZONE 'America/Mexico_City')
          AT TIME ZONE 'America/Mexico_City') AS starts_at,
          ((date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') + interval '1 day')
          AT TIME ZONE 'America/Mexico_City') AS ends_at
      )
      SELECT
        COALESCE((SELECT SUM(s.total) FROM app.sales s, today
          WHERE s.status = 'completed' AND s.sold_at >= today.starts_at AND s.sold_at < today.ends_at), 0) AS "ventasDia",
        (SELECT COUNT(*) FROM app.sales s, today
          WHERE s.status = 'completed' AND s.sold_at >= today.starts_at AND s.sold_at < today.ends_at) AS "ticketsDia",
        (SELECT COUNT(*) FROM app.products p
          WHERE p.active = true AND p.minimum_stock > 0 AND p.stock <= p.minimum_stock) AS "inventarioBajo",
        (SELECT COUNT(*) FROM app.sponsors s
          WHERE s.active = true
            AND s.starts_on <= (now() AT TIME ZONE 'America/Mexico_City')::date
            AND s.ends_on >= (now() AT TIME ZONE 'America/Mexico_City')::date) AS "patrocinadoresActivos",
        COALESCE((SELECT SUM(u.quantity) FROM app.sponsor_benefit_usages u
          JOIN app.sponsors s ON s.id = u.sponsor_id
          WHERE s.active = true
            AND s.starts_on <= (now() AT TIME ZONE 'America/Mexico_City')::date
            AND s.ends_on >= (now() AT TIME ZONE 'America/Mexico_City')::date
            AND u.benefit_type = 'court_hours'), 0) AS "beneficiosUtilizados",
        COALESCE((SELECT SUM(s.benefit_hours) FROM app.sponsors s
          WHERE s.active = true
            AND s.starts_on <= (now() AT TIME ZONE 'America/Mexico_City')::date
            AND s.ends_on >= (now() AT TIME ZONE 'America/Mexico_City')::date), 0) AS "beneficiosTotales"
    `),
    db.query<{ hora: string; ventas: string }>(`
      WITH bounds AS (
        SELECT date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AS day_start,
          date_trunc('hour', now() AT TIME ZONE 'America/Mexico_City') AS current_hour
      ), hours AS (
        SELECT generate_series(day_start, current_hour, interval '1 hour') AS hour
        FROM bounds
      )
      SELECT to_char(hours.hour, 'HH24:00') AS hora,
        COALESCE(SUM(s.total), 0) AS ventas
      FROM hours
      LEFT JOIN app.sales s ON s.status = 'completed'
        AND s.sold_at >= hours.hour AT TIME ZONE 'America/Mexico_City'
        AND s.sold_at < (hours.hour + interval '1 hour') AT TIME ZONE 'America/Mexico_City'
      GROUP BY hours.hour
      ORDER BY hours.hour
    `),
    db.query<DashboardProduct>(`
      SELECT p.id, p.name AS nombre, c.name AS categoria, p.unit_price AS precio,
        p.stock AS existencias, p.minimum_stock AS "inventarioMinimo"
      FROM app.products p
      JOIN app.product_categories c ON c.id = p.category_id
      WHERE p.active = true AND p.minimum_stock > 0 AND p.stock <= p.minimum_stock
      ORDER BY p.stock ASC, p.name
      LIMIT 8
    `),
    db.query<DashboardSale>(`
      SELECT s.id, s.folio, s.sold_at AS fecha, COALESCE(u.full_name, 'Sin cajero') AS usuario,
        COALESCE((
          SELECT string_agg(DISTINCT CASE sp.payment_method
            WHEN 'cash' THEN 'Efectivo'
            WHEN 'card' THEN 'Tarjeta'
            WHEN 'transfer' THEN 'Transferencia'
          END, ', ')
          FROM app.sale_payments sp WHERE sp.sale_id = s.id
        ), 'Sin pago') AS "metodoPago",
        CASE s.status
          WHEN 'completed' THEN 'Completada'
          WHEN 'cancelled' THEN 'Cancelada'
          WHEN 'refunded' THEN 'Devuelta'
        END AS estatus,
        s.total
      FROM app.sales s
      LEFT JOIN app.users u ON u.id = s.cashier_id
      ORDER BY s.sold_at DESC
      LIMIT 8
    `),
    db.query<DashboardActivity>(`
      SELECT id, tipo, descripcion, COALESCE(usuario, 'Sistema') AS usuario, fecha
      FROM (
        SELECT s.id::text, 'venta'::text AS tipo,
          'Venta ' || s.folio || ' por $' || to_char(s.total, 'FM999999990.00') AS descripcion,
          u.full_name AS usuario, s.sold_at AS fecha
        FROM app.sales s
        LEFT JOIN app.users u ON u.id = s.cashier_id
        UNION ALL
        SELECT m.id::text, 'inventario'::text AS tipo,
          CASE m.movement_type
            WHEN 'purchase' THEN 'Entrada de '
            WHEN 'adjustment_in' THEN 'Ajuste de entrada de '
            WHEN 'adjustment_out' THEN 'Ajuste de salida de '
            WHEN 'return' THEN 'Devolución de '
            WHEN 'sale' THEN 'Salida por venta de '
            ELSE 'Movimiento de '
          END || to_char(m.quantity, 'FM999999990.###') || ' · ' || p.name AS descripcion,
          u.full_name AS usuario, m.created_at AS fecha
        FROM app.inventory_movements m
        JOIN app.products p ON p.id = m.product_id
        LEFT JOIN app.users u ON u.id = m.user_id
        UNION ALL
        SELECT e.id::text, 'membresia'::text AS tipo,
          CASE e.event_type
            WHEN 'created' THEN 'Membresía creada para '
            WHEN 'renewed' THEN 'Membresía renovada para '
            WHEN 'suspended' THEN 'Membresía suspendida para '
            WHEN 'reactivated' THEN 'Membresía reactivada para '
            WHEN 'cancelled' THEN 'Membresía cancelada para '
            WHEN 'expired' THEN 'Membresía vencida para '
            ELSE 'Membresía actualizada para '
          END || m.full_name AS descripcion,
          u.full_name AS usuario, e.created_at AS fecha
        FROM app.membership_events e
        JOIN app.members m ON m.id = e.member_id
        LEFT JOIN app.users u ON u.id = e.user_id
        UNION ALL
        SELECT b.id::text, 'patrocinador'::text AS tipo,
          'Beneficio usado · ' || s.company_name || ' (' ||
            to_char(b.quantity, 'FM999999990.##') || ' h)' AS descripcion,
          u.full_name AS usuario, b.used_at AS fecha
        FROM app.sponsor_benefit_usages b
        JOIN app.sponsors s ON s.id = b.sponsor_id
        LEFT JOIN app.users u ON u.id = b.user_id
      ) events
      ORDER BY fecha DESC
      LIMIT 8
    `),
  ])

  const totals = stats.rows[0]
  return {
    stats: {
      ventasDia: Number(totals.ventasDia),
      ticketsDia: Number(totals.ticketsDia),
      inventarioBajo: Number(totals.inventarioBajo),
      patrocinadoresActivos: Number(totals.patrocinadoresActivos),
      beneficiosUtilizados: Number(totals.beneficiosUtilizados),
      beneficiosTotales: Number(totals.beneficiosTotales),
    },
    salesByHour: salesByHour.rows.map((row) => ({ hora: row.hora, ventas: Number(row.ventas) })),
    lowStockProducts: lowStockProducts.rows.map((row) => ({
      ...row,
      precio: Number(row.precio),
      existencias: Number(row.existencias),
      inventarioMinimo: Number(row.inventarioMinimo),
    })),
    recentSales: recentSales.rows.map((row) => ({
      ...row,
      fecha: new Date(row.fecha).toISOString(),
      total: Number(row.total),
    })),
    activity: activity.rows.map((row) => ({
      ...row,
      fecha: new Date(row.fecha).toISOString(),
    })),
  }
}
