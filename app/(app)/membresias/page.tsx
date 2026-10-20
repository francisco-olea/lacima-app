'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, IdCard, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
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
type Member = {
  id: string
  number: string
  name: string
  email: string
  phone: string
  plan: string | null
  planId: string | null
  startsOn: string | null
  endsOn: string | null
  status: 'Activa' | 'Vencida'
}
type MemberForm = {
  name: string
  email: string
  phone: string
  planId: string
  startsOn: string
  endsOn: string
}

const emptyForm: MemberForm = { name: '', email: '', phone: '', planId: '', startsOn: '', endsOn: '' }

function addMonths(start: string, months: number) {
  const [year, month, day] = start.split('-').map(Number)
  const end = new Date(Date.UTC(year, month - 1, day))
  end.setUTCMonth(end.getUTCMonth() + months)
  end.setUTCDate(end.getUTCDate() - 1)
  return end.toISOString().slice(0, 10)
}

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function getError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: string }
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

export default function MembresiasPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todas' | Member['status']>('Todas')
  const [formOpen, setFormOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [renewingMember, setRenewingMember] = useState<Member | null>(null)
  const [deletingMember, setDeletingMember] = useState<Member | null>(null)
  const [form, setForm] = useState<MemberForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/memberships', { cache: 'no-store' })
      if (!response.ok) throw new Error(await getError(response, 'No se pudieron cargar las membresías'))
      const data = await response.json() as { members: Member[]; plans: Plan[] }
      setMembers(data.members)
      setPlans(data.plans)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las membresías')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  const filteredMembers = useMemo(() => members.filter((member) => {
    const matchesSearch = `${member.number} ${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (statusFilter === 'Todas' || member.status === statusFilter)
  }), [members, search, statusFilter])

  function openCreate() {
    const start = today()
    const defaultPlan = plans[0]
    setEditingMember(null)
    setForm({
      ...emptyForm,
      planId: defaultPlan?.id ?? '',
      startsOn: start,
      endsOn: defaultPlan ? addMonths(start, defaultPlan.months) : '',
    })
    setFormOpen(true)
  }

  function openEdit(member: Member) {
    setEditingMember(member)
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone,
      planId: member.planId ?? plans[0]?.id ?? '',
      startsOn: member.startsOn ?? today(),
      endsOn: member.endsOn ?? '',
    })
    setFormOpen(true)
  }

  function choosePlan(planId: string) {
    const plan = plans.find((item) => item.id === planId)
    setForm((current) => ({
      ...current,
      planId,
      endsOn: plan && current.startsOn ? addMonths(current.startsOn, plan.months) : current.endsOn,
    }))
  }

  async function saveMember(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/memberships', {
        method: editingMember ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editingMember?.id }),
      })
      if (!response.ok) throw new Error(await getError(response, 'No se pudo guardar el socio'))
      const saved = await response.json() as Member
      if (editingMember) {
        setMembers((current) => current.map((member) => member.id === saved.id
          ? { ...member, ...saved, number: saved.number, plan: plans.find((plan) => plan.id === saved.planId)?.name ?? member.plan }
          : member))
        toast.success('Registro de membresía actualizado')
      } else {
        setMembers((current) => [saved, ...current])
        toast.success(`Socio ${saved.number} creado`)
      }
      setFormOpen(false)
      setEditingMember(null)
      setForm(emptyForm)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el socio')
    } finally {
      setSaving(false)
    }
  }

  async function renew() {
    if (!renewingMember) return
    const plan = plans.find((item) => item.id === renewingMember.planId) ?? plans[0]
    if (!plan) {
      toast.error('No hay planes disponibles para renovar')
      return
    }
    let startsOn = today()
    if (renewingMember.status === 'Activa' && renewingMember.endsOn) {
      startsOn = new Date(Date.parse(`${renewingMember.endsOn}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    }
    const endsOn = addMonths(startsOn, plan.months)
    setSaving(true)
    try {
      const response = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'renew',
          id: renewingMember.id,
          planId: plan.id,
          startsOn,
          endsOn,
        }),
      })
      if (!response.ok) throw new Error(await getError(response, 'No se pudo renovar la membresía'))
      const updated = await response.json() as Member
      setMembers((current) => current.map((member) => member.id === updated.id
        ? { ...member, ...updated, plan: plan.name }
        : member))
      setRenewingMember(null)
      toast.success(`Membresía renovada para ${renewingMember.name}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo renovar la membresía')
    } finally {
      setSaving(false)
    }
  }

  async function deleteMember() {
    if (!deletingMember) return
    setSaving(true)
    try {
      const response = await fetch('/api/memberships', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingMember.id }),
      })
      if (!response.ok) throw new Error(await getError(response, 'No se pudo eliminar el socio'))
      setMembers((current) => current.filter((member) => member.id !== deletingMember.id))
      toast.success('Registro de membresía eliminado')
      setDeletingMember(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el socio')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = members.filter((member) => member.status === 'Activa').length

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary"><IdCard className="size-6" /></span><div><p className="text-2xl font-semibold tracking-tight">Membresías</p><p className="mt-1 text-base text-muted-foreground">Administra socios, planes, vencimientos y renovaciones.</p></div></div>
        <Button onClick={openCreate} disabled={plans.length === 0} className="gap-2"><Plus className="size-4" /> Nuevo socio</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3"><Card className="p-5"><p className="text-sm text-muted-foreground">Socios registrados</p><p className="mt-1 text-3xl font-semibold">{members.length}</p></Card><Card className="p-5"><p className="text-sm text-muted-foreground">Membresías activas</p><p className="mt-1 text-3xl font-semibold text-accent">{activeCount}</p></Card><Card className="p-5"><p className="text-sm text-muted-foreground">Vencidas</p><p className="mt-1 text-3xl font-semibold text-primary">{members.length - activeCount}</p></Card></div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap gap-3 border-b border-border p-4">
            <div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por socio, folio o correo" className="h-10 pl-9" /></div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">{(['Todas', 'Activa', 'Vencida'] as const).map((status) => <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${statusFilter === status ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>{status}</button>)}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Socio</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Vigencia</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-border">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4"><p className="font-semibold">{member.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{member.number} · {member.email || 'Sin correo'}</p></td>
                    <td className="px-5 py-4"><p className="font-medium">{member.plan ?? 'Sin membresía'}</p><p className="text-xs text-muted-foreground">{plans.find((plan) => plan.id === member.planId)?.benefits}</p></td>
                    <td className="px-5 py-4 text-muted-foreground">{member.startsOn ?? '—'} <span className="mx-1">a</span> {member.endsOn ?? '—'}</td>
                    <td className="px-5 py-4"><Badge className={member.status === 'Activa' ? 'bg-accent/15 text-accent' : ''}>{member.status}</Badge></td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setRenewingMember(member)} className="gap-1.5"><RefreshCw className="size-3.5" /> Renovar</Button>
                      <Button variant="outline" size="icon" onClick={() => openEdit(member)} aria-label={`Editar ${member.name}`}><Pencil className="size-4" /></Button>
                      <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingMember(member)} aria-label={`Eliminar ${member.name}`}><Trash2 className="size-4" /></Button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading ? <p className="px-5 py-12 text-center text-muted-foreground">Cargando membresías...</p> : filteredMembers.length === 0 ? <p className="px-5 py-12 text-center text-muted-foreground">No se encontraron socios.</p> : null}
        </Card>

        <Card className="p-5"><div className="mb-4 flex items-center gap-2"><CalendarDays className="size-5 text-primary" /><h2 className="text-lg font-semibold">Planes de membresía</h2></div><div className="space-y-3">{plans.map((plan) => <div key={plan.id} className="rounded-xl border border-primary/40 p-3"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{plan.name}</p><p className="font-semibold text-primary">${plan.price.toLocaleString('es-MX')}</p></div><p className="mt-1 text-sm text-muted-foreground">{plan.months} {plan.months === 1 ? 'mes' : 'meses'} · {plan.benefits}</p></div>)}</div></Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMember ? 'Editar socio' : 'Registrar nuevo socio'}</DialogTitle><DialogDescription>Los cambios se guardan en el sistema y quedan asociados a su membresía.</DialogDescription></DialogHeader>
          <form onSubmit={saveMember} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="member-name">Nombre completo</Label><Input id="member-name" required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="member-email">Correo</Label><Input id="member-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="member-phone">Teléfono</Label><Input id="member-phone" maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div></div>
            <div className="space-y-2"><Label htmlFor="member-plan">Plan</Label><select id="member-plan" required value={form.planId} onChange={(event) => choosePlan(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · ${plan.price.toLocaleString('es-MX')}</option>)}</select></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="member-start">Inicio</Label><Input id="member-start" type="date" required value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="member-end">Fin</Label><Input id="member-end" type="date" required value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} /></div></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving || plans.length === 0} className="gap-2"><Check className="size-4" /> {saving ? 'Guardando...' : 'Guardar'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renewingMember !== null} onOpenChange={(open) => !open && setRenewingMember(null)}><DialogContent><DialogHeader><DialogTitle>Renovar membresía</DialogTitle><DialogDescription>{renewingMember?.name} · se extenderá el plan vigente un periodo adicional.</DialogDescription></DialogHeader><div className="rounded-xl border border-primary bg-primary/10 p-4"><p className="font-semibold">{plans.find((plan) => plan.id === renewingMember?.planId)?.name ?? plans[0]?.name ?? 'Plan'} · ${plans.find((plan) => plan.id === renewingMember?.planId)?.price.toLocaleString('es-MX') ?? plans[0]?.price.toLocaleString('es-MX')}</p></div><DialogFooter><Button variant="outline" onClick={() => setRenewingMember(null)}>Cancelar</Button><Button onClick={() => void renew()} disabled={saving || plans.length === 0} className="gap-2"><RefreshCw className="size-4" /> Confirmar renovación</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={deletingMember !== null} onOpenChange={(open) => !open && setDeletingMember(null)}><DialogContent><DialogHeader><DialogTitle>Eliminar registro de membresía</DialogTitle><DialogDescription>¿Deseas quitar a {deletingMember?.name}? El registro se desactivará y dejará de mostrarse, conservando el historial y los pagos.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeletingMember(null)}>Cancelar</Button><Button variant="destructive" disabled={saving} onClick={() => void deleteMember()}><Trash2 className="size-4" /> Confirmar eliminación</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}
