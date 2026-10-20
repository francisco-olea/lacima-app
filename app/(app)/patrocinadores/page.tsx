'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Check, Handshake, Pencil, Plus, Search } from 'lucide-react'
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

type Tier = 'Embajador' | 'Socio'
type Sponsor = {
  id: string
  company: string
  contact: string
  email: string
  phone: string
  tier: Tier
  startsOn: string
  endsOn: string
  amount: number
  hours: number
  usedHours: number
  benefits: string[]
}
type SponsorForm = {
  company: string
  contact: string
  email: string
  phone: string
  tier: Tier
  startsOn: string
  endsOn: string
  amount: string
  hours: string
  benefits: string
}

const tiers: { name: Tier; color: string; defaultHours: number }[] = [
  { name: 'Embajador', color: 'bg-primary text-primary-foreground', defaultHours: 120 },
  { name: 'Socio', color: 'bg-secondary text-secondary-foreground', defaultHours: 80 },
]

const emptyForm: SponsorForm = {
  company: '',
  contact: '',
  email: '',
  phone: '',
  tier: 'Socio',
  startsOn: '',
  endsOn: '',
  amount: '',
  hours: '80',
  benefits: '',
}

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addYear(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const end = new Date(Date.UTC(year + 1, month - 1, day))
  end.setUTCDate(end.getUTCDate() - 1)
  return end.toISOString().slice(0, 10)
}

async function getError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: string }
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

export default function PatrocinadoresPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [usageSaving, setUsageSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<'Todos' | Tier>('Todos')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
  const [usageSponsor, setUsageSponsor] = useState<Sponsor | null>(null)
  const [usageHours, setUsageHours] = useState('')
  const [form, setForm] = useState<SponsorForm>(emptyForm)

  const loadSponsors = useCallback(async () => {
    try {
      const response = await fetch('/api/sponsors', { cache: 'no-store' })
      if (!response.ok) throw new Error(await getError(response, 'No se pudieron cargar los patrocinadores'))
      const data = await response.json() as Sponsor[]
      setSponsors(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los patrocinadores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSponsors()
  }, [loadSponsors])

  const filteredSponsors = useMemo(() => sponsors.filter((sponsor) => {
    const matchesSearch = `${sponsor.company} ${sponsor.contact} ${sponsor.email}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (tierFilter === 'Todos' || sponsor.tier === tierFilter)
  }), [sponsors, search, tierFilter])

  function openCreate() {
    const startsOn = today()
    setEditingSponsor(null)
    setForm({ ...emptyForm, startsOn, endsOn: addYear(startsOn) })
    setFormOpen(true)
  }

  function openEdit(sponsor: Sponsor) {
    setEditingSponsor(sponsor)
    setForm({
      company: sponsor.company,
      contact: sponsor.contact,
      email: sponsor.email,
      phone: sponsor.phone,
      tier: sponsor.tier,
      startsOn: sponsor.startsOn,
      endsOn: sponsor.endsOn,
      amount: String(sponsor.amount),
      hours: String(sponsor.hours),
      benefits: sponsor.benefits.join(', '),
    })
    setFormOpen(true)
  }

  async function saveSponsor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/sponsors', {
        method: editingSponsor ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: editingSponsor?.id,
          amount: Number(form.amount),
          hours: Number(form.hours),
          benefits: form.benefits.split(',').map((benefit) => benefit.trim()).filter(Boolean),
        }),
      })
      if (!response.ok) throw new Error(await getError(response, 'No se pudo guardar el patrocinador'))
      const saved = await response.json() as Sponsor
      if (editingSponsor) {
        setSponsors((current) => current.map((sponsor) => sponsor.id === saved.id ? saved : sponsor))
        toast.success('Registro de patrocinador actualizado')
      } else {
        setSponsors((current) => [saved, ...current])
        toast.success(`Patrocinador ${saved.company} registrado`)
      }
      setFormOpen(false)
      setEditingSponsor(null)
      setForm(emptyForm)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el patrocinador')
    } finally {
      setSaving(false)
    }
  }

  async function registerUsage() {
    if (!usageSponsor) return
    const amount = Number(usageHours)
    if (!Number.isFinite(amount) || amount <= 0 || amount > usageSponsor.hours - usageSponsor.usedHours) {
      toast.error('La cantidad supera las horas disponibles')
      return
    }

    setUsageSaving(true)
    try {
      const response = await fetch('/api/sponsors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'usage', id: usageSponsor.id, quantity: amount }),
      })
      if (!response.ok) throw new Error(await getError(response, 'No se pudo registrar el uso'))
      setSponsors((current) => current.map((sponsor) => sponsor.id === usageSponsor.id
        ? { ...sponsor, usedHours: sponsor.usedHours + amount }
        : sponsor))
      toast.success(`Uso de ${amount} horas registrado`)
      setUsageHours('')
      setUsageSponsor(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el uso')
    } finally {
      setUsageSaving(false)
    }
  }

  const active = sponsors.filter((sponsor) => sponsor.startsOn <= today() && sponsor.endsOn >= today()).length
  const totalHours = sponsors.reduce((sum, sponsor) => sum + sponsor.hours, 0)
  const usedHours = sponsors.reduce((sum, sponsor) => sum + sponsor.usedHours, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Handshake className="size-6" />
          </span>
          <div>
            <p className="text-2xl font-semibold tracking-tight">Patrocinadores</p>
            <p className="mt-1 text-base text-muted-foreground">Administra contratos, beneficios, horas de cancha y activaciones.</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" /> Nuevo patrocinador
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Patrocinadores activos</p>
          <p className="mt-1 text-3xl font-semibold">{active}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Horas utilizadas</p>
          <p className="mt-1 text-3xl font-semibold text-primary">
            {usedHours} <span className="text-base font-normal text-muted-foreground">/ {totalHours}</span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Contratos vigentes</p>
          <p className="mt-1 text-3xl font-semibold text-accent">{active}</p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar empresa o contacto"
              className="h-10 pl-9"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['Todos', 'Embajador', 'Socio'] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${tierFilter === tier ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 p-4">
          {filteredSponsors.map((sponsor) => {
            const progress = sponsor.hours > 0 ? Math.min(100, (sponsor.usedHours / sponsor.hours) * 100) : 0
            return (
              <div key={sponsor.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{sponsor.company}</h2>
                      <Badge className={tiers.find((tier) => tier.name === sponsor.tier)?.color}>{sponsor.tier}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sponsor.contact || 'Sin contacto'} · {sponsor.email || 'Sin correo'}
                      {sponsor.phone ? ` · ${sponsor.phone}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(sponsor)} className="gap-1.5">
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setUsageSponsor(sponsor)} className="gap-1.5">
                      <Plus className="size-3.5" /> Registrar uso
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Vigencia</p>
                    <p className="mt-1 font-medium">{sponsor.startsOn} a {sponsor.endsOn}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contrato</p>
                    <p className="mt-1 font-medium">${sponsor.amount.toLocaleString('es-MX')}</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Horas de cancha</span><span>{sponsor.usedHours}/{sponsor.hours}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>

                {sponsor.benefits.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sponsor.benefits.map((benefit) => (
                      <Badge key={benefit} variant="outline" className="gap-1">
                        <Check className="size-3 text-accent" /> {benefit}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {!loading && filteredSponsors.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              {sponsors.length === 0 ? 'Aún no hay patrocinadores registrados.' : 'No se encontraron patrocinadores.'}
            </p>
          )}
          {loading && <p className="py-12 text-center text-muted-foreground">Cargando patrocinadores...</p>}
        </div>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSponsor ? 'Editar patrocinador' : 'Nuevo patrocinador'}</DialogTitle>
            <DialogDescription>
              {editingSponsor ? 'Actualiza los datos del registro y del contrato.' : 'Registra la empresa y los datos principales de su contrato.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveSponsor} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sponsor-company">Empresa</Label>
              <Input id="sponsor-company" required maxLength={160} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sponsor-contact">Contacto</Label>
                <Input id="sponsor-contact" maxLength={160} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sponsor-email">Correo</Label>
                <Input id="sponsor-email" type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sponsor-phone">Teléfono</Label>
                <Input id="sponsor-phone" maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sponsor-tier">Tier</Label>
                <select
                  id="sponsor-tier"
                  value={form.tier}
                  onChange={(event) => {
                    const tier = event.target.value as Tier
                    setForm({ ...form, tier, hours: editingSponsor ? form.hours : String(tiers.find((item) => item.name === tier)?.defaultHours ?? 80) })
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option>Embajador</option>
                  <option>Socio</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sponsor-starts">Inicio de vigencia</Label>
                <Input id="sponsor-starts" type="date" required value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sponsor-ends">Fin de vigencia</Label>
                <Input id="sponsor-ends" type="date" required min={form.startsOn} value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sponsor-amount">Monto del contrato</Label>
                <Input id="sponsor-amount" type="number" min="0" step="0.01" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sponsor-hours">Horas de cancha</Label>
                <Input id="sponsor-hours" type="number" min="0" step="0.5" required value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sponsor-benefits">Beneficios separados por coma</Label>
              <Input id="sponsor-benefits" placeholder="Logo en cancha, Activaciones" value={form.benefits} onChange={(event) => setForm({ ...form, benefits: event.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" className="gap-2" disabled={saving}>
                <Check className="size-4" /> {saving ? 'Guardando...' : editingSponsor ? 'Guardar cambios' : 'Registrar contrato'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={usageSponsor !== null} onOpenChange={(open) => !open && setUsageSponsor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar uso de beneficio</DialogTitle>
            <DialogDescription>
              {usageSponsor?.company} tiene {usageSponsor ? usageSponsor.hours - usageSponsor.usedHours : 0} horas disponibles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="usage-hours">Horas utilizadas</Label>
            <Input id="usage-hours" type="number" min="0.5" step="0.5" value={usageHours} onChange={(event) => setUsageHours(event.target.value)} placeholder="Ej. 4" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsageSponsor(null)} disabled={usageSaving}>Cancelar</Button>
            <Button onClick={registerUsage} className="gap-2" disabled={usageSaving}>
              <CalendarDays className="size-4" /> {usageSaving ? 'Guardando...' : 'Registrar uso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
