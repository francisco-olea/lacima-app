'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const authed = sessionStorage.getItem('lc-auth')
    const role = sessionStorage.getItem('lc-role')
    if (!authed || (role !== 'admin' && role !== 'cashier')) {
      router.replace('/login')
    } else if (role === 'cashier' && pathname !== '/pos') {
      router.replace('/pos')
    } else {
      setReady(true)
    }
  }, [pathname, router])

  if (!ready) return null
  return <>{children}</>
}
