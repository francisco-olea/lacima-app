import { SalesChart } from '@/components/dashboard/sales-chart'
import {
  ActivityPanel,
  LowStockPanel,
  RecentSalesPanel,
} from '@/components/dashboard/side-panels'
import { StatCards } from '@/components/dashboard/stat-cards'
import { getDashboardData } from '@/lib/dashboard-data'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const dashboard = await getDashboardData().catch((error: unknown) => {
    console.error('Dashboard data load failed', error)
    throw error
  })
  const today = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeZone: 'America/Mexico_City',
  }).format(new Date())

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Resumen del día</h2>
        <p className="text-sm text-muted-foreground">
          {today} · Datos de PostgreSQL
        </p>
      </div>

      <StatCards stats={dashboard.stats} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart salesByHour={dashboard.salesByHour} />
        </div>
        <LowStockPanel products={dashboard.lowStockProducts} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentSalesPanel sales={dashboard.recentSales} />
        </div>
        <ActivityPanel activity={dashboard.activity} />
      </div>
    </div>
  )
}
