import { AppShell } from '@/components/app-shell'
import { AuthGuard } from '@/components/auth-guard'
import { PageTransition } from '@/components/page-transition'
import { getAuthenticatedUser } from '@/lib/auth'

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthenticatedUser()
  return (
    <AuthGuard>
      <AppShell role={user?.role ?? 'cashier'}>
        <PageTransition>{children}</PageTransition>
      </AppShell>
    </AuthGuard>
  )
}
