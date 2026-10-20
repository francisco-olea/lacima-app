'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, CalendarClock, ChevronDown, ChevronUp, ClipboardList, Receipt, Search, UserRound, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { currency } from '@/lib/data'

type Payment = { method: 'cash' | 'card' | 'transfer'; amount: number }
type SaleLine = {
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}
type CutSale = {
  id: string
  folio: string
  soldAt: string
  total: number
  items: number
  payments: Payment[]
  lines: SaleLine[]
}
type Cut = {
  id: string
  register: string
  openedBy: string
  closedBy: string | null
  openedAt: string
  closedAt: string
  openingAmount: number
  closingCash: number
  expectedCash: number
  difference: number
  salesTotal: number
  payments: Payment[]
  sales: CutSale[]
}

const paymentLabels: Record<Payment['method'], string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  })
}

function todayInMexico() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default function CortesPage() {
  const [cuts, setCuts] = useState<Cut[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayInMexico)
  const [expandedCut, setExpandedCut] = useState<string | null>(null)

  const loadCuts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cuts?date=${selectedDate}`, { cache: 'no-store' })
      if (!response.ok) {
        const result = await response.json() as { error?: string }
        throw new Error(result.error ?? 'No se pudieron cargar los cortes')
      }
      const result = await response.json() as Cut[]
      setCuts(result)
      setExpandedCut(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los cortes')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    void loadCuts()
  }, [loadCuts])

  const filteredCuts = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return cuts
    return cuts.filter((cut) => (
      `${cut.closedBy ?? cut.openedBy} ${cut.openedBy} ${cut.register} ${cut.sales.map((sale) => sale.folio).join(' ')}`
        .toLowerCase()
        .includes(value)
    ))
  }, [cuts, search])

  const totalSales = filteredCuts.reduce((sum, cut) => sum + cut.salesTotal, 0)
  const totalDifferences = filteredCuts.reduce((sum, cut) => sum + Math.abs(cut.difference), 0)

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ClipboardList className="size-6" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Cortes de caja</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Historial de turnos cerrados, ventas, pagos y efectivo contado.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="cut-date">
            Día del corte
            <Input
              id="cut-date"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value) setSelectedDate(event.target.value)
              }}
              className="h-10 w-full text-foreground sm:w-44"
            />
          </label>
          <label className="relative space-y-1.5 text-xs font-medium text-muted-foreground" htmlFor="cut-search">
            Buscar usuario o folio
            <Search className="absolute left-3 top-[2.15rem] size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="cut-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Usuario o folio"
              className="h-10 pl-9 sm:w-56"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Cortes encontrados</p>
            <ClipboardList className="size-4 text-primary" />
          </div>
          <p className="mt-1 text-3xl font-semibold">{filteredCuts.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Cortes del día seleccionado</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Ventas en estos cortes</p>
            <Receipt className="size-4 text-primary" />
          </div>
          <p className="mt-1 text-3xl font-semibold text-primary">{currency(totalSales)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Suma de ventas completadas</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Diferencias de efectivo</p>
            <Banknote className="size-4 text-accent" />
          </div>
          <p className={`mt-1 text-3xl font-semibold ${totalDifferences === 0 ? 'text-accent' : 'text-destructive'}`}>
            {currency(totalDifferences)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Acumulado de faltantes y sobrantes</p>
        </Card>
      </div>

      <section className="space-y-3" aria-label="Historial de cortes">
        {filteredCuts.map((cut) => {
          const isExpanded = expandedCut === cut.id
          return (
            <Card key={cut.id} className="overflow-hidden p-0">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedCut(isExpanded ? null : cut.id)}
                className="w-full p-4 text-left transition-colors hover:bg-muted/30 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-48 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{cut.closedBy ?? cut.openedBy}</h3>
                      <Badge variant="outline">{cut.register}</Badge>
                      {cut.difference !== 0 && (
                        <Badge variant="destructive">Diferencia</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="size-4" /> {formatDateTime(cut.closedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="size-4" /> Turno iniciado por {cut.openedBy}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total vendido</p>
                      <p className="text-xl font-semibold text-primary">{currency(cut.salesTotal)}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="size-5 text-muted-foreground" /> : <ChevronDown className="size-5 text-muted-foreground" />}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Inicio del turno</p>
                    <p className="mt-1 font-medium">{formatDateTime(cut.openedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Efectivo esperado</p>
                    <p className="mt-1 font-medium">{currency(cut.expectedCash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Efectivo contado</p>
                    <p className="mt-1 font-medium">{currency(cut.closingCash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Diferencia</p>
                    <p className={`mt-1 font-semibold ${cut.difference === 0 ? 'text-accent' : 'text-destructive'}`}>
                      {currency(cut.difference)}
                    </p>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-5 border-t border-border bg-muted/10 p-4 sm:p-5">
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <WalletCards className="size-4 text-primary" /> Desglose por método de pago
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(['cash', 'card', 'transfer'] as const).map((method) => {
                        const amount = cut.payments.find((payment) => payment.method === method)?.amount ?? 0
                        return (
                          <div key={method} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
                            <span className="text-muted-foreground">{paymentLabels[method]}</span>
                            <span className="font-semibold">{currency(amount)}</span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Fondo inicial de caja: {currency(cut.openingAmount)}
                    </p>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <Receipt className="size-4 text-primary" /> Ventas del turno
                      </h4>
                      <Badge variant="outline">{cut.sales.length} ventas</Badge>
                    </div>
                    {cut.sales.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        Este corte no tiene ventas vinculadas.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {cut.sales.map((sale) => (
                          <div key={sale.id} className="rounded-xl border border-border bg-card p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-mono font-semibold text-primary">{sale.folio}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatTime(sale.soldAt)} · {sale.items} artículo{sale.items === 1 ? '' : 's'}
                                </p>
                              </div>
                              <p className="text-lg font-semibold">{currency(sale.total)}</p>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {sale.payments.map((payment, index) => (
                                <Badge key={`${sale.id}-${payment.method}-${index}`} variant="outline">
                                  {paymentLabels[payment.method]} · {currency(payment.amount)}
                                </Badge>
                              ))}
                            </div>

                            <div className="mt-3 overflow-hidden rounded-lg border border-border">
                              <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span>Artículo</span><span className="text-right">Cant.</span><span className="text-right">Importe</span>
                              </div>
                              {sale.lines.map((line, index) => (
                                <div
                                  key={`${sale.id}-line-${index}`}
                                  className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-border/70 px-3 py-2 text-sm"
                                >
                                  <span>{line.description}</span>
                                  <span className="text-right text-muted-foreground">{line.quantity}</span>
                                  <span className="text-right font-medium">{currency(line.lineTotal)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
        {!loading && filteredCuts.length === 0 && (
          <Card className="p-10 text-center">
            <ClipboardList className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-3 font-medium">
              {cuts.length === 0 ? 'Todavía no hay cortes registrados.' : 'No se encontraron cortes.'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {cuts.length === 0 ? 'Cuando se realice un corte desde Punto de Venta, aparecerá aquí.' : 'Prueba con otro usuario o folio.'}
            </p>
          </Card>
        )}
        {loading && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Cargando cortes de caja...
          </Card>
        )}
      </section>
    </div>
  )
}
