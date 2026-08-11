'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Boxes,
  ChevronUp,
  Handshake,
  IdCard,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Wifi,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PRIMARY_NAV = [
  { label: 'Punto de Venta', href: '/pos', icon: ShoppingCart, ready: true },
  { label: 'Inventario', href: '/inventario', icon: Boxes, ready: false },
  { label: 'Membresías', href: '/membresias', icon: IdCard, ready: false },
]

const MORE_NAV = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, ready: true },
  { label: 'Patrocinadores', href: '/patrocinadores', icon: Handshake, ready: false },
  { label: 'Reportes', href: '/reportes', icon: BarChart3, ready: false },
  { label: 'Configuración', href: '/configuracion', icon: Settings, ready: false },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // Find current page label
  const allNav = [...PRIMARY_NAV, ...MORE_NAV]
  const current = allNav.find((i) => isActive(pathname, i.href))
  const moreIsActive = MORE_NAV.some((i) => isActive(pathname, i.href))

  // Close "Más" popover on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Topbar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md md:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="relative size-8 shrink-0 overflow-hidden rounded-md bg-sidebar">
            <Image
              src="/logolacima-nobg.png"
              alt="La Cima Padel Club"
              fill
              className="object-contain p-0.5"
              sizes="32px"
            />
          </div>
        </div>

        <div className="mx-3 h-5 w-px bg-border" />

        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          {current?.label ?? 'Dashboard'}
        </h1>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-accent sm:flex">
            <Wifi className="size-3" />
            En línea
          </span>
          <ThemeToggle />
          <div className="ml-1 flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5">
            <Avatar className="size-6">
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                FB
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Page content — leaves space for bottom nav */}
      <main className="flex-1 overflow-auto pb-20 p-4 md:p-6">{children}</main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 flex items-stretch border-t border-sidebar-border bg-sidebar"
        aria-label="Navegación principal"
      >
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors',
                active
                  ? 'text-sidebar-primary'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('size-5', active && 'drop-shadow-sm')} />
              <span className="truncate">{item.label === 'Punto de Venta' ? 'Venta' : item.label}</span>
            </Link>
          )
        })}

        {/* Más */}
        <div ref={moreRef} className="relative flex flex-1">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={cn(
              'flex w-full flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors',
              moreIsActive || moreOpen
                ? 'text-sidebar-primary'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground',
            )}
          >
            <ChevronUp
              className={cn(
                'size-5 transition-transform duration-200',
                moreOpen ? 'rotate-180' : 'rotate-0',
              )}
            />
            <span>Más</span>
          </button>

          {/* Popover */}
          {moreOpen && (
            <div
              role="menu"
              className="absolute bottom-full right-0 mb-1 w-52 rounded-xl border border-sidebar-border bg-sidebar shadow-2xl shadow-black/40 overflow-hidden"
            >
              {MORE_NAV.map((item) => {
                const active = isActive(pathname, item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-primary'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {!item.ready && (
                      <span className="rounded-full bg-sidebar-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-sidebar-foreground/40">
                        Pronto
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}
