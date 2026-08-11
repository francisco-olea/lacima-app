import { Handshake } from 'lucide-react'
import { ModulePlaceholder } from '@/components/module-placeholder'

export default function PatrocinadoresPage() {
  return (
    <ModulePlaceholder
      icon={Handshake}
      title="Patrocinadores"
      description="Gestión de contratos de patrocinio, tiers, beneficios, horas de cancha y mercancía asociada."
      features={[
        'Alta y contrato',
        'Tier (Platino / Oro / Plata)',
        'Beneficios',
        'Horas disponibles y utilizadas',
        'Mercancía',
        'Vigencia e historial',
      ]}
    />
  )
}
