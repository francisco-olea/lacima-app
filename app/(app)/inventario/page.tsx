'use client'

import { History, MessageSquareText, Pencil, Plus, Save, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { currency, type Product } from '@/lib/data'
import { toast } from 'sonner'

const categorias = ['Todos', 'Bebidas', 'Snacks', 'Licuados', 'Equipo', 'Ropa', 'Servicios'] as const

type Categoria = (typeof categorias)[number]
type ProductNote = {
  id: string
  note: string
  createdAt: string
}
type InventoryMovement = {
  id: string
  type: string
  quantity: number
  stockBefore: number
  stockAfter: number
  reason: string | null
  createdAt: string
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: string }
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

export default function InventarioPage() {
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('Todos')
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [notesProduct, setNotesProduct] = useState<Product | null>(null)
  const [productNotes, setProductNotes] = useState<ProductNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [movementProduct, setMovementProduct] = useState<Product | null>(null)
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<'in' | 'out'>('in')
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('1')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [adjustmentSaving, setAdjustmentSaving] = useState(false)
  const [editProduct, setEditProduct] = useState({ nombre: '', codigo: '', categoria: 'Bebidas' as Product['categoria'], tipo: 'Inventario' as Product['tipo'], precio: '', inventarioMinimo: '0', motivoInventario: '' })
  const [newProduct, setNewProduct] = useState({ nombre: '', codigo: '', categoria: 'Bebidas' as Product['categoria'], tipo: 'Inventario' as Product['tipo'], precio: '', existencias: '0', inventarioMinimo: '0', motivoInventario: '' })

  useEffect(() => {
    let mounted = true

    async function loadProducts() {
      try {
        const response = await fetch('/api/products', { cache: 'no-store' })
        if (!response.ok) throw new Error(await responseError(response, 'No se pudo cargar el inventario desde PostgreSQL'))
        const products = await response.json() as Product[]
        if (mounted) setItems(products)
      } catch (error) {
        if (mounted) toast.error(error instanceof Error ? error.message : 'No se pudo cargar el inventario')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadProducts()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!notesProduct) {
      setProductNotes([])
      setNewNote('')
      return
    }

    const controller = new AbortController()
    setNotesLoading(true)
    fetch(`/api/products/${encodeURIComponent(notesProduct.id)}/notes`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, 'No se pudieron cargar las notas'))
        return response.json() as Promise<ProductNote[]>
      })
      .then(setProductNotes)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las notas')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setNotesLoading(false)
      })

    return () => controller.abort()
  }, [notesProduct])

  const filtered = useMemo(
    () =>
      items.filter((producto) => {
        const filtroCategoria = categoria === 'Todos' || producto.categoria === categoria
        const filtroTexto =
          producto.nombre.toLowerCase().includes(search.toLowerCase()) ||
          producto.codigo.includes(search)
        return filtroCategoria && filtroTexto
      }),
    [categoria, items, search],
  )

  const lowStockCount = items.filter(
    (producto) => producto.tipo === 'Inventario' && producto.inventarioMinimo > 0 && producto.existencias <= producto.inventarioMinimo,
  ).length

  async function saveStockAdjustment(event: React.FormEvent) {
    event.preventDefault()
    if (!adjustmentProduct) return
    const quantity = Number(adjustmentQuantity)
    if (!Number.isFinite(quantity) || quantity <= 0 || !adjustmentReason.trim()) {
      toast.error('Indica una cantidad y el motivo del ajuste')
      return
    }
    const adjustment = adjustmentType === 'in' ? quantity : -quantity
    if (adjustmentProduct.existencias + adjustment < 0) {
      toast.error('No puedes retirar más existencias de las disponibles')
      return
    }

    setAdjustmentSaving(true)
    try {
      const response = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: adjustmentProduct.codigo, ajuste: adjustment, motivoInventario: adjustmentReason.trim() }),
      })
      if (!response.ok) {
        toast.error(await responseError(response, 'No se pudo guardar el ajuste'))
        return
      }
      const savedProduct = await response.json() as Product
      setItems((current) => current.map((item) => item.id === savedProduct.id ? savedProduct : item))
      setAdjustmentProduct(null)
      setAdjustmentQuantity('1')
      setAdjustmentReason('')
      toast.success('Existencias actualizadas')
    } catch {
      toast.error('No se pudo conectar con el servidor para guardar el ajuste')
    } finally {
      setAdjustmentSaving(false)
    }
  }

  function openStockAdjustment(product: Product) {
    setAdjustmentProduct(product)
    setAdjustmentType('in')
    setAdjustmentQuantity('1')
    setAdjustmentReason('')
  }

  async function openMovementHistory(product: Product) {
    setMovementProduct(product)
    setMovements([])
    setMovementsLoading(true)
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}/movements`, { cache: 'no-store' })
      if (!response.ok) throw new Error(await responseError(response, 'No se pudo cargar el historial'))
      setMovements(await response.json() as InventoryMovement[])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el historial')
    } finally {
      setMovementsLoading(false)
    }
  }

  async function addProduct(event: React.FormEvent) {
    event.preventDefault()
    const price = Number(newProduct.precio)
    const stock = Number(newProduct.existencias)
    const minimum = Number(newProduct.inventarioMinimo)
    if (!newProduct.nombre.trim() || !newProduct.codigo.trim() || !Number.isFinite(price) || price < 0) return
    if (newProduct.tipo === 'Inventario' && stock > 0 && !newProduct.motivoInventario.trim()) {
      toast.error('Indica el motivo de las existencias iniciales')
      return
    }
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: newProduct.codigo.trim(),
          nombre: newProduct.nombre.trim(),
          categoria: newProduct.categoria,
          tipo: newProduct.tipo,
          precio: price,
          existencias: newProduct.tipo === 'Inventario' ? Math.max(0, stock || 0) : 0,
          inventarioMinimo: newProduct.tipo === 'Inventario' ? Math.max(0, minimum || 0) : 0,
          motivoInventario: newProduct.motivoInventario.trim(),
        }),
      })
      if (!response.ok) {
        toast.error(await responseError(response, 'No se pudo guardar el producto'))
        return
      }
      const savedProduct = await response.json() as Product
      setItems((current) => [savedProduct, ...current])
      setNewProduct({ nombre: '', codigo: '', categoria: 'Bebidas', tipo: 'Inventario', precio: '', existencias: '0', inventarioMinimo: '0', motivoInventario: '' })
      setAddOpen(false)
    } catch {
      toast.error('No se pudo conectar con el servidor para guardar el producto')
    }
  }

  function openEdit(producto: Product) {
    setSelectedProduct(producto)
    setEditProduct({ nombre: producto.nombre, codigo: producto.codigo, categoria: producto.categoria, tipo: producto.tipo, precio: String(producto.precio), inventarioMinimo: String(producto.inventarioMinimo), motivoInventario: '' })
    setEditOpen(true)
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedProduct) return
    const price = Number(editProduct.precio)
    const minimum = Number(editProduct.inventarioMinimo)
    if (!editProduct.nombre.trim() || !editProduct.codigo.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(minimum) || minimum < 0) {
      toast.error('Completa los datos del producto')
      return
    }
    if (selectedProduct.tipo === 'Inventario' && editProduct.tipo !== 'Inventario' && selectedProduct.existencias > 0 && !editProduct.motivoInventario.trim()) {
      toast.error('Indica el motivo para retirar las existencias antes de cambiar el tipo')
      return
    }

    const response = await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: selectedProduct.codigo,
        nuevoCodigo: editProduct.codigo.trim(),
        nombre: editProduct.nombre.trim(),
        categoria: editProduct.categoria,
        tipo: editProduct.tipo,
        precio: price,
        existencias: editProduct.tipo === 'Inventario' ? selectedProduct.existencias : 0,
        inventarioMinimo: editProduct.tipo === 'Inventario' ? minimum : 0,
        motivoInventario: editProduct.motivoInventario.trim(),
      }),
    })
    if (!response.ok) {
      toast.error(await responseError(response, 'No se pudo editar el producto'))
      return
    }

    const savedProduct = await response.json() as Product
    setItems((current) => current.map((item) => item.id === selectedProduct.id ? savedProduct : item))
    setEditOpen(false)
    setSelectedProduct(null)
    toast.success('Producto actualizado')
  }

  async function deleteProduct() {
    if (!selectedProduct) return
    const response = await fetch('/api/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: selectedProduct.codigo }),
    })
    if (!response.ok) {
      toast.error(await responseError(response, 'No se pudo eliminar el producto'))
      return
    }

    setItems((current) => current.filter((item) => item.id !== selectedProduct.id))
    setDeleteOpen(false)
    setSelectedProduct(null)
    toast.success('Producto eliminado')
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault()
    if (!notesProduct || !newNote.trim()) return

    setNoteSaving(true)
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(notesProduct.id)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote.trim() }),
      })
      if (!response.ok) {
        toast.error(await responseError(response, 'No se pudo guardar la nota'))
        return
      }

      const savedNote = await response.json() as ProductNote
      setProductNotes((current) => [savedNote, ...current])
      setNewNote('')
      toast.success('Nota agregada al artículo')
    } catch {
      toast.error('No se pudo conectar con el servidor para guardar la nota')
    } finally {
      setNoteSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-2xl font-semibold tracking-tight">Inventario</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Administra artículos con existencias, rentas y servicios. Las rentas y servicios no se descuentan ni generan alertas de inventario.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="rounded-3xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Productos en inventario
            </p>
            <p className="mt-3 text-3xl font-semibold">{items.filter((producto) => producto.tipo === 'Inventario').length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Artículos con existencias controladas</p>
          </Card>
          <Card className="rounded-3xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Rentas
            </p>
            <p className="mt-3 text-3xl font-semibold">{items.filter((producto) => producto.tipo === 'Renta').length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Productos clasificados para renta</p>
          </Card>
          <Card className="rounded-3xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Otros servicios
            </p>
            <p className="mt-3 text-3xl font-semibold">{items.filter((producto) => producto.tipo === 'Servicio').length}</p>
            <p className="mt-1 text-sm text-muted-foreground">No cuentan como existencias físicas</p>
          </Card>
          <Card className="rounded-3xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Inventario bajo
            </p>
            <p className="mt-3 text-3xl font-semibold">{lowStockCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Productos con existencias iguales o menores al mínimo</p>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <Label htmlFor="search">Buscar producto</Label>
              <Input
                id="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filtra por nombre o código"
                className="mt-2 min-w-0"
                aria-describedby="inventario-search-help"
              />
            </div>
            <p id="inventario-search-help" className="text-xs text-muted-foreground">
              Usa nombre, código o categoría para localizar productos rápidamente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => setAddOpen(true)} className="gap-2"><Plus className="size-4" /> Agregar</Button>
            {categorias.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  categoria === cat
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-full overflow-auto">
          {loading && <p className="px-4 py-8 text-sm text-muted-foreground">Cargando inventario desde PostgreSQL...</p>}
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-background/50 text-left text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Existencias</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtered.map((producto) => {
                const bajo = producto.tipo === 'Inventario' && producto.inventarioMinimo > 0 && producto.existencias <= producto.inventarioMinimo
                return (
                  <tr key={producto.id} className="hover:bg-muted/40">
                    <td className="px-4 py-4 align-top">
                      <p className="font-medium text-foreground">{producto.nombre}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{producto.codigo}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge>{producto.categoria}</Badge>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge variant={producto.tipo === 'Renta' ? 'secondary' : 'outline'}>{producto.tipo}</Badge>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {producto.tipo !== 'Inventario' ? (
                        <span className="text-muted-foreground">No se controla</span>
                      ) : (
                        <>
                          <p className="font-medium">{producto.existencias}</p>
                          <p className="mt-2 text-xs text-muted-foreground">Mín {producto.inventarioMinimo}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 gap-2"
                            onClick={() => openStockAdjustment(producto)}
                          >
                            <SlidersHorizontal className="size-4" /> Ajustar
                          </Button>
                        </>
                      )}
                      {bajo && (
                        <p className="mt-1 text-xs font-semibold text-destructive">
                          Inventario bajo
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="font-medium text-foreground">{currency(producto.precio)}</span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={producto.activo ? 'text-foreground' : 'text-muted-foreground'}>
                        {producto.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        {producto.tipo === 'Inventario' && (
                          <Button type="button" variant="outline" size="icon" onClick={() => void openMovementHistory(producto)} aria-label={`Historial de inventario de ${producto.nombre}`}>
                            <History className="size-4" />
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="icon" onClick={() => setNotesProduct(producto)} aria-label={`Notas de ${producto.nombre}`}>
                          <MessageSquareText className="size-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => openEdit(producto)} aria-label={`Editar ${producto.nombre}`}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => { setSelectedProduct(producto); setDeleteOpen(true) }} aria-label={`Eliminar ${producto.nombre}`}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-16 text-center text-sm text-muted-foreground" colSpan={7}>
                    No se encontraron productos para los criterios seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={adjustmentProduct !== null} onOpenChange={(open) => { if (!open) { setAdjustmentProduct(null); setAdjustmentReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar existencias</DialogTitle>
            <DialogDescription>
              {adjustmentProduct?.nombre} · Existencias actuales: {adjustmentProduct?.existencias}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveStockAdjustment} className="space-y-4">
            <div className="grid grid-cols-2 rounded-lg border border-border p-1">
              <button type="button" onClick={() => setAdjustmentType('in')} className={`rounded-md px-3 py-2 text-sm font-medium ${adjustmentType === 'in' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} aria-pressed={adjustmentType === 'in'}>
                Agregar
              </button>
              <button type="button" onClick={() => setAdjustmentType('out')} className={`rounded-md px-3 py-2 text-sm font-medium ${adjustmentType === 'out' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} aria-pressed={adjustmentType === 'out'}>
                Retirar
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-quantity">Cantidad</Label>
              <Input id="adjustment-quantity" type="number" min="0.001" step="0.001" required value={adjustmentQuantity} onChange={(event) => setAdjustmentQuantity(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-reason">Motivo</Label>
              <textarea id="adjustment-reason" required maxLength={1000} rows={3} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Describe por qué cambia la existencia" className="flex min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustmentProduct(null)}>Cancelar</Button>
              <Button type="submit" disabled={adjustmentSaving || !adjustmentReason.trim()}>{adjustmentSaving ? 'Guardando...' : 'Guardar ajuste'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={movementProduct !== null} onOpenChange={(open) => { if (!open) setMovementProduct(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Historial de inventario</DialogTitle>
            <DialogDescription>{movementProduct?.nombre} · Entradas y retiros registrados.</DialogDescription>
          </DialogHeader>
          {movementsLoading ? (
            <p className="py-4 text-sm text-muted-foreground">Cargando historial...</p>
          ) : movements.length > 0 ? (
            <ul className="space-y-2">
              {movements.map((movement) => (
                <li key={movement.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {movement.type === 'adjustment_in' || movement.type === 'initial' ? 'Entrada' : movement.type === 'adjustment_out' ? 'Retiro' : movement.type === 'sale' ? 'Venta' : movement.type === 'purchase' ? 'Compra' : movement.type === 'return' ? 'Devolución' : 'Movimiento'}
                      {' · '}{movement.quantity}
                    </p>
                    <p className="shrink-0 text-xs text-muted-foreground">{new Date(movement.createdAt).toLocaleString('es-MX')}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Existencias: {movement.stockBefore} → {movement.stockAfter}</p>
                  {movement.reason && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{movement.reason}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">Este producto todavía no tiene movimientos.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMovementProduct(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notesProduct !== null} onOpenChange={(open) => { if (!open) setNotesProduct(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notas del artículo</DialogTitle>
            <DialogDescription>
              {notesProduct?.nombre} · Registra movimientos o información relevante para su inventario.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addNote} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="product-note">Nueva nota</Label>
              <textarea
                id="product-note"
                required
                maxLength={1000}
                rows={3}
                value={newNote}
                onChange={(event) => setNewNote(event.target.value)}
                placeholder="Ej. Se tomaron 5 artículos para un evento"
                className="flex min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={noteSaving || !newNote.trim()}>
                {noteSaving ? 'Guardando...' : 'Agregar nota'}
              </Button>
            </div>
          </form>
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Historial</h3>
            {notesLoading ? (
              <p className="text-sm text-muted-foreground">Cargando notas...</p>
            ) : productNotes.length > 0 ? (
              <ul className="space-y-2">
                {productNotes.map((note) => (
                  <li key={note.id} className="rounded-xl border border-border bg-muted/30 p-3">
                    <p className="whitespace-pre-wrap break-words text-sm">{note.note}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(note.createdAt).toLocaleString('es-MX')}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Este artículo todavía no tiene notas.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNotesProduct(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar producto</DialogTitle><DialogDescription>Registra un producto, artículo de inventario o servicio de renta.</DialogDescription></DialogHeader>
          <form onSubmit={addProduct} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-name">Nombre</Label><Input id="new-name" required value={newProduct.nombre} onChange={(e) => setNewProduct({ ...newProduct, nombre: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="new-code">Código</Label><Input id="new-code" required value={newProduct.codigo} onChange={(e) => setNewProduct({ ...newProduct, codigo: e.target.value })} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-category">Categoría</Label><select id="new-category" value={newProduct.categoria} onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value as Product['categoria'] })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{categorias.filter((category) => category !== 'Todos').map((category) => <option key={category}>{category}</option>)}</select></div><div className="space-y-2"><Label htmlFor="new-price">Precio</Label><Input id="new-price" required type="number" min="0" step="0.01" value={newProduct.precio} onChange={(e) => setNewProduct({ ...newProduct, precio: e.target.value })} /></div></div>
            <div className="space-y-2"><Label htmlFor="new-type">Tipo</Label><select id="new-type" value={newProduct.tipo} onChange={(e) => setNewProduct({ ...newProduct, tipo: e.target.value as Product['tipo'] })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option>Inventario</option><option>Renta</option><option>Servicio</option></select></div>
            {newProduct.tipo === 'Inventario' ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-stock">Existencias iniciales</Label><Input id="new-stock" type="number" min="0" step="0.001" value={newProduct.existencias} onChange={(e) => setNewProduct({ ...newProduct, existencias: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="new-minimum">Mínimo de inventario</Label><Input id="new-minimum" type="number" min="0" value={newProduct.inventarioMinimo} onChange={(e) => setNewProduct({ ...newProduct, inventarioMinimo: e.target.value })} /></div></div>
                {Number(newProduct.existencias) > 0 && <div className="space-y-2"><Label htmlFor="new-stock-reason">Motivo de las existencias iniciales</Label><textarea id="new-stock-reason" required maxLength={1000} rows={2} value={newProduct.motivoInventario} onChange={(e) => setNewProduct({ ...newProduct, motivoInventario: e.target.value })} className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /></div>}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Las rentas y servicios no llevan existencias ni se descuentan al venderse.</p>
            )}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setAddOpen(false)}><X className="size-4" /> Cancelar</Button><Button type="submit"><Save className="size-4" /> Guardar producto</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
            <DialogDescription>Confirma los cambios que quieres guardar en este producto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="edit-name">Nombre</Label><Input id="edit-name" required value={editProduct.nombre} onChange={(e) => setEditProduct({ ...editProduct, nombre: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="edit-code">Código</Label><Input id="edit-code" required value={editProduct.codigo} onChange={(e) => setEditProduct({ ...editProduct, codigo: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="edit-category">Categoría</Label><select id="edit-category" value={editProduct.categoria} onChange={(e) => setEditProduct({ ...editProduct, categoria: e.target.value as Product['categoria'] })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{categorias.filter((category) => category !== 'Todos').map((category) => <option key={category}>{category}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="edit-price">Precio</Label><Input id="edit-price" required type="number" min="0" step="0.01" value={editProduct.precio} onChange={(e) => setEditProduct({ ...editProduct, precio: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="edit-type">Tipo</Label><select id="edit-type" value={editProduct.tipo} onChange={(e) => setEditProduct({ ...editProduct, tipo: e.target.value as Product['tipo'] })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option>Inventario</option><option>Renta</option><option>Servicio</option></select></div>
            {editProduct.tipo === 'Inventario' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="edit-minimum">Mínimo de inventario</Label><Input id="edit-minimum" required type="number" min="0" value={editProduct.inventarioMinimo} onChange={(e) => setEditProduct({ ...editProduct, inventarioMinimo: e.target.value })} /></div>
                <p className="self-center text-sm text-muted-foreground">Existencias actuales: {selectedProduct?.existencias}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Las rentas y servicios no llevan existencias ni se descuentan al venderse.</p>
            )}
            {selectedProduct?.tipo === 'Inventario' && editProduct.tipo !== 'Inventario' && selectedProduct.existencias > 0 && (
              <div className="space-y-2">
                <Label htmlFor="edit-stock-reason">Motivo del retiro de {selectedProduct.existencias} existencias</Label>
                <textarea id="edit-stock-reason" required maxLength={1000} rows={2} value={editProduct.motivoInventario} onChange={(e) => setEditProduct({ ...editProduct, motivoInventario: e.target.value })} className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
              </div>
            )}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}><X className="size-4" /> Cancelar</Button><Button type="submit"><Save className="size-4" /> Confirmar cambios</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar producto</DialogTitle>
            <DialogDescription>¿Confirmas que quieres eliminar {selectedProduct?.nombre}? El producto dejará de estar disponible en el inventario y se conservará su historial.</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button><Button type="button" variant="destructive" onClick={deleteProduct}><Trash2 className="size-4" /> Confirmar eliminación</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
