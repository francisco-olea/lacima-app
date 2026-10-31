'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { BarChart3, Download, Handshake, Package, Receipt, RefreshCw, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { currency } from '@/lib/data'

type ReportPayment = { method: 'cash' | 'card' | 'transfer'; amount: number }
type ReportSale = {
  id: string
  folio: string
  fecha: string
  total: number
  items: number
  payments: ReportPayment[]
}
type ReportProduct = {
  id: string
  nombre: string
  sku: string
}
type ReportData = {
  date: string
  sales: ReportSale[]
  products: ReportProduct[]
  totals: {
    sales: number
    tickets: number
    items: number
    payments: Record<'Efectivo' | 'Tarjeta' | 'Transferencia', number>
  }
  salesByHour: { hour: number; amount: number }[]
  lowStockProducts: {
    id: string
    nombre: string
    categoria: string
    existencias: number
    inventarioMinimo: number
  }[]
  sponsors: { active: number; hoursUsed: number; hoursTotal: number }
}
type ProductDailySales = { fecha: string; unidades: number; ventas: number }
type ProductTrend = { product: ReportProduct; dailySales: ProductDailySales[] }

const productChartConfig = {
  ventas: { label: 'Ventas', color: 'var(--primary)' },
  unidades: { label: 'Unidades', color: 'var(--accent)' },
} satisfies ChartConfig

const methodColors: Record<string, string> = {
  Efectivo: 'bg-accent/15 text-accent border-transparent',
  Tarjeta: 'bg-primary/15 text-primary border-transparent',
  Transferencia: 'bg-muted text-foreground border-transparent',
  Mixto: 'bg-secondary text-secondary-foreground border-transparent',
}

const paymentLabels: Record<ReportPayment['method'], string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  })
}

function formatDate(value: string) {
  const [, year, month, day] = value.match(/^(\d{4})-(\d{2})-(\d{2})/) ?? []
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function formatShortDate(value: string) {
  const [, , month, day] = value.match(/^(\d{4})-(\d{2})-(\d{2})/) ?? []
  if (!month || !day) return value
  return `${day}/${month}`
}

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })
}

function paymentMethod(sale: ReportSale) {
  const methods = new Set(sale.payments.map((payment) => payment.method))
  if (methods.size > 1) return 'Mixto'
  const method = sale.payments[0]?.method
  return method ? paymentLabels[method] : 'Sin pago'
}

function formatQuantity(value: number) {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 3 })
}

export default function ReportesPage() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [productTrend, setProductTrend] = useState<ProductTrend | null>(null)
  const [productTrendLoading, setProductTrendLoading] = useState(false)
  const [productTrendError, setProductTrendError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/reports', { cache: 'no-store' })
      if (!response.ok) {
        const result = await response.json() as { error?: string }
        throw new Error(result.error ?? 'No se pudieron cargar los reportes')
      }
      const result = await response.json() as ReportData
      setReport(result)
      setSelectedMonth((current) => current || result.date.slice(0, 7))
      setSelectedProductId((current) => (
        result.products.some((product) => product.id === current)
          ? current
          : result.products[0]?.id ?? ''
      ))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudieron cargar los reportes'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  useEffect(() => {
    if (!selectedProductId) {
      setProductTrend(null)
      setProductTrendError(null)
      setProductTrendLoading(false)
      return
    }

    const controller = new AbortController()
    async function loadProductTrend() {
      setProductTrendLoading(true)
      setProductTrendError(null)
      setProductTrend(null)
      try {
        const response = await fetch(
          `/api/reports/products?productId=${encodeURIComponent(selectedProductId)}&month=${encodeURIComponent(selectedMonth)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        if (!response.ok) {
          const result = await response.json() as { error?: string }
          throw new Error(result.error ?? 'No se pudieron cargar las ventas del producto')
        }
        setProductTrend(await response.json() as ProductTrend)
      } catch (cause) {
        if (controller.signal.aborted) return
        const message = cause instanceof Error ? cause.message : 'No se pudieron cargar las ventas del producto'
        setProductTrendError(message)
        toast.error(message)
      } finally {
        if (!controller.signal.aborted) setProductTrendLoading(false)
      }
    }

    void loadProductTrend()
    return () => controller.abort()
  }, [selectedProductId, selectedMonth])

  const salesByHour = useMemo(() => {
    const amounts = new Map((report?.salesByHour ?? []).map((point) => [point.hour, point.amount]))
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      amount: amounts.get(hour) ?? 0,
    }))
  }, [report?.salesByHour])

  const maxHourlySales = Math.max(...salesByHour.map((point) => point.amount), 0)
  const productTotals = useMemo(() => (productTrend?.dailySales ?? []).reduce(
    (totals, day) => ({
      unidades: totals.unidades + day.unidades,
      ventas: totals.ventas + day.ventas,
    }),
    { unidades: 0, ventas: 0 },
  ), [productTrend?.dailySales])

  function exportCsv() {
    if (!report) return
    const header = 'Folio,Fecha,Metodo,Articulos,Total'
    const rows = report.sales.map((sale) => [
      sale.folio,
      formatDateTime(sale.fecha),
      paymentMethod(sale),
      sale.items,
      sale.total,
    ].join(','))
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-ventas-${report.date}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const totals = report?.totals
  const sponsors = report?.sponsors
  const hoursUsedPercent = sponsors && sponsors.hoursTotal > 0
    ? Math.min(100, (sponsors.hoursUsed / sponsors.hoursTotal) * 100)
    : 0

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Información registrada en la base de datos · {report ? formatDate(report.date) : 'Hoy'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadReport()} disabled={loading} className="gap-2">
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={loading || !report} className="gap-2">
            <Download className="size-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadReport()}>Reintentar</Button>
        </div>
      )}

      <section aria-label="Indicadores generales" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Ventas del día</p>
          <p className="mt-1 text-3xl font-semibold text-primary">{loading ? '…' : totals ? currency(totals.sales) : '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{totals ? `${totals.tickets} tickets completados` : 'Datos no disponibles'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Ticket promedio</p>
          <p className="mt-1 text-3xl font-semibold">
            {loading ? '…' : totals ? currency(totals.tickets > 0 ? totals.sales / totals.tickets : 0) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{totals ? `${totals.items} artículos vendidos` : 'Datos no disponibles'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Inventario bajo</p>
          <p className="mt-1 text-3xl font-semibold text-destructive">
            {loading ? '…' : report ? report.lowStockProducts.length : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">productos bajo mínimo</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Patrocinadores activos</p>
          <p className="mt-1 text-3xl font-semibold text-accent">{loading ? '…' : sponsors ? sponsors.active : '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sponsors ? `${sponsors.hoursUsed} de ${sponsors.hoursTotal} horas usadas` : 'Datos no disponibles'}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="size-5 text-primary" /> Ventas por hora
            </CardTitle>
            <p className="text-sm text-muted-foreground">Ventas completadas de hoy, agrupadas por hora.</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Cargando datos…</div>
            ) : !report ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Datos no disponibles.</div>
            ) : maxHourlySales === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No hay ventas registradas hoy.</div>
            ) : (
              <div className="flex h-64 items-end gap-2 overflow-x-auto border-b border-border px-1 pt-5">
                {salesByHour.map((point) => {
                  const height = point.amount > 0 ? Math.max(8, (point.amount / maxHourlySales) * 100) : 0
                  return (
                    <div key={point.hour} className="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-2">
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {point.amount > 0 ? currency(point.amount) : ''}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-primary/75 transition-all hover:bg-primary"
                        style={{ height: `${height}%` }}
                        title={`${String(point.hour).padStart(2, '0')}:00: ${currency(point.amount)}`}
                      />
                      <span className="text-xs text-muted-foreground">{String(point.hour).padStart(2, '0')}h</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ventas por método</CardTitle>
            <p className="text-sm text-muted-foreground">Distribución del ingreso registrado hoy.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['Efectivo', 'Tarjeta', 'Transferencia'] as const).map((method) => {
              const value = totals?.payments[method]
              const percentage = totals && totals.sales > 0 ? ((value ?? 0) / totals.sales) * 100 : 0
              return (
                <div key={method}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{method}</span>
                    <span className="font-semibold">{loading ? '…' : value !== undefined ? currency(value) : '—'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {totals ? `${percentage.toFixed(0)}% del total` : 'Datos no disponibles'}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <Package className="size-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Ventas por producto</h2>
              <p className="text-sm text-muted-foreground">
                Comportamiento diario del mes seleccionado.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <span>Mes y año</span>
              <input
                type="month"
                aria-label="Seleccionar mes y año del historial de ventas"
                value={selectedMonth}
                max={report?.date.slice(0, 7)}
                onChange={(event) => setSelectedMonth(event.target.value)}
                disabled={loading || !report}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <span>Producto</span>
              <select
                aria-label="Seleccionar producto para consultar sus ventas"
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                disabled={loading || !report?.products.length}
                className="h-10 min-w-56 rounded-lg border border-input bg-background px-3 text-sm"
              >
                {report?.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.nombre} · {product.sku}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <CardContent className="space-y-4 p-5">
          {productTrend && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{productTrend.product.nombre}</p>
                <p className="text-xs text-muted-foreground">{productTrend.product.sku}</p>
              </div>
              <div className="flex gap-5">
                <div>
                  <p className="text-xs text-muted-foreground">Unidades en {formatMonth(selectedMonth)}</p>
                  <p className="font-semibold">{formatQuantity(productTotals.unidades)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ventas en {formatMonth(selectedMonth)}</p>
                  <p className="font-semibold">{currency(productTotals.ventas)}</p>
                </div>
              </div>
            </div>
          )}
          {productTrendLoading ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              Cargando ventas del producto…
            </div>
          ) : productTrendError ? (
            <div role="alert" className="flex h-72 items-center justify-center text-sm text-destructive">
              {productTrendError}
            </div>
          ) : loading ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              Cargando productos…
            </div>
          ) : !report?.products.length ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              No hay productos disponibles para consultar.
            </div>
          ) : productTrend ? (
            <ChartContainer config={productChartConfig} className="h-72 w-full">
              <AreaChart data={productTrend.dailySales} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillProductSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-ventas)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-ventas)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="fecha"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={20}
                  tickFormatter={formatShortDate}
                />
                <YAxis
                  yAxisId="revenue"
                  tickLine={false}
                  axisLine={false}
                  width={76}
                  tickFormatter={(value) => currency(Number(value))}
                />
                <YAxis
                  yAxisId="quantity"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value) => formatQuantity(Number(value))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => formatDate(String(label))}
                      formatter={(value, name) => name === 'ventas'
                        ? currency(Number(value))
                        : `${formatQuantity(Number(value))} unidades`}
                    />
                  }
                />
                <Area
                  yAxisId="revenue"
                  dataKey="ventas"
                  type="monotone"
                  stroke="var(--color-ventas)"
                  strokeWidth={2}
                  fill="url(#fillProductSales)"
                />
                <Line
                  yAxisId="quantity"
                  dataKey="unidades"
                  type="monotone"
                  stroke="var(--color-unidades)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TriangleAlert className="size-5 text-destructive" /> Inventario bajo mínimo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando inventario…</p>
            ) : report?.lowStockProducts.length ? report.lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{product.nombre}</p>
                  <p className="text-xs text-muted-foreground">{product.categoria} · mínimo {product.inventarioMinimo}</p>
                </div>
                <Badge variant="destructive">{product.existencias} unidades</Badge>
              </div>
            )) : report ? (
              <p className="text-sm text-muted-foreground">No hay productos registrados bajo su mínimo.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Handshake className="size-5 text-accent" /> Beneficios de patrocinadores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>Horas utilizadas</span>
                <span className="font-semibold">
                  {sponsors ? `${sponsors.hoursUsed} / ${sponsors.hoursTotal} h` : '—'}
                </span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${hoursUsedPercent}%` }} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {sponsors
                ? `${Math.max(0, sponsors.hoursTotal - sponsors.hoursUsed)} horas disponibles para contratos vigentes.`
                : 'Datos no disponibles'}
            </p>
            <Button variant="outline" className="w-full" onClick={() => window.location.assign('/patrocinadores')}>
              Ver patrocinadores
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Receipt className="size-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Detalle de ventas</h2>
            <p className="text-sm text-muted-foreground">Ventas completadas registradas hoy en la base de datos.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Folio</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Método</th>
                <th className="px-5 py-3">Artículos</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report?.sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono font-semibold text-primary">{sale.folio}</td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDateTime(sale.fecha)}</td>
                  <td className="px-5 py-3">
                    <Badge className={methodColors[paymentMethod(sale)]}>{paymentMethod(sale)}</Badge>
                  </td>
                  <td className="px-5 py-3">{sale.items}</td>
                  <td className="px-5 py-3 text-right font-semibold">{currency(sale.total)}</td>
                </tr>
              ))}
              {!loading && report?.sales.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    No hay ventas completadas registradas hoy.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">Cargando ventas…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
