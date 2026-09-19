'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Lock, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEMO_USER = 'Fernanda'
const DEMO_PASSWORD = 'lacima2026'

const demoAccounts = [
  { username: 'Fernanda', password: 'lacima2026', role: 'admin' },
  { username: 'Denisse', password: 'CajaDenisse2026!', role: 'cashier' },
  { username: 'Paola', password: 'CajaPaola2026!', role: 'cashier' },
  { username: 'Jenny', password: 'CajaJenny2026!', role: 'cashier' },
  { username: 'Andrea', password: 'CajaAndrea2026!', role: 'cashier' },
] as const

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      const account = demoAccounts.find(
        (candidate) =>
          candidate.username.toLowerCase() === username.trim().toLowerCase() &&
          candidate.password === password,
      )

      if (account) {
        sessionStorage.setItem('lc-auth', '1')
        sessionStorage.setItem('lc-user', account.username)
        sessionStorage.setItem('lc-role', account.role)
        router.push('/pos')
      } else {
        setError('Credenciales incorrectas. Usa las credenciales de demo.')
        setLoading(false)
      }
    }, 600)
  }

  function fillDemo() {
    setUsername(DEMO_USER)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/10">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative w-20 h-20 overflow-hidden rounded-2xl bg-sidebar p-1">
            <Image
              src="/logolacima-nobg.png"
              alt="La Cima Padel Club"
              fill
              className="object-contain p-1"
              sizes="80px"
            />
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Usuario */}
          <div className="space-y-1.5">
            <Label htmlFor="username">Usuario</Label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Escribe tu nombre"
                className="h-11 pl-9"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 pl-9 pr-10"
              />
              <button
                type="button"
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </Button>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/40 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Usuarios de demo
          </p>
          <div className="space-y-1 font-mono text-xs text-foreground/70">
            <p>
              <span className="text-muted-foreground">Usuario: </span>
              Fernanda / Denisse / Paola / Jenny / Andrea
            </p>
            <p>
              <span className="text-muted-foreground">Contraseña: </span>
              {DEMO_PASSWORD}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-8 w-full text-xs"
            type="button"
            onClick={fillDemo}
          >
            Autocompletar
          </Button>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        La Cima Padel Club &mdash; Plataforma interna
      </p>
    </div>
  )
}