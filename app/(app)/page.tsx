import { SalesChart } from '@/components/dashboard/sales-chart'
import {
  ActivityPanel,
  LowStockPanel,
  RecentSalesPanel,
} from '@/components/dashboard/side-panels'
import { StatCards } from '@/components/dashboard/stat-cards'

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Resumen del día</h2>
        <p className="text-sm text-muted-foreground">
          Miércoles 7 de agosto · Operación en tiempo real
        </p>
      </div>

      <StatCards />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <LowStockPanel />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentSalesPanel />
        </div>
        <ActivityPanel />
      </div>
    </div>
  )
}
