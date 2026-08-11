import { IdCard } from 'lucide-react'
import { ModulePlaceholder } from '@/components/module-placeholder'

export default function MembresiasPage() {
  return (
    <ModulePlaceholder
      icon={IdCard}
      title="Membresías"
      description="Alta, edición y renovación de membresías de socios, con estado e historial completo."
      features={[
        'Alta de membresías',
        'Edición de datos',
        'Renovación',
        'Estado (activa / vencida)',
        'Historial del socio',
        'Tipos de membresía',
      ]}
    />
  )
}
