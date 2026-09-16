"use client"

import { useMemo, useState } from 'react'
import { CalendarDays, Check, IdCard, Plus, RefreshCw, Search } from 'lucide-react'
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

type Plan = { id: string; name: string; months: number; price: number; benefits: string }
type Member = { id: string; number: string; name: string; email: string; phone: string; plan: string; planId: string; startsOn: string; endsOn: string; status: 'Activa' | 'Vencida' }

const plans: Plan[] = [
  { id: 'basic', name: 'Esencial', months: 1, price: 850, benefits: 'Acceso al club y reservas' },
  { id: 'premium', name: 'Premium', months: 3, price: 2200, benefits: 'Acceso, reservas y descuentos' },
  { id: 'annual', name: 'Anual', months: 12, price: 7800, benefits: 'Acceso total y beneficios exclusivos' },
]

const initialMembers: Member[] = [
  { id: 'm1', number: 'SOC-0001', name: 'Carlos Torres', email: 'carlos.torres@email.com', phone: '+52 55 1234 5678', plan: 'Premium', planId: 'premium', startsOn: '2026-07-01', endsOn: '2026-09-30', status: 'Activa' },
  { id: 'm2', number: 'SOC-0002', name: 'Mariana López', email: 'mariana.lopez@email.com', phone: '+52 55 2345 6789', plan: 'Anual', planId: 'annual', startsOn: '2026-01-15', endsOn: '2027-01-14', status: 'Activa' },
  { id: 'm3', number: 'SOC-0003', name: 'Jorge Ramírez', email: 'jorge.ramirez@email.com', phone: '+52 55 3456 7890', plan: 'Esencial', planId: 'basic', startsOn: '2026-05-01', endsOn: '2026-05-31', status: 'Vencida' },
]

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  next.setDate(next.getDate() - 1)
  return next.toISOString().slice(0, 10)
}

export default function MembresiasPage() {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todas' | Member['status']>('Todas')
  const [newMemberOpen, setNewMemberOpen] = useState(false)
  const [renewMember, setRenewMember] = useState<Member | null>(null)
  const [selectedPlan, setSelectedPlan] = useState(plans[1].id)
  const [form, setForm] = useState({ name: '', email: '', phone: '', planId: plans[1].id })

  const filteredMembers = useMemo(() => members.filter((member) => {
    const matchesSearch = `${member.number} ${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (statusFilter === 'Todas' || member.status === statusFilter)
  }), [members, search, statusFilter])

  function createMember(event: React.FormEvent) {
    event.preventDefault()
    const plan = plans.find((item) => item.id === form.planId) ?? plans[0]
    const startsOn = new Date().toISOString().slice(0, 10)
    const member: Member = {
      id: crypto.randomUUID(), number: `SOC-${String(members.length + 1).padStart(4, '0')}`,
      name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), plan: plan.name, planId: plan.id,
      startsOn, endsOn: addMonths(new Date(), plan.months), status: 'Activa',
    }
    setMembers((current) => [member, ...current])
    setForm({ name: '', email: '', phone: '', planId: plans[1].id })
    setNewMemberOpen(false)
    toast.success(`Socio ${member.number} creado`)
  }

  function renew() {
    if (!renewMember) return
    const plan = plans.find((item) => item.id === selectedPlan) ?? plans[0]
    const start = new Date(renewMember.status === 'Activa' ? renewMember.endsOn : new Date())
    setMembers((current) => current.map((member) => member.id === renewMember.id ? { ...member, plan: plan.name, planId: plan.id, startsOn: start.toISOString().slice(0, 10), endsOn: addMonths(start, plan.months), status: 'Activa' } : member))
    toast.success(`Membresía renovada para ${renewMember.name}`)
    setRenewMember(null)
  }

  const activeCount = members.filter((member) => member.status === 'Activa').length

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary"><IdCard className="size-6" /></span><div><p className="text-2xl font-semibold tracking-tight">Membresías</p><p className="mt-1 text-base text-muted-foreground">Administra socios, planes, vencimientos y renovaciones.</p></div></div>
        <Button onClick={() => setNewMemberOpen(true)} className="gap-2"><Plus className="size-4" /> Nuevo socio</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3"><Card className="p-5"><p className="text-sm text-muted-foreground">Socios registrados</p><p className="mt-1 text-3xl font-semibold">{members.length}</p></Card><Card className="p-5"><p className="text-sm text-muted-foreground">Membresías activas</p><p className="mt-1 text-3xl font-semibold text-accent">{activeCount}</p></Card><Card className="p-5"><p className="text-sm text-muted-foreground">Por vencer o vencidas</p><p className="mt-1 text-3xl font-semibold text-primary">{members.length - activeCount}</p></Card></div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden p-0"><div className="flex flex-wrap gap-3 border-b border-border p-4"><div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por socio, folio o correo" className="h-10 pl-9" /></div><div className="flex gap-1 rounded-lg bg-muted p-1">{(['Todas', 'Activa', 'Vencida'] as const).map((status) => <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${statusFilter === status ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>{status}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Socio</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Vigencia</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Acción</th></tr></thead><tbody className="divide-y divide-border">{filteredMembers.map((member) => <tr key={member.id} className="hover:bg-muted/30"><td className="px-5 py-4"><p className="font-semibold">{member.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{member.number} · {member.email}</p></td><td className="px-5 py-4"><p className="font-medium">{member.plan}</p><p className="text-xs text-muted-foreground">{plans.find((plan) => plan.id === member.planId)?.benefits}</p></td><td className="px-5 py-4 text-muted-foreground">{member.startsOn} <span className="mx-1">a</span> {member.endsOn}</td><td className="px-5 py-4"><Badge className={member.status === 'Activa' ? 'bg-accent/15 text-accent' : ''}>{member.status}</Badge></td><td className="px-5 py-4 text-right"><Button variant="outline" size="sm" onClick={() => { setSelectedPlan(member.planId); setRenewMember(member) }} className="gap-1.5"><RefreshCw className="size-3.5" /> Renovar</Button></td></tr>)}</tbody></table></div>{filteredMembers.length === 0 && <p className="px-5 py-12 text-center text-muted-foreground">No se encontraron socios.</p>}</Card>

        <Card className="p-5"><div className="mb-4 flex items-center gap-2"><CalendarDays className="size-5 text-primary" /><h2 className="text-lg font-semibold">Planes disponibles</h2></div><div className="space-y-3">{plans.map((plan) => <div key={plan.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{plan.name}</p><p className="font-semibold text-primary">${plan.price.toLocaleString('es-MX')}</p></div><p className="mt-1 text-sm text-muted-foreground">{plan.months} {plan.months === 1 ? 'mes' : 'meses'} · {plan.benefits}</p></div>)}</div></Card>
      </div>

      <Dialog open={newMemberOpen} onOpenChange={setNewMemberOpen}><DialogContent><DialogHeader><DialogTitle>Registrar nuevo socio</DialogTitle><DialogDescription>Captura los datos del socio y asigna su primera membresía.</DialogDescription></DialogHeader><form onSubmit={createMember} className="space-y-4"><div className="space-y-2"><Label htmlFor="member-name">Nombre completo</Label><Input id="member-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="member-email">Correo</Label><Input id="member-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="member-phone">Teléfono</Label><Input id="member-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div></div><div className="space-y-2"><Label htmlFor="member-plan">Plan inicial</Label><select id="member-plan" value={form.planId} onChange={(event) => setForm({ ...form, planId: event.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="basic">Esencial - $850</option><option value="premium">Premium - $2,200</option><option value="annual">Anual - $7,800</option></select></div><DialogFooter><Button type="button" variant="outline" onClick={() => setNewMemberOpen(false)}>Cancelar</Button><Button type="submit" className="gap-2"><Check className="size-4" /> Registrar socio</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={renewMember !== null} onOpenChange={(open) => !open && setRenewMember(null)}><DialogContent><DialogHeader><DialogTitle>Renovar membresía</DialogTitle><DialogDescription>{renewMember?.name} · selecciona el nuevo plan y se actualizará la vigencia.</DialogDescription></DialogHeader><div className="space-y-3">{plans.map((plan) => <button key={plan.id} onClick={() => setSelectedPlan(plan.id)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left ${selectedPlan === plan.id ? 'border-primary bg-primary/10' : 'border-border'}`}><span><span className="block font-semibold">{plan.name}</span><span className="text-sm text-muted-foreground">{plan.months} meses · {plan.benefits}</span></span><span className="font-semibold text-primary">${plan.price.toLocaleString('es-MX')}</span></button>)}</div><DialogFooter><Button variant="outline" onClick={() => setRenewMember(null)}>Cancelar</Button><Button onClick={renew} className="gap-2"><RefreshCw className="size-4" /> Confirmar renovación</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}
