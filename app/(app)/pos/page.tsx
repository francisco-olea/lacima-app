import { PosTerminal } from '@/components/pos/pos-terminal'
import { getAuthenticatedUser } from '@/lib/auth'

export default async function PosPage() {
  const user = await getAuthenticatedUser()
  return <PosTerminal role={user?.role ?? 'cashier'} />
}
