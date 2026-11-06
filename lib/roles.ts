export type AuthRole = 'admin' | 'cashier' | 'snacks' | 'beverages'
export type ProductCategory = 'Bebidas' | 'Snacks' | 'Licuados' | 'Equipo' | 'Ropa' | 'Servicios'

const snackAndBeverageCategories = ['Snacks', 'Bebidas'] as const satisfies readonly ProductCategory[]
const smoothieCategories = ['Licuados'] as const satisfies readonly ProductCategory[]

export function categoriesForRole(role: AuthRole): readonly ProductCategory[] | null {
  if (role === 'snacks') return snackAndBeverageCategories
  if (role === 'beverages') return smoothieCategories
  return null
}

export function roleLabel(role: AuthRole) {
  if (role === 'snacks') return 'Snack y Bebidas'
  if (role === 'beverages') return 'Licuados'
  return role === 'admin' ? 'Administrador' : 'Caja'
}
