'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    setReady(false)
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          router.replace('/login')
          return
        }
        const user = await response.json() as { role?: string }
        if (user.role === 'cashier' && pathname !== '/pos') {
          router.replace('/pos')
        } else if (user.role === 'admin' || user.role === 'cashier') {
          if (active) setReady(true)
        } else {
          router.replace('/login')
        }
      })
      .catch(() => router.replace('/login'))
    return () => { active = false }
  }, [pathname, router])

  if (!ready) return null
  return <>{children}</>
}
