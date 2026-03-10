'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ConsultantForm } from '@/components/consultants/consultant-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function NovoConsultorPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')

  useEffect(() => {
    fetch('/api/libraries/roles')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setRoles(data || []))
      .catch(() => {})
  }, [])

  const handleSubmit = async (data: any) => {
    if (!authEmail || !authPassword) {
      toast.error('Email e password são obrigatórios')
      return
    }

    if (authPassword.length < 6) {
      toast.error('A password deve ter pelo menos 6 caracteres')
      return
    }

    try {
      const res = await fetch('/api/consultants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          email: authEmail,
          password: authPassword,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar consultor')
      }

      const { id } = await res.json()
      toast.success('Consultor criado com sucesso')
      router.push(`/dashboard/consultores/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar consultor')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Consultor</h1>
          <p className="text-sm text-muted-foreground">Criar uma nova conta de consultor</p>
        </div>
      </div>

      {/* Auth credentials card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciais de Acesso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email de Login *</Label>
              <Input
                id="auth-email"
                type="email"
                placeholder="consultor@empresa.pt"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password *</Label>
              <Input
                id="auth-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <ConsultantForm roles={roles} onSubmit={handleSubmit} />
    </div>
  )
}
