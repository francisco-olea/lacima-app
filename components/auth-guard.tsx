'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const authed = sessionStorage.getItem('lc-auth')
    const role = sessionStorage.getItem('lc-role')
    if (!authed || (role !== 'admin' && role !== 'cashier')) {
      router.replace('/login')
    } else if (role === 'cashier' && window.location.pathname !== '/pos') {
      router.replace('/pos')
    } else {
      setReady(true)
    }
  }, [router])

  if (!ready) return null
  return <>{children}</>
}
