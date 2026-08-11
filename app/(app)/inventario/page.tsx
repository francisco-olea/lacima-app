'use client'

import { Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { currency, products as initialProducts, type Product } from '@/lib/data'

const categorias = ['Todos', 'Bebidas', 'Snacks', 'Equipo', 'Ropa', 'Servicios'] as const

type Categoria = (typeof categorias)[number]

export default function InventarioPage() {
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('Todos')
  const [items, setItems] = useState<Product[]>(() => initialProducts)

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

  function updateStock(id: string, next: number) {
    setItems((prev) =>
      prev.map((producto) =>
        producto.id === id
          ? { ...producto, existencias: Math.max(0, Number.isNaN(next) ? producto.existencias : next) }
          : producto,
      ),
    )
  }

  function changeStock(id: string, delta: number) {
    setItems((prev) =>
      prev.map((producto) =>
        producto.id === id
          ? { ...producto, existencias: Math.max(0, producto.existencias + delta) }
          : producto,
      ),
    )
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

          <div className="flex flex-wrap gap-2">
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
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-background/50 text-left text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Existencias</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Estado</th>
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
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-16 text-center text-sm text-muted-foreground" colSpan={5}>
                    No se encontraron productos para los criterios seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
