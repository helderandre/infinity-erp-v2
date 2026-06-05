'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function PortalLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Preencha o email e a password.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        toast.error('Credenciais incorrectas. Verifique o email e a password.')
        return
      }

      toast.success('Sessao iniciada com sucesso!')
      router.push('/portal')
    } catch {
      toast.error('Erro ao iniciar sessao. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Infinity Group</h1>
          <p className="text-sm text-muted-foreground">Portal do Cliente</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <p className="text-sm text-muted-foreground text-center">
              Inicie sessao para aceder ao seu portal
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="o-seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="A sua password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A entrar...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => toast.info('Contacte o seu consultor para redefinir a password.')}
              >
                Esqueceu a password?
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
