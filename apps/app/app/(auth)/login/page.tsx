'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error('Erro ao iniciar sessão', {
          description: error.message === 'Invalid login credentials'
            ? 'Email ou palavra-passe incorrectos'
            : error.message,
        })
        return
      }

      if (data.user) {
        toast.success('Bem-vindo!', {
          description: 'A redirecionar para o dashboard...',
        })
        fetch('/api/auth/record-login', { method: 'POST' }).catch(() => {})
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error)
      toast.error('Ocorreu um erro ao iniciar sessão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          ERP Infinity
        </CardTitle>
        <CardDescription>
          Aceda à sua conta para continuar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu.email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Palavra-passe</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                Esqueci a palavra-passe
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner variant="infinite" size={16} className="mr-2" />
                A iniciar sessão...
              </>
            ) : (
              'Iniciar Sessão'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>© 2026 Infinity Group</p>
        </div>
      </CardContent>
    </Card>
  )
}
