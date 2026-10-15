'use client'

import { useEffect, useState } from 'react'
import {
  Bell,
  Building2,
  Check,
  ClipboardList,
  Mail,
  Pencil,
  Plus,
  Printer,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const SETTINGS_KEY = 'lc-settings'

type SettingsState = {
  clubName: string
  phone: string
  email: string
  address: string
  ticketHeader: string
  ticketFooter: string
  lowStockAlerts: boolean
  emailReports: boolean
}

const defaultSettings: SettingsState = {
  clubName: 'La Cima Padel Club',
  phone: '+52 0000 0000',
  email: 'contacto@lacimapadelclub.com',
  address: 'San Luis RC, Sonora',
  ticketHeader: 'La Cima Padel Club',
  ticketFooter: 'Gracias por tu visita',
  lowStockAlerts: true,
  emailReports: false,
}

type CashierUser = { id: string; name: string }

const shifts = [
  { label: 'Lunes a viernes · mañana', time: '06:00 - 14:00' },
  { label: 'Lunes a viernes · tarde', time: '16:00 - 00:00' },
  { label: 'Fin de semana · mañana', time: '07:00 - 15:00' },
  { label: 'Fin de semana · tarde', time: '16:00 - 00:00' },
]

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50">
      <span className="text-sm font-medium">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </button>
  )
}

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)
  const [saved, setSaved] = useState(false)
  const [nextFolio, setNextFolio] = useState(1)
  const [cashierUsers, setCashierUsers] = useState<CashierUser[]>([])
  const [userForm, setUserForm] = useState<{ id: string | null; name: string; password: string }>({
    id: null,
    name: '',
    password: '',
  })
  const [showUserForm, setShowUserForm] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [savingUser, setSavingUser] = useState(false)

  useEffect(() => {
    const storedSettings = localStorage.getItem(SETTINGS_KEY)
    if (storedSettings) {
      setSettings({ ...defaultSettings, ...JSON.parse(storedSettings) })
    }
    setNextFolio((Number(localStorage.getItem('lc-folio-sequence-v2')) || 0) + 1)
    fetch('/api/users', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json() as { users?: CashierUser[]; error?: string }
        if (!response.ok) throw new Error(result.error ?? 'No se pudieron cargar los usuarios')
        setCashierUsers(result.users ?? [])
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios'))
      .finally(() => setLoadingUsers(false))
  }, [])

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    setSaved(true)
    toast.success('Configuración guardada')
  }

  function openNewUserForm() {
    setUserForm({ id: null, name: '', password: '' })
    setShowUserForm(true)
  }

  function openEditUserForm(user: CashierUser) {
    setUserForm({ id: user.id, name: user.name, password: '' })
    setShowUserForm(true)
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingUser(true)
    try {
      const response = await fetch('/api/users', {
        method: userForm.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      })
      const result = await response.json() as { user?: CashierUser; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar el usuario')
      if (result.user) {
        const savedUser = result.user
        setCashierUsers((current) => userForm.id
          ? current.map((user) => user.id === savedUser.id ? savedUser : user)
          : [...current, savedUser].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      }
      setShowUserForm(false)
      setUserForm({ id: null, name: '', password: '' })
      toast.success(userForm.id ? 'Usuario actualizado' : 'Usuario creado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el usuario')
    } finally {
      setSavingUser(false)
    }
  }

  async function deleteUser(user: CashierUser) {
    if (!window.confirm(`¿Quieres eliminar el usuario ${user.name}?`)) return
    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo eliminar el usuario')
      setCashierUsers((current) => current.filter((item) => item.id !== user.id))
      toast.success('Usuario eliminado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el usuario')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight">Configuración</p>
          <p className="mt-1 text-base text-muted-foreground">Administra la operación, los usuarios y la información que aparece en tus tickets.</p>
        </div>
        <Button onClick={saveSettings} className="gap-2">
          {saved ? <Check className="size-4" /> : <Save className="size-4" />}
          <span className="hidden sm:inline">Guardar cambios</span>
        </Button>
      </div>

      <Tabs defaultValue="empresa" className="gap-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4">
          <TabsTrigger value="empresa" className="gap-2 py-2.5"><Building2 className="size-4" /> Empresa</TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2 py-2.5"><Users className="size-4" /> Usuarios</TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2 py-2.5"><Printer className="size-4" /> Tickets</TabsTrigger>
          <TabsTrigger value="preferencias" className="gap-2 py-2.5"><Settings className="size-4" /> Preferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <Building2 className="size-5 text-primary" />
              <div><h2 className="text-lg font-semibold">Datos de la empresa</h2><p className="text-sm text-muted-foreground">Información general del club.</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="club-name">Nombre del club</Label><Input id="club-name" value={settings.clubName} onChange={(e) => update('clubName', e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="club-phone">Teléfono</Label><Input id="club-phone" value={settings.phone} onChange={(e) => update('phone', e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="club-email">Correo de contacto</Label><Input id="club-email" type="email" value={settings.email} onChange={(e) => update('email', e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="club-address">Dirección</Label><Input id="club-address" value={settings.address} onChange={(e) => update('address', e.target.value)} /></div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><UserCog className="size-5 text-primary" /><div><h2 className="text-lg font-semibold">Usuarios y roles</h2><p className="text-sm text-muted-foreground">Controla quién puede operar cada módulo.</p></div></div><Button variant="outline" className="gap-2" onClick={openNewUserForm}><Plus className="size-4" /> Nuevo usuario</Button></div>
            {showUserForm && (
              <form onSubmit={saveUser} className="mb-5 space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                <h3 className="font-semibold">{userForm.id ? 'Editar usuario de Caja' : 'Nuevo usuario de Caja'}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cashier-name">Nombre de usuario</Label>
                    <Input id="cashier-name" autoComplete="off" required maxLength={80} value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cashier-password">{userForm.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}</Label>
                    <Input id="cashier-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required={!userForm.id} value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} placeholder={userForm.id ? 'Dejar en blanco para conservarla' : 'Entre 8 y 72 caracteres'} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowUserForm(false)}>Cancelar</Button>
                  <Button type="submit" disabled={savingUser}>{savingUser ? 'Guardando…' : 'Guardar usuario'}</Button>
                </div>
              </form>
            )}
            <div className="divide-y divide-border rounded-xl border border-border">
              {loadingUsers ? <p className="p-4 text-sm text-muted-foreground">Cargando usuarios…</p> : cashierUsers.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No hay usuarios de Caja registrados.</p> : cashierUsers.map((user) => <div key={user.id} className="flex flex-wrap items-center gap-3 p-4"><div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary"><UserCog className="size-5" /></div><div className="min-w-0 flex-1"><p className="font-medium">{user.name}</p></div><Badge variant="secondary">Caja</Badge><Badge className="gap-1 bg-accent/15 text-accent"><Check className="size-3" /> Activo</Badge><Button variant="ghost" size="icon" aria-label={`Editar ${user.name}`} onClick={() => openEditUserForm(user)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Eliminar ${user.name}`} onClick={() => deleteUser(user)}><Trash2 className="size-4 text-destructive" /></Button></div>)}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Las contraseñas se guardan cifradas. Al eliminar un usuario se conserva el historial de sus operaciones y se revoca su acceso.</p>
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="mb-3 text-base font-semibold">Turnos de caja</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {shifts.map((shift) => (
                  <div key={shift.label} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
                    <span>{shift.label}</span><span className="font-mono text-muted-foreground">{shift.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3"><ClipboardList className="size-5 text-primary" /><div><h2 className="text-lg font-semibold">Tickets y folios</h2><p className="text-sm text-muted-foreground">Configura la identificación de cada venta.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="ticket-header">Encabezado del ticket</Label><Input id="ticket-header" value={settings.ticketHeader} onChange={(e) => update('ticketHeader', e.target.value)} /></div><div className="space-y-2"><Label htmlFor="ticket-footer">Mensaje al final</Label><Input id="ticket-footer" value={settings.ticketFooter} onChange={(e) => update('ticketFooter', e.target.value)} /></div></div>
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground"><div className="flex items-center gap-2 font-semibold text-foreground"><Printer className="size-4 text-primary" /> Epson TM-T20IV · rollo de 80 mm</div><p className="mt-2">Conecta la impresora e instala el controlador Epson en el equipo de caja. Al imprimir, selecciona “Epson TM-T20IV” y el papel de 80 mm en el diálogo del navegador.</p></div>
            <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4"><p className="text-sm font-semibold">Folio consecutivo</p><p className="mt-1 text-sm text-muted-foreground">Cada venta confirmada recibe un folio único de seis dígitos y se conserva para los reportes.</p><div className="mt-3 flex items-center gap-2 font-mono text-xl font-semibold text-primary"><ClipboardList className="size-5" /> {String(nextFolio).padStart(6, '0')}</div></div>
          </Card>
        </TabsContent>

        <TabsContent value="preferencias">
          <Card className="space-y-3 p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-3"><Bell className="size-5 text-primary" /><div><h2 className="text-lg font-semibold">Preferencias del sistema</h2><p className="text-sm text-muted-foreground">Elige qué avisos necesita tu equipo.</p></div></div>
            <Toggle label="Alertas de inventario bajo" checked={settings.lowStockAlerts} onChange={(value) => update('lowStockAlerts', value)} />
            <Toggle label="Enviar resumen diario por correo" checked={settings.emailReports} onChange={(value) => update('emailReports', value)} />
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground"><Mail className="mt-0.5 size-4 shrink-0 text-primary" /><p>La configuración de correo se guardará aquí y quedará lista para conectarse al servidor SMTP del club.</p></div>
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><p>Los cambios de roles, contraseñas y permisos deben validarse en el servidor.</p></div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
