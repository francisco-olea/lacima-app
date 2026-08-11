import { Settings } from 'lucide-react'
import { ModulePlaceholder } from '@/components/module-placeholder'

export default function ConfiguracionPage() {
  return (
    <ModulePlaceholder
      icon={Settings}
      title="Configuración"
      description="Administración de usuarios y roles, datos de la empresa, impresora de tickets y correo."
      features={[
        'Usuarios',
        'Roles y permisos',
        'Datos de la empresa',
        'Configuración de impresora',
        'Configuración de correo',
        'Preferencias del sistema',
      ]}
    />
  )
}
