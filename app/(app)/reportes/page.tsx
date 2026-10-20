'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Download,
  Handshake,
  Receipt,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
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
type ReportData = {
  date: string
  sales: ReportSale[]
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
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function paymentMethod(sale: ReportSale) {
  const methods = new Set(sale.payments.map((payment) => payment.method))
  if (methods.size > 1) return 'Mixto'
  const method = sale.payments[0]?.method
  return method ? paymentLabels[method] : 'Sin pago'
}

export default function ReportesPage() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/reports', { cache: 'no-store' })
      if (!response.ok) {
        const result = await response.json() as { error?: string }
        throw new Error(result.error ?? 'No se pudieron cargar los reportes')
      }
      setReport(await response.json() as ReportData)
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

  const salesByHour = useMemo(() => {
    const amounts = new Map((report?.salesByHour ?? []).map((point) => [point.hour, point.amount]))
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      amount: amounts.get(hour) ?? 0,
    }))
  }, [report?.salesByHour])

  const maxHourlySales = Math.max(...salesByHour.map((point) => point.amount), 0)

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
