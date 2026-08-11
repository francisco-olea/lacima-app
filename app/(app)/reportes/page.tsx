import { BarChart3 } from 'lucide-react'
import { ModulePlaceholder } from '@/components/module-placeholder'

export default function ReportesPage() {
  return (
    <ModulePlaceholder
      icon={BarChart3}
      title="Reportes"
      description="Indicadores y reportes de ventas, productos, inventario, patrocinadores y beneficios."
      features={[
        'Reporte de ventas',
        'Productos más vendidos',
        'Movimientos de inventario',
        'Desempeño de patrocinadores',
        'Beneficios utilizados',
        'Exportación de datos',
      ]}
    />
  )
}
