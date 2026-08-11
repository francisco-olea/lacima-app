import {
  Banknote,
  Boxes,
  Handshake,
  Receipt,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { currency, dashboardStats } from '@/lib/data'
import { cn } from '@/lib/utils'

type Stat = {
  label: string
  value: string
  sublabel: string
  icon: LucideIcon
  tone: 'gold' | 'olive' | 'neutral' | 'warn'
}

const toneMap: Record<Stat['tone'], string> = {
  gold: 'bg-primary/15 text-primary',
  olive: 'bg-accent/15 text-accent',
  neutral: 'bg-muted text-foreground',
  warn: 'bg-destructive/15 text-destructive',
}

export function StatCards() {
  const stats: Stat[] = [
    {
      label: 'Ventas del día',
      value: currency(dashboardStats.ventasDia),
      sublabel: `${dashboardStats.ticketsDia} tickets completados`,
      icon: Banknote,
      tone: 'gold',
    },
    {
      label: 'Inventario bajo',
      value: `${dashboardStats.inventarioBajo}`,
      sublabel: 'productos bajo mínimo',
      icon: Boxes,
      tone: 'warn',
    },
    {
      label: 'Patrocinadores activos',
      value: `${dashboardStats.patrocinadoresActivos}`,
      sublabel: 'contratos vigentes',
      icon: Handshake,
      tone: 'olive',
    },
    {
      label: 'Beneficios utilizados',
      value: `${dashboardStats.beneficiosUtilizados} h`,
      sublabel: `de ${dashboardStats.beneficiosTotales} h disponibles`,
      icon: Receipt,
      tone: 'neutral',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <Card key={s.label} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{s.sublabel}</p>
              </div>
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-lg',
                  toneMap[s.tone],
                )}
              >
                <Icon className="size-5" />
              </span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
