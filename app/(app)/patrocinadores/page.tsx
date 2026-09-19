"use client"

import { useMemo, useState } from 'react'
import { CalendarDays, Check, Handshake, Plus, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Tier = 'Embajador' | 'Socio'
type Sponsor = { id: string; company: string; contact: string; email: string; tier: Tier; startsOn: string; endsOn: string; amount: number; hours: number; usedHours: number; benefits: string[] }

const tiers: { name: Tier; color: string; defaultHours: number }[] = [
  { name: 'Embajador', color: 'bg-primary text-primary-foreground', defaultHours: 120 },
  { name: 'Socio', color: 'bg-secondary text-secondary-foreground', defaultHours: 80 },
]

const initialSponsors: Sponsor[] = [
  { id: 'sp1', company: 'Adrenalina Sports', contact: 'M. Reyes', email: 'contacto@adrenalina.mx', tier: 'Embajador', startsOn: '2026-01-01', endsOn: '2026-12-31', amount: 250000, hours: 120, usedHours: 74, benefits: ['Logo en cancha principal', '120 horas de cancha', 'Activaciones mensuales'] },
  { id: 'sp2', company: 'Cumbre Bebidas', contact: 'J. Peña', email: 'alianzas@cumbre.mx', tier: 'Socio', startsOn: '2026-03-01', endsOn: '2027-02-28', amount: 140000, hours: 80, usedHours: 32, benefits: ['Logo en recepción', '80 horas de cancha', 'Presencia en torneos'] },
  { id: 'sp3', company: 'Altura Wear', contact: 'S. Gómez', email: 'hola@alturawear.mx', tier: 'Socio', startsOn: '2026-05-15', endsOn: '2026-11-15', amount: 60000, hours: 40, usedHours: 38, benefits: ['Logo en redes sociales', '40 horas de cancha'] },
]

function addYear(date: string) {
  const end = new Date(date)
  end.setFullYear(end.getFullYear() + 1)
  end.setDate(end.getDate() - 1)
  return end.toISOString().slice(0, 10)
}

export default function PatrocinadoresPage() {
  const [sponsors, setSponsors] = useState(initialSponsors)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<'Todos' | Tier>('Todos')
  const [newOpen, setNewOpen] = useState(false)
  const [usageSponsor, setUsageSponsor] = useState<Sponsor | null>(null)
  const [usageHours, setUsageHours] = useState('')
  const [form, setForm] = useState({ company: '', contact: '', email: '', tier: 'Socio' as Tier, amount: '', benefits: '' })

  const filtered = useMemo(() => sponsors.filter((sponsor) => {
    const matchesSearch = `${sponsor.company} ${sponsor.contact} ${sponsor.email}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (tierFilter === 'Todos' || sponsor.tier === tierFilter)
  }), [sponsors, search, tierFilter])

  function createSponsor(event: React.FormEvent) {
    event.preventDefault()
    const tier = tiers.find((item) => item.name === form.tier) ?? tiers[1]
    const startsOn = new Date().toISOString().slice(0, 10)
    const benefits = form.benefits.split(',').map((benefit) => benefit.trim()).filter(Boolean)
    const sponsor: Sponsor = { id: crypto.randomUUID(), company: form.company.trim(), contact: form.contact.trim(), email: form.email.trim(), tier: tier.name, startsOn, endsOn: addYear(startsOn), amount: Number(form.amount) || 0, hours: tier.defaultHours, usedHours: 0, benefits }
    setSponsors((current) => [sponsor, ...current])
    setForm({ company: '', contact: '', email: '', tier: 'Socio', amount: '', benefits: '' })
    setNewOpen(false)
    toast.success(`Patrocinador ${sponsor.company} registrado`)
  }

  function registerUsage() {
    if (!usageSponsor) return
    const amount = Number(usageHours)
    if (!Number.isFinite(amount) || amount <= 0 || usageSponsor.usedHours + amount > usageSponsor.hours) {
      toast.error('La cantidad supera las horas disponibles')
      return
    }
    setSponsors((current) => current.map((sponsor) => sponsor.id === usageSponsor.id ? { ...sponsor, usedHours: sponsor.usedHours + amount } : sponsor))
    toast.success(`Uso de ${amount} horas registrado`)
    setUsageHours('')
    setUsageSponsor(null)
  }

  const active = sponsors.filter((sponsor) => new Date(sponsor.endsOn) >= new Date()).length
  const totalHours = sponsors.reduce((sum, sponsor) => sum + sponsor.hours, 0)
  const usedHours = sponsors.reduce((sum, sponsor) => sum + sponsor.usedHours, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary"><Handshake className="size-6" /></span><div><p className="text-2xl font-semibold tracking-tight">Patrocinadores</p><p className="mt-1 text-base text-muted-foreground">Administra contratos, beneficios, horas de cancha y activaciones.</p></div></div><Button onClick={() => setNewOpen(true)} className="gap-2"><Plus className="size-4" /> Nuevo patrocinador</Button></div>

      <div className="grid gap-3 sm:grid-cols-3"><Card className="p-5"><p className="text-sm text-muted-foreground">Patrocinadores activos</p><p className="mt-1 text-3xl font-semibold">{active}</p></Card><Card className="p-5"><p className="text-sm text-muted-foreground">Horas utilizadas</p><p className="mt-1 text-3xl font-semibold text-primary">{usedHours} <span className="text-base font-normal text-muted-foreground">/ {totalHours}</span></p></Card><Card className="p-5"><p className="text-sm text-muted-foreground">Contratos vigentes</p><p className="mt-1 text-3xl font-semibold text-accent">{active}</p></Card></div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]"><Card className="overflow-hidden p-0"><div className="flex flex-wrap gap-3 border-b border-border p-4"><div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa o contacto" className="h-10 pl-9" /></div><div className="flex gap-1 rounded-lg bg-muted p-1">{(['Todos', 'Embajador', 'Socio'] as const).map((tier) => <button key={tier} onClick={() => setTierFilter(tier)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tierFilter === tier ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>{tier}</button>)}</div></div><div className="space-y-3 p-4">{filtered.map((sponsor) => <div key={sponsor.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{sponsor.company}</h2><Badge className={tiers.find((tier) => tier.name === sponsor.tier)?.color}>{sponsor.tier}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{sponsor.contact} · {sponsor.email}</p></div><Button variant="outline" size="sm" onClick={() => setUsageSponsor(sponsor)} className="gap-1.5"><Plus className="size-3.5" /> Registrar uso</Button></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Vigencia</p><p className="mt-1 font-medium">{sponsor.startsOn} a {sponsor.endsOn}</p></div><div><p className="text-xs text-muted-foreground">Contrato</p><p className="mt-1 font-medium">${sponsor.amount.toLocaleString('es-MX')}</p></div><div><div className="flex justify-between text-xs text-muted-foreground"><span>Horas de cancha</span><span>{sponsor.usedHours}/{sponsor.hours}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (sponsor.usedHours / sponsor.hours) * 100)}%` }} /></div></div></div><div className="mt-4 flex flex-wrap gap-2">{sponsor.benefits.map((benefit) => <Badge key={benefit} variant="outline" className="gap-1"><Check className="size-3 text-accent" /> {benefit}</Badge>)}</div></div>)}{filtered.length === 0 && <p className="py-12 text-center text-muted-foreground">No se encontraron patrocinadores.</p>}</div></Card>

        <Card className="p-5"><div className="mb-4 flex items-center gap-2"><Sparkles className="size-5 text-primary" /><h2 className="text-lg font-semibold">Funciones planeadas</h2></div><div className="space-y-3">{['Contratos y renovaciones', 'Beneficios por tier', 'Registro de horas de cancha', 'Activaciones y eventos', 'Mercancía patrocinada', 'Historial y reportes'].map((feature) => <div key={feature} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm"><Check className="size-4 text-accent" />{feature}</div>)}</div></Card></div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent><DialogHeader><DialogTitle>Nuevo patrocinador</DialogTitle><DialogDescription>Registra la empresa y los datos principales de su contrato.</DialogDescription></DialogHeader><form onSubmit={createSponsor} className="space-y-4"><div className="space-y-2"><Label htmlFor="sponsor-company">Empresa</Label><Input id="sponsor-company" required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="sponsor-contact">Contacto</Label><Input id="sponsor-contact" required value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="sponsor-email">Correo</Label><Input id="sponsor-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="sponsor-tier">Tier</Label><select id="sponsor-tier" value={form.tier} onChange={(event) => setForm({ ...form, tier: event.target.value as Tier })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option>Embajador</option><option>Socio</option></select></div><div className="space-y-2"><Label htmlFor="sponsor-amount">Monto del contrato</Label><Input id="sponsor-amount" type="number" min="0" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div></div><div className="space-y-2"><Label htmlFor="sponsor-benefits">Beneficios separados por coma</Label><Input id="sponsor-benefits" placeholder="Logo en cancha, Activaciones" value={form.benefits} onChange={(event) => setForm({ ...form, benefits: event.target.value })} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button><Button type="submit" className="gap-2"><Check className="size-4" /> Registrar contrato</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={usageSponsor !== null} onOpenChange={(open) => !open && setUsageSponsor(null)}><DialogContent><DialogHeader><DialogTitle>Registrar uso de beneficio</DialogTitle><DialogDescription>{usageSponsor?.company} tiene {usageSponsor ? usageSponsor.hours - usageSponsor.usedHours : 0} horas disponibles.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="usage-hours">Horas utilizadas</Label><Input id="usage-hours" type="number" min="0.5" step="0.5" value={usageHours} onChange={(event) => setUsageHours(event.target.value)} placeholder="Ej. 4" /></div><DialogFooter><Button variant="outline" onClick={() => setUsageSponsor(null)}>Cancelar</Button><Button onClick={registerUsage} className="gap-2"><CalendarDays className="size-4" /> Registrar uso</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}
