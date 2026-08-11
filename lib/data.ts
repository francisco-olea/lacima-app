// Datos de ejemplo (mock) para el prototipo de La Cima Padel Club.
// Se reemplazarán por una base de datos real en una fase posterior.

export type Product = {
  id: string
  codigo: string
  nombre: string
  categoria: 'Bebidas' | 'Snacks' | 'Equipo' | 'Ropa' | 'Servicios'
  precio: number
  existencias: number
  inventarioMinimo: number
  activo: boolean
}

export type Sale = {
  id: string
  folio: string
  fecha: string
  usuario: string
  total: number
  metodoPago: 'Efectivo' | 'Tarjeta' | 'Transferencia'
  estatus: 'Completada' | 'Cancelada' | 'Devuelta'
  items: number
}

export type Sponsor = {
  id: string
  empresa: string
  contacto: string
  tier: 'Platino' | 'Oro' | 'Plata'
  inicio: string
  fin: string
  monto: number
  horasDisponibles: number
  horasUtilizadas: number
}

export type Activity = {
  id: string
  tipo: 'venta' | 'inventario' | 'membresia' | 'patrocinador'
  descripcion: string
  usuario: string
  hace: string
}

export const CLUB = {
  nombre: 'La Cima Padel Club',
  moneda: 'MXN',
}

export const products: Product[] = [
  { id: 'p1', codigo: '7501001', nombre: 'Agua Mineral 600ml', categoria: 'Bebidas', precio: 25, existencias: 84, inventarioMinimo: 24, activo: true },
  { id: 'p2', codigo: '7501002', nombre: 'Bebida Isotónica', categoria: 'Bebidas', precio: 38, existencias: 12, inventarioMinimo: 20, activo: true },
  { id: 'p3', codigo: '7501003', nombre: 'Cerveza Artesanal', categoria: 'Bebidas', precio: 65, existencias: 40, inventarioMinimo: 12, activo: true },
  { id: 'p4', codigo: '7501004', nombre: 'Barra Proteína', categoria: 'Snacks', precio: 45, existencias: 6, inventarioMinimo: 15, activo: true },
  { id: 'p5', codigo: '7501005', nombre: 'Mix de Nueces', categoria: 'Snacks', precio: 55, existencias: 30, inventarioMinimo: 10, activo: true },
  { id: 'p6', codigo: '7501006', nombre: 'Bote de Pelotas x3', categoria: 'Equipo', precio: 180, existencias: 22, inventarioMinimo: 8, activo: true },
  { id: 'p7', codigo: '7501007', nombre: 'Grip Overgrip', categoria: 'Equipo', precio: 90, existencias: 4, inventarioMinimo: 10, activo: true },
  { id: 'p8', codigo: '7501008', nombre: 'Pala La Cima Pro', categoria: 'Equipo', precio: 3200, existencias: 9, inventarioMinimo: 3, activo: true },
  { id: 'p9', codigo: '7501009', nombre: 'Playera Oficial', categoria: 'Ropa', precio: 420, existencias: 18, inventarioMinimo: 6, activo: true },
  { id: 'p10', codigo: '7501010', nombre: 'Gorra La Cima', categoria: 'Ropa', precio: 280, existencias: 25, inventarioMinimo: 8, activo: true },
  { id: 'p11', codigo: '7501011', nombre: 'Renta de Cancha 90 min', categoria: 'Servicios', precio: 600, existencias: 999, inventarioMinimo: 0, activo: true },
  { id: 'p12', codigo: '7501012', nombre: 'Clase Particular', categoria: 'Servicios', precio: 500, existencias: 999, inventarioMinimo: 0, activo: true },
  { id: 'p13', codigo: '7501013', nombre: 'Toalla Deportiva', categoria: 'Ropa', precio: 160, existencias: 14, inventarioMinimo: 6, activo: true },
  { id: 'p14', codigo: '7501014', nombre: 'Café Americano', categoria: 'Bebidas', precio: 35, existencias: 60, inventarioMinimo: 20, activo: true },
  { id: 'p15', codigo: '7501015', nombre: 'Sandwich Club', categoria: 'Snacks', precio: 95, existencias: 8, inventarioMinimo: 10, activo: true },
]

export const recentSales: Sale[] = [
  { id: 's1', folio: 'V-1042', fecha: '2026-08-07 18:24', usuario: 'Cajero · Ana', total: 690, metodoPago: 'Tarjeta', estatus: 'Completada', items: 3 },
  { id: 's2', folio: 'V-1041', fecha: '2026-08-07 18:02', usuario: 'Cajero · Ana', total: 128, metodoPago: 'Efectivo', estatus: 'Completada', items: 4 },
  { id: 's3', folio: 'V-1040', fecha: '2026-08-07 17:48', usuario: 'Cajero · Luis', total: 3380, metodoPago: 'Tarjeta', estatus: 'Completada', items: 2 },
  { id: 's4', folio: 'V-1039', fecha: '2026-08-07 17:15', usuario: 'Cajero · Luis', total: 65, metodoPago: 'Efectivo', estatus: 'Cancelada', items: 1 },
  { id: 's5', folio: 'V-1038', fecha: '2026-08-07 16:53', usuario: 'Cajero · Ana', total: 420, metodoPago: 'Transferencia', estatus: 'Completada', items: 1 },
  { id: 's6', folio: 'V-1037', fecha: '2026-08-07 16:30', usuario: 'Cajero · Luis', total: 240, metodoPago: 'Efectivo', estatus: 'Devuelta', items: 2 },
]

export const sponsors: Sponsor[] = [
  { id: 'sp1', empresa: 'Adrenalina Sports', contacto: 'M. Reyes', tier: 'Platino', inicio: '2026-01-01', fin: '2026-12-31', monto: 250000, horasDisponibles: 120, horasUtilizadas: 74 },
  { id: 'sp2', empresa: 'Cumbre Bebidas', contacto: 'J. Peña', tier: 'Oro', inicio: '2026-03-01', fin: '2027-02-28', monto: 140000, horasDisponibles: 80, horasUtilizadas: 32 },
  { id: 'sp3', empresa: 'Altura Wear', contacto: 'S. Gómez', tier: 'Plata', inicio: '2026-05-15', fin: '2026-11-15', monto: 60000, horasDisponibles: 40, horasUtilizadas: 38 },
  { id: 'sp4', empresa: 'Pico Nutrition', contacto: 'R. Vela', tier: 'Oro', inicio: '2026-02-01', fin: '2027-01-31', monto: 120000, horasDisponibles: 80, horasUtilizadas: 12 },
]

export const activity: Activity[] = [
  { id: 'a1', tipo: 'venta', descripcion: 'Venta V-1042 por $690.00 (Tarjeta)', usuario: 'Ana', hace: 'hace 6 min' },
  { id: 'a2', tipo: 'inventario', descripcion: 'Entrada de 24 · Agua Mineral 600ml', usuario: 'Luis', hace: 'hace 22 min' },
  { id: 'a3', tipo: 'membresia', descripcion: 'Renovación membresía Premium · C. Torres', usuario: 'Ana', hace: 'hace 41 min' },
  { id: 'a4', tipo: 'patrocinador', descripcion: 'Cumbre Bebidas usó 4 horas de cancha', usuario: 'Sistema', hace: 'hace 1 h' },
  { id: 'a5', tipo: 'venta', descripcion: 'Venta V-1040 por $3,380.00 (Tarjeta)', usuario: 'Luis', hace: 'hace 1 h' },
  { id: 'a6', tipo: 'inventario', descripcion: 'Alerta: Grip Overgrip bajo mínimo', usuario: 'Sistema', hace: 'hace 2 h' },
]

// Serie de ventas por hora para el gráfico del dashboard.
export const salesByHour = [
  { hora: '09h', ventas: 1200 },
  { hora: '10h', ventas: 1850 },
  { hora: '11h', ventas: 2400 },
  { hora: '12h', ventas: 3100 },
  { hora: '13h', ventas: 2650 },
  { hora: '14h', ventas: 1900 },
  { hora: '15h', ventas: 2200 },
  { hora: '16h', ventas: 3400 },
  { hora: '17h', ventas: 4100 },
  { hora: '18h', ventas: 4780 },
]

export const currency = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(n)

export const lowStockProducts = products.filter(
  (p) => p.inventarioMinimo > 0 && p.existencias <= p.inventarioMinimo,
)

export const dashboardStats = {
  ventasDia: recentSales
    .filter((s) => s.estatus === 'Completada')
    .reduce((acc, s) => acc + s.total, 0),
  ticketsDia: recentSales.filter((s) => s.estatus === 'Completada').length,
  inventarioBajo: lowStockProducts.length,
  patrocinadoresActivos: sponsors.length,
  beneficiosUtilizados: sponsors.reduce((a, s) => a + s.horasUtilizadas, 0),
  beneficiosTotales: sponsors.reduce((a, s) => a + s.horasDisponibles, 0),
}
