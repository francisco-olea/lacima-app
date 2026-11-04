export type AuthRole = 'admin' | 'cashier' | 'snacks' | 'beverages'
export type ProductCategory = 'Bebidas' | 'Snacks' | 'Equipo' | 'Ropa' | 'Servicios'

export function categoryForRole(role: AuthRole): ProductCategory | null {
  if (role === 'snacks') return 'Snacks'
  if (role === 'beverages') return 'Bebidas'
  return null
}

export function roleLabel(role: AuthRole) {
  if (role === 'snacks') return 'Snacks'
  if (role === 'beverages') return 'Bebidas'
  return role === 'admin' ? 'Administrador' : 'Caja'
}
