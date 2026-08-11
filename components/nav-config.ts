import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  IdCard,
  Handshake,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  ready?: boolean
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, ready: true },
  { label: 'Punto de Venta', href: '/pos', icon: ShoppingCart, ready: true },
  { label: 'Inventario', href: '/inventario', icon: Boxes },
  { label: 'Membresías', href: '/membresias', icon: IdCard },
  { label: 'Patrocinadores', href: '/patrocinadores', icon: Handshake },
  { label: 'Reportes', href: '/reportes', icon: BarChart3 },
  { label: 'Configuración', href: '/configuracion', icon: Settings },
]
