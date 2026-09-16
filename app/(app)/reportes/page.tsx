'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Download,
  Handshake,
  Receipt,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { currency, dashboardStats, lowStockProducts, recentSales, salesByHour } from '@/lib/data'

const SALES_STORAGE_KEY = 'lc-sales'

type StoredSale = {
  id: string
  folio: string
  fecha: string
  hora: string
  total: number
  metodo: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Mixto'
  items: number
}

const methodColors: Record<string, string> = {
  Efectivo: 'bg-accent/15 text-accent border-transparent',
  Tarjeta: 'bg-primary/15 text-primary border-transparent',
  Transferencia: 'bg-muted text-foreground border-transparent',
  Mixto: 'bg-secondary text-secondary-foreground border-transparent',
}

export default function ReportesPage() {
  const [storedSales, setStoredSales] = useState<StoredSale[]>([])

  function loadSales() {
    const saved = JSON.parse(localStorage.getItem(SALES_STORAGE_KEY) ?? '[]') as StoredSale[]
    setStoredSales(saved)
  }

  useEffect(() => {
    loadSales()
  }, [])

  const sales = useMemo(() => {
    if (storedSales.length > 0) return storedSales
    return recentSales.map((sale) => ({
      id: sale.id,
      folio: sale.folio,
      fecha: sale.fecha,
      hora: sale.fecha.split(' ')[1],
      total: sale.total,
      metodo: sale.metodoPago,
      items: sale.items,
    }))
  }, [storedSales])

  const totalSales = storedSales.length > 0
    ? storedSales.reduce((sum, sale) => sum + sale.total, 0)
    : dashboardStats.ventasDia
  const totalItems = sales.reduce((sum, sale) => sum + sale.items, 0)
  const averageTicket = sales.length > 0 ? totalSales / sales.length : 0
  const paymentTotals = sales.reduce<Record<string, number>>((totals, sale) => {
    totals[sale.metodo] = (totals[sale.metodo] ?? 0) + sale.total
    return totals
  }, {})

  function exportCsv() {
    const header = 'Folio,Fecha,Metodo,Articulos,Total'
    const rows = sales.map((sale) => [sale.folio, sale.fecha, sale.metodo, sale.items, sale.total].join(','))
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'reporte-ventas-lacima.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight">Reportes</p>
          <p className="mt-1 text-base text-muted-foreground">Indicadores operativos de ventas, inventario y patrocinadores.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSales} className="gap-2"><RefreshCw className="size-4" /><span className="hidden sm:inline">Actualizar</span></Button>
          <Button variant="outline" onClick={exportCsv} className="gap-2"><Download className="size-4" /><span className="hidden sm:inline">Exportar CSV</span></Button>
        </div>
      </div>

      <section aria-label="Indicadores generales" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Ventas del día</p><p className="mt-1 text-3xl font-semibold text-primary">{currency(totalSales)}</p><p className="mt-1 text-xs text-muted-foreground">{storedSales.length || dashboardStats.ticketsDia} tickets completados</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Ticket promedio</p><p className="mt-1 text-3xl font-semibold">{currency(averageTicket)}</p><p className="mt-1 text-xs text-muted-foreground">{totalItems} artículos vendidos</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Inventario bajo</p><p className="mt-1 text-3xl font-semibold text-destructive">{dashboardStats.inventarioBajo}</p><p className="mt-1 text-xs text-muted-foreground">productos bajo mínimo</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Patrocinadores activos</p><p className="mt-1 text-3xl font-semibold text-accent">{dashboardStats.patrocinadoresActivos}</p><p className="mt-1 text-xs text-muted-foreground">{dashboardStats.beneficiosUtilizados} de {dashboardStats.beneficiosTotales} horas usadas</p></Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="size-5 text-primary" /> Ventas por hora</CardTitle><p className="text-sm text-muted-foreground">Ingresos registrados durante la jornada.</p></CardHeader>
          <CardContent><div className="flex h-64 items-end gap-2 border-b border-border px-1 pb-0 pt-5">{salesByHour.map((point) => { const height = Math.max(8, (point.ventas / Math.max(...salesByHour.map((item) => item.ventas))) * 100); return <div key={point.hora} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] text-muted-foreground">${(point.ventas / 1000).toFixed(1)}k</span><div className="w-full rounded-t-md bg-primary/75 transition-all hover:bg-primary" style={{ height: `${height}%` }} title={`${point.hora}: ${currency(point.ventas)}`} /><span className="text-xs text-muted-foreground">{point.hora}</span></div> })}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Ventas por método</CardTitle><p className="text-sm text-muted-foreground">Distribución del ingreso registrado.</p></CardHeader>
          <CardContent className="space-y-4">{(['Efectivo', 'Tarjeta', 'Transferencia'] as const).map((method) => { const value = paymentTotals[method] ?? 0; const percentage = totalSales > 0 ? (value / totalSales) * 100 : 0; return <div key={method}><div className="mb-1 flex justify-between text-sm"><span>{method}</span><span className="font-semibold">{currency(value)}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{percentage.toFixed(0)}% del total</p></div> })}</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TriangleAlert className="size-5 text-destructive" /> Inventario bajo mínimo</CardTitle></CardHeader><CardContent className="space-y-2">{lowStockProducts.map((product) => <div key={product.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"><div><p className="text-sm font-medium">{product.nombre}</p><p className="text-xs text-muted-foreground">{product.categoria} · mínimo {product.inventarioMinimo}</p></div><Badge variant="destructive">{product.existencias} unidades</Badge></div>)}</CardContent></Card>
  <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Handshake className="size-5 text-accent" /> Beneficios de patrocinadores</CardTitle></CardHeader><CardContent className="space-y-4"><div><div className="flex justify-between text-sm"><span>Horas utilizadas</span><span className="font-semibold">{dashboardStats.beneficiosUtilizados} / {dashboardStats.beneficiosTotales} h</span></div><div className="mt-2 h-3 rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${(dashboardStats.beneficiosUtilizados / dashboardStats.beneficiosTotales) * 100}%` }} /></div></div><p className="text-sm text-muted-foreground">{dashboardStats.beneficiosTotales - dashboardStats.beneficiosUtilizados} horas disponibles para contratos vigentes.</p><Button variant="outline" className="w-full" onClick={() => window.location.assign('/patrocinadores')}>Ver patrocinadores</Button></CardContent></Card>
      </section>

      <Card className="overflow-hidden p-0"><div className="flex items-center gap-3 border-b border-border px-5 py-4"><Receipt className="size-5 text-primary" /><div><h2 className="text-lg font-semibold">Detalle de ventas</h2><p className="text-sm text-muted-foreground">Folios consecutivos y únicos de las operaciones registradas.</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Folio</th><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Método</th><th className="px-5 py-3">Artículos</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-border">{sales.map((sale) => <tr key={sale.id} className="hover:bg-muted/30"><td className="px-5 py-3 font-mono font-semibold text-primary">{sale.folio}</td><td className="px-5 py-3 text-muted-foreground">{sale.fecha}</td><td className="px-5 py-3"><Badge className={methodColors[sale.metodo]}>{sale.metodo}</Badge></td><td className="px-5 py-3">{sale.items}</td><td className="px-5 py-3 text-right font-semibold">{currency(sale.total)}</td></tr>)}</tbody></table></div></Card>
    </div>
  )
}
