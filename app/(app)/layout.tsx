import { AppShell } from '@/components/app-shell'
import { AuthGuard } from '@/components/auth-guard'
import { PageTransition } from '@/components/page-transition'

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <AppShell>
        <PageTransition>{children}</PageTransition>
      </AppShell>
    </AuthGuard>
  )
}
