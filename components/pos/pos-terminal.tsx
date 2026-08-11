'use client'

import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  Printer,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  ArrowLeftRight,
  X,
  ClipboardList,
  CheckCircle2,
  Receipt,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { currency, products, type Product } from '@/lib/data'
import { cn } from '@/lib/utils'

type CartItem = {
  key: string
  nombre: string
  precio: number
  cantidad: number
  sinCodigo?: boolean
  /** timestamp used to trigger the slide-in animation per item */
  addedAt: number
}

type VentaTurno = {
  folio: string
  hora: string
  total: number
  metodo: MetodoPago
  items: number
}

const categorias = ['Todos', 'Bebidas', 'Snacks', 'Equipo', 'Ropa', 'Servicios'] as const
type Categoria = (typeof categorias)[number]
type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Transferencia'
type PanelTab = 'carrito' | 'tickets'

let folioCounter = 1043

export function PosTerminal() {
  const [query, setQuery] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('Todos')
  const [cart, setCart] = useState<CartItem[]>([])
  const [descuento, setDescuento] = useState(0)
  const [metodo, setMetodo] = useState<MetodoPago>('Efectivo')
  const [recibido, setRecibido] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [corteOpen, setCorteOpen] = useState(false)
  const [corteConfirmado, setCorteConfirmado] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [panelTab, setPanelTab] = useState<PanelTab>('carrito')

  // Ventas acumuladas del turno actual
  const [ventasTurno, setVentasTurno] = useState<VentaTurno[]>([])
  const [turnoInicio] = useState(() => {
    const now = new Date()
    return now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  })

  const scanRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = categoria === 'Todos' || p.categoria === categoria
      const matchQuery =
        p.nombre.toLowerCase().includes(query.toLowerCase()) ||
        p.codigo.includes(query)
      return p.activo && matchCat && matchQuery
    })
  }, [query, categoria])

  function addProduct(p: Product) {
    setCart((prev) => {
      const found = prev.find((i) => i.key === p.id)
      if (found) {
        return prev.map((i) =>
          i.key === p.id ? { ...i, cantidad: i.cantidad + 1, addedAt: Date.now() } : i,
        )
      }
      return [...prev, { key: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1, addedAt: Date.now() }]
    })
    // Switch to carrito tab when adding a product
    setPanelTab('carrito')
  }

  function handleScan(e: React.FormEvent) {
    e.preventDefault()
    const code = query.trim()
    if (!code) return
    const match = products.find((p) => p.codigo === code)
    if (match) {
      addProduct(match)
      toast.success(`Agregado: ${match.nombre}`)
      setQuery('')
    } else if (filtered.length === 1) {
      addProduct(filtered[0])
      setQuery('')
    } else {
      toast.error('Código no encontrado')
    }
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0),
    )
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((i) => i.key !== key))
  }

  function addManual() {
    const price = Number.parseFloat(manualPrice)
    if (!manualName.trim() || Number.isNaN(price) || price <= 0) {
      toast.error('Ingresa nombre y precio válidos')
      return
    }
    setCart((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}`,
        nombre: manualName.trim(),
        precio: price,
        cantidad: 1,
        sinCodigo: true,
        addedAt: Date.now(),
      },
    ])
    setManualName('')
    setManualPrice('')
    setManualOpen(false)
    setPanelTab('carrito')
    toast.success('Producto sin código agregado')
  }

  const subtotal = cart.reduce((a, i) => a + i.precio * i.cantidad, 0)
  const descuentoMonto = Math.min(subtotal, (subtotal * descuento) / 100)
  const total = subtotal - descuentoMonto
  const cambio = Math.max(0, (Number.parseFloat(recibido) || 0) - total)

  function cancelSale() {
    if (cart.length === 0) return
    setCart([])
    setDescuento(0)
    setRecibido('')
    toast('Venta cancelada')
  }

  function confirmSale() {
    if (metodo === 'Efectivo' && (Number.parseFloat(recibido) || 0) < total) {
      toast.error('El monto recibido es insuficiente')
      return
    }
    const folio = `V-${folioCounter++}`
    const now = new Date()
    const hora = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    const itemsCount = cart.reduce((a, i) => a + i.cantidad, 0)

    setVentasTurno((prev) => [
      { folio, hora, total, metodo, items: itemsCount },
      ...prev,
    ])

    setCheckoutOpen(false)
    toast.success('Venta registrada · Ticket impreso', {
      description: `${itemsCount} artículos · ${currency(total)}`,
    })
    setCart([])
    setDescuento(0)
    setRecibido('')
  }

  function hacerCorte() {
    setCorteConfirmado(true)
    toast.success('Corte de caja generado y enviado al administrador')
  }

  // Totales del turno por método de pago
  const totalTurno = ventasTurno.reduce((a, v) => a + v.total, 0)
  const porMetodo = ventasTurno.reduce(
    (acc, v) => {
      acc[v.metodo] = (acc[v.metodo] ?? 0) + v.total
      return acc
    },
    {} as Record<MetodoPago, number>,
  )

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      {/* Catálogo */}
      <div className="space-y-4">
        {/* Barra: búsqueda + botón corte de caja */}
        <div className="flex gap-2">
          <form onSubmit={handleScan} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                ref={scanRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escanea código o busca producto…"
                className="h-12 pl-10 text-base"
                aria-label="Buscar o escanear producto"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpiar"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button type="submit" size="lg" className="h-12 gap-2">
              <Search className="size-4" />
              Agregar
            </Button>
          </form>
          <Button
            variant="outline"
            size="lg"
            className="h-12 gap-2 border-border text-muted-foreground hover:text-foreground"
            onClick={() => { setCorteConfirmado(false); setCorteOpen(true) }}
          >
            <ClipboardList className="size-4.5" />
            <span className="hidden sm:inline">Corte de caja</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {categorias.map((c) => (
            <button
              key={c}
              onClick={() => setCategoria(c)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                categoria === c
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {c}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => setManualOpen(true)}
          >
            <Plus className="size-4" />
            Sin código
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const bajo = p.inventarioMinimo > 0 && p.existencias <= p.inventarioMinimo
            return (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/60 hover:shadow-sm active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{p.categoria}</span>
                  {bajo && (
                    <span className="size-2 rounded-full bg-destructive" title="Inventario bajo" />
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
                  {p.nombre}
                </p>
                <p className="mt-auto pt-3 text-lg font-semibold text-primary">
                  {currency(p.precio)}
                </p>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              No se encontraron productos.
            </div>
          )}
        </div>
      </div>

      {/* Panel derecho: Carrito / Tickets */}
      <Card className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden p-0 lg:sticky lg:top-20">
        {/* Tab bar */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setPanelTab('carrito')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
              panelTab === 'carrito'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ShoppingCart className="size-4" />
            Venta actual
            {cart.length > 0 && (
              <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                {cart.reduce((a, i) => a + i.cantidad, 0)}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setPanelTab('tickets')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
              panelTab === 'tickets'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Receipt className="size-4" />
            Tickets
            {ventasTurno.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                {ventasTurno.length}
              </Badge>
            )}
          </button>
        </div>

        {/* ---- CARRITO ---- */}
        {panelTab === 'carrito' && (
          <>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-muted-foreground">{ventasTurno.length} venta{ventasTurno.length !== 1 ? 's' : ''} en turno</span>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={cancelSale}
                >
                  Cancelar venta
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  <ShoppingCart className="mb-3 size-10 opacity-30" />
                  Agrega productos para iniciar la venta.
                </div>
              ) : (
                <ul className="space-y-2">
                  {cart.map((i) => (
                    <li
                      key={i.key}
                      className="pos-cart-item flex items-center gap-2 rounded-lg border border-border bg-background p-2"
                      style={{ animationDuration: '220ms' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {i.nombre}
                          {i.sinCodigo && (
                            <Badge variant="secondary" className="ml-1.5 align-middle text-[10px]">
                              s/código
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{currency(i.precio)} c/u</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label="Menos"
                          onClick={() => changeQty(i.key, -1)}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{i.cantidad}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label="Más"
                          onClick={() => changeQty(i.key, 1)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      <p className="w-20 text-right text-sm font-semibold">
                        {currency(i.precio * i.cantidad)}
                      </p>
                      <button
                        aria-label="Eliminar"
                        onClick={() => removeItem(i.key)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Label htmlFor="descuento" className="text-sm text-muted-foreground">
                  Descuento (%)
                </Label>
                <Input
                  id="descuento"
                  type="number"
                  min={0}
                  max={100}
                  value={descuento || ''}
                  onChange={(e) =>
                    setDescuento(Math.min(100, Math.max(0, Number(e.target.value))))
                  }
                  placeholder="0"
                  className="h-9 w-24 text-right"
                />
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{currency(subtotal)}</span>
                </div>
                {descuentoMonto > 0 && (
                  <div className="flex justify-between text-accent">
                    <span>Descuento</span>
                    <span>-{currency(descuentoMonto)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-lg font-semibold">
                  <span>Total</span>
                  <span>{currency(total)}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="mt-3 h-12 w-full gap-2 text-base"
                disabled={cart.length === 0}
                onClick={() => setCheckoutOpen(true)}
              >
                <Banknote className="size-5" />
                Cobrar {currency(total)}
              </Button>
            </div>
          </>
        )}

        {/* ---- TICKETS ---- */}
        {panelTab === 'tickets' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header turno */}
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Turno desde las {turnoInicio}
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {ventasTurno.length} venta{ventasTurno.length !== 1 ? 's' : ''} &middot;{' '}
                    <span className="text-primary font-semibold">{currency(totalTurno)}</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => { setCorteConfirmado(false); setCorteOpen(true) }}
                >
                  <ClipboardList className="size-3.5" />
                  Corte
                </Button>
              </div>

              {/* Resumen métodos */}
              {ventasTurno.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {(['Efectivo', 'Tarjeta', 'Transferencia'] as MetodoPago[]).map((m) =>
                    porMetodo[m] ? (
                      <div
                        key={m}
                        className="flex-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-center"
                      >
                        <p className="text-[10px] text-muted-foreground">{m}</p>
                        <p className="text-xs font-semibold">{currency(porMetodo[m])}</p>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>

            {/* Lista de tickets */}
            <div className="flex-1 overflow-y-auto">
              {ventasTurno.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                  <Receipt className="mb-3 size-10 opacity-30" />
                  Las ventas del turno aparecerán aquí.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {ventasTurno.map((v, idx) => (
                    <li
                      key={v.folio}
                      className={cn(
                        'tickets-slide-in flex items-center gap-3 px-4 py-3',
                        idx === 0 && 'bg-primary/5',
                      )}
                      style={{ animationDelay: `${Math.min(idx, 6) * 30}ms`, animationDuration: '250ms' }}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {ventasTurno.length - idx}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold text-primary">{v.folio}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.hora} &middot; {v.items} art&iacute;culo{v.items !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{currency(v.total)}</p>
                        <p className="text-[10px] text-muted-foreground">{v.metodo}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Diálogo de cobro */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cobro</DialogTitle>
            <DialogDescription>
              Total a pagar:{' '}
              <span className="font-semibold text-foreground">{currency(total)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block text-sm">Método de pago</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { m: 'Efectivo', icon: Banknote },
                    { m: 'Tarjeta', icon: CreditCard },
                    { m: 'Transferencia', icon: ArrowLeftRight },
                  ] as const
                ).map(({ m, icon: Icon }) => (
                  <button
                    key={m}
                    onClick={() => setMetodo(m)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors',
                      metodo === m
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-5" />
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {metodo === 'Efectivo' && (
              <div className="space-y-2">
                <Label htmlFor="recibido" className="text-sm">
                  Efectivo recibido
                </Label>
                <Input
                  id="recibido"
                  type="number"
                  inputMode="decimal"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                  placeholder="0.00"
                  className="h-11 text-lg"
                />
                <div className="flex justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Cambio</span>
                  <span className="font-semibold">{currency(cambio)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Volver
            </Button>
            <Button onClick={confirmSale} className="gap-2">
              <Printer className="size-4" />
              Confirmar e imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo producto sin código */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Producto sin código</DialogTitle>
            <DialogDescription>
              Captura un artículo que no está en el catálogo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-nombre">Nombre</Label>
              <Input
                id="m-nombre"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ej. Consumo varios"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-precio">Precio</Label>
              <Input
                id="m-precio"
                type="number"
                inputMode="decimal"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addManual}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo corte de caja */}
      <Dialog open={corteOpen} onOpenChange={(v) => { setCorteOpen(v); if (!v) setCorteConfirmado(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" />
              Corte de caja
            </DialogTitle>
            <DialogDescription>
              Turno iniciado a las {turnoInicio} &middot; {ventasTurno.length} venta{ventasTurno.length !== 1 ? 's' : ''} registrada{ventasTurno.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          {corteConfirmado ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="size-12 text-primary" />
              <p className="text-base font-semibold">Corte enviado al administrador</p>
              <p className="text-sm text-muted-foreground">
                El resumen del turno ha sido registrado y estará disponible en Reportes.
              </p>
              <Button
                className="mt-2"
                onClick={() => {
                  setVentasTurno([])
                  setCorteOpen(false)
                  setCorteConfirmado(false)
                }}
              >
                Iniciar nuevo turno
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Resumen del turno
                  </p>
                  <div className="space-y-2 text-sm">
                    {(['Efectivo', 'Tarjeta', 'Transferencia'] as MetodoPago[]).map((m) =>
                      porMetodo[m] !== undefined ? (
                        <div key={m} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{m}</span>
                          <span className="font-medium">{currency(porMetodo[m])}</span>
                        </div>
                      ) : null,
                    )}
                    <Separator className="my-1" />
                    <div className="flex items-center justify-between text-base font-semibold">
                      <span>Total del turno</span>
                      <span className="text-primary">{currency(totalTurno)}</span>
                    </div>
                  </div>
                </div>

                {ventasTurno.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Folio</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Hora</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Método</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventasTurno.map((v, idx) => (
                          <tr
                            key={v.folio}
                            className={cn(
                              'border-b border-border/50 last:border-0',
                              idx % 2 === 0 ? 'bg-card' : 'bg-muted/20',
                            )}
                          >
                            <td className="px-3 py-2 font-mono font-medium text-primary">{v.folio}</td>
                            <td className="px-3 py-2 text-muted-foreground">{v.hora}</td>
                            <td className="px-3 py-2 text-muted-foreground">{v.metodo}</td>
                            <td className="px-3 py-2 text-right font-semibold">{currency(v.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    No hay ventas registradas en este turno aún.
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setCorteOpen(false)}>
                  Volver
                </Button>
                <Button
                  onClick={hacerCorte}
                  disabled={ventasTurno.length === 0}
                  className="gap-2"
                >
                  <Printer className="size-4" />
                  Hacer corte y enviar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
