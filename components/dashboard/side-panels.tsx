import {
  Boxes,
  Handshake,
  IdCard,
  ShoppingCart,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { currency } from '@/lib/data'
import type {
  DashboardActivity,
  DashboardProduct,
  DashboardSale,
} from '@/lib/dashboard-data'
import { cn } from '@/lib/utils'

const activityIcon: Record<DashboardActivity['tipo'], LucideIcon> = {
  venta: ShoppingCart,
  inventario: Boxes,
  membresia: IdCard,
  patrocinador: Handshake,
}

export function LowStockPanel({ products }: { products: DashboardProduct[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TriangleAlert className="size-4 text-destructive" />
          Inventario bajo mínimo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {p.categoria} · {currency(p.precio)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-destructive">
                {p.existencias}
              </p>
              <p className="text-xs text-muted-foreground">mín {p.inventarioMinimo}</p>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay productos por debajo del mínimo.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function relativeTime(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000))
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} día${days === 1 ? '' : 's'}`
}

export function ActivityPanel({ activity }: { activity: DashboardActivity[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4">
          {activity.map((a) => {
            const Icon = activityIcon[a.tipo]
            return (
              <li key={a.id} className="flex gap-3">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    a.tipo === 'venta' && 'bg-primary/15 text-primary',
                    a.tipo === 'inventario' && 'bg-destructive/15 text-destructive',
                    a.tipo === 'membresia' && 'bg-accent/15 text-accent',
                    a.tipo === 'patrocinador' && 'bg-muted text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{a.descripcion}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.usuario} · {relativeTime(a.fecha)}
                  </p>
                </div>
              </li>
            )
          })}
          {activity.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              No hay actividad reciente.
            </li>
          )}
        </ol>
      </CardContent>
    </Card>
  )
}

const estatusTone: Record<string, string> = {
  Completada: 'bg-accent/15 text-accent border-transparent',
  Cancelada: 'bg-muted text-muted-foreground border-transparent',
  Devuelta: 'bg-destructive/15 text-destructive border-transparent',
}

export function RecentSalesPanel({ sales }: { sales: DashboardSale[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ventas recientes</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-2 font-medium">Folio</th>
                <th className="px-6 py-2 font-medium">Hora</th>
                <th className="px-6 py-2 font-medium">Cajero</th>
                <th className="px-6 py-2 font-medium">Método</th>
                <th className="px-6 py-2 font-medium">Estatus</th>
                <th className="px-6 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="px-6 py-3 font-medium">{s.folio}</td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {new Intl.DateTimeFormat('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Mexico_City',
                    }).format(new Date(s.fecha))}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{s.usuario}</td>
                  <td className="px-6 py-3 text-muted-foreground">{s.metodoPago}</td>
                  <td className="px-6 py-3">
                    <Badge className={estatusTone[s.estatus]}>{s.estatus}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold">
                    {currency(s.total)}
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Todavía no hay ventas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
