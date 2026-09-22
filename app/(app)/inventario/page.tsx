'use client'

import { Minus, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { currency, type Product } from '@/lib/data'
import { toast } from 'sonner'

const categorias = ['Todos', 'Bebidas', 'Snacks', 'Equipo', 'Ropa', 'Servicios'] as const

type Categoria = (typeof categorias)[number]

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
  const [editProduct, setEditProduct] = useState({ nombre: '', codigo: '', categoria: 'Bebidas' as Product['categoria'], precio: '', existencias: '0', inventarioMinimo: '0' })
  const [newProduct, setNewProduct] = useState({ nombre: '', codigo: '', categoria: 'Bebidas' as Product['categoria'], precio: '', existencias: '0', inventarioMinimo: '0' })

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
    (producto) => producto.inventarioMinimo > 0 && producto.existencias <= producto.inventarioMinimo,
  ).length

  async function persistStock(producto: Product, next: number) {
    const response = await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: producto.codigo, existencias: next }),
    })
    if (!response.ok) throw new Error((await response.json()).error ?? 'No se pudo guardar el inventario')
  }

  function updateStock(id: string, next: number) {
    const producto = items.find((item) => item.id === id)
    if (!producto || Number.isNaN(next)) return
    const safeNext = Math.max(0, next)
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, existencias: safeNext } : item))
    void persistStock(producto, safeNext).catch((error: unknown) => {
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, existencias: producto.existencias } : item))
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el inventario')
    })
  }

  function changeStock(id: string, delta: number) {
    const producto = items.find((item) => item.id === id)
    if (producto) updateStock(id, producto.existencias + delta)
  }

  async function addProduct(event: React.FormEvent) {
    event.preventDefault()
    const price = Number(newProduct.precio)
    const stock = Number(newProduct.existencias)
    const minimum = Number(newProduct.inventarioMinimo)
    if (!newProduct.nombre.trim() || !newProduct.codigo.trim() || !Number.isFinite(price) || price < 0) return
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: newProduct.codigo.trim(), nombre: newProduct.nombre.trim(), categoria: newProduct.categoria, precio: price, existencias: Math.max(0, stock || 0), inventarioMinimo: Math.max(0, minimum || 0) }),
      })
      if (!response.ok) {
        toast.error(await responseError(response, 'No se pudo guardar el producto'))
        return
      }
      const savedProduct = await response.json() as Product
      setItems((current) => [savedProduct, ...current])
      setNewProduct({ nombre: '', codigo: '', categoria: 'Bebidas', precio: '', existencias: '0', inventarioMinimo: '0' })
      setAddOpen(false)
    } catch {
      toast.error('No se pudo conectar con el servidor para guardar el producto')
    }
  }

  function openEdit(producto: Product) {
    setSelectedProduct(producto)
    setEditProduct({ nombre: producto.nombre, codigo: producto.codigo, categoria: producto.categoria, precio: String(producto.precio), existencias: String(producto.existencias), inventarioMinimo: String(producto.inventarioMinimo) })
    setEditOpen(true)
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedProduct) return
    const price = Number(editProduct.precio)
    const stock = Number(editProduct.existencias)
    const minimum = Number(editProduct.inventarioMinimo)
    if (!editProduct.nombre.trim() || !editProduct.codigo.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(minimum) || minimum < 0) {
      toast.error('Completa los datos del producto')
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
        precio: price,
        existencias: stock,
        inventarioMinimo: minimum,
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-2xl font-semibold tracking-tight">Inventario</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Lista de productos con existencias, alertas de stock bajo y ajustes rápidos. Modifica las cantidades directamente desde aquí.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="rounded-3xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Productos
            </p>
            <p className="mt-3 text-3xl font-semibold">{items.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Total de artículos disponibles</p>
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
                <th className="px-4 py-3">Existencias</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtered.map((producto) => {
                const bajo = producto.inventarioMinimo > 0 && producto.existencias <= producto.inventarioMinimo
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          type="button"
                          onClick={() => changeStock(producto.id, -1)}
                          aria-label={`Reducir existencias de ${producto.nombre}`}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          value={producto.existencias}
                          onChange={(event) =>
                            updateStock(producto.id, Number(event.target.value))
                          }
                          className="h-10 w-24 text-center"
                          aria-label={`Existencias de ${producto.nombre}`}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          type="button"
                          onClick={() => changeStock(producto.id, 1)}
                          aria-label={`Aumentar existencias de ${producto.nombre}`}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Mín {producto.inventarioMinimo}</p>
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
                  <td className="px-4 py-16 text-center text-sm text-muted-foreground" colSpan={6}>
                    No se encontraron productos para los criterios seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar producto</DialogTitle><DialogDescription>Registra un producto nuevo para el catálogo e inventario.</DialogDescription></DialogHeader>
          <form onSubmit={addProduct} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-name">Nombre</Label><Input id="new-name" required value={newProduct.nombre} onChange={(e) => setNewProduct({ ...newProduct, nombre: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="new-code">Código</Label><Input id="new-code" required value={newProduct.codigo} onChange={(e) => setNewProduct({ ...newProduct, codigo: e.target.value })} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-category">Categoría</Label><select id="new-category" value={newProduct.categoria} onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value as Product['categoria'] })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{categorias.filter((category) => category !== 'Todos').map((category) => <option key={category}>{category}</option>)}</select></div><div className="space-y-2"><Label htmlFor="new-price">Precio</Label><Input id="new-price" required type="number" min="0" step="0.01" value={newProduct.precio} onChange={(e) => setNewProduct({ ...newProduct, precio: e.target.value })} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-stock">Existencias</Label><Input id="new-stock" type="number" min="0" value={newProduct.existencias} onChange={(e) => setNewProduct({ ...newProduct, existencias: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="new-minimum">Mínimo de inventario</Label><Input id="new-minimum" type="number" min="0" value={newProduct.inventarioMinimo} onChange={(e) => setNewProduct({ ...newProduct, inventarioMinimo: e.target.value })} /></div></div>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="edit-stock">Existencias</Label><Input id="edit-stock" required type="number" min="0" value={editProduct.existencias} onChange={(e) => setEditProduct({ ...editProduct, existencias: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="edit-minimum">Mínimo de inventario</Label><Input id="edit-minimum" required type="number" min="0" value={editProduct.inventarioMinimo} onChange={(e) => setEditProduct({ ...editProduct, inventarioMinimo: e.target.value })} /></div>
            </div>
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
