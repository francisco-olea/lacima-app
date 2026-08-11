'use client'

import { usePathname } from 'next/navigation'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    // key forces React to remount the div on route change, replaying the animation
    <div key={pathname} className="page-enter">
      {children}
    </div>
  )
}
