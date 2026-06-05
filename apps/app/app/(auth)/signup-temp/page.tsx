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

export default function SignupTempPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup-temp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error('Erro ao criar conta', {
          description: payload?.error || 'Tente novamente.',
        })
        return
      }

      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        toast.success('Conta criada', {
          description: 'Inicie sessão com as suas credenciais.',
        })
        router.push('/login')
        return
      }

      toast.success('Conta criada com sucesso', {
        description: 'A redirecionar para o dashboard...',
      })
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Erro ao criar conta:', error)
      toast.error('Ocorreu um erro ao criar a conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Criar Conta
        </CardTitle>
        <CardDescription>
          Página temporária — conta confirmada automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              type="text"
              placeholder="O seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              autoComplete="name"
              minLength={2}
            />
          </div>

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
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="912 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={loading}
              autoComplete="tel"
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Palavra-passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                minLength={8}
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
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Spinner variant="infinite" size={16} className="mr-2" />
                A criar conta...
              </>
            ) : (
              'Criar Conta'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link href="/login" className="text-foreground hover:underline">
            Iniciar sessão
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
