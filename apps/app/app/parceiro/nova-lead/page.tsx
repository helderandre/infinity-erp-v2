'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export default function NovaLeadPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    if (!form.email && !form.phone) { toast.error('Email ou telefone obrigatório'); return }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/parceiro/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          notes: form.notes || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Erro ao submeter')
        return
      }

      toast.success('Lead submetida com sucesso! A agência irá acompanhar.')
      router.push('/parceiro')
    } catch {
      toast.error('Erro de ligação')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="rounded-full h-8 w-8 p-0">
          <Link href="/parceiro"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Submeter Nova Lead</h1>
          <p className="text-xs text-muted-foreground">Os dados serão tratados pela equipa da Infinity Group.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border bg-card/50 p-5 space-y-4">
          <div className="grid gap-2">
            <Label className="text-xs font-medium">Nome completo *</Label>
            <Input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              className="rounded-xl"
              placeholder="Ex: João Silva"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                className="rounded-xl"
                placeholder="joao@exemplo.pt"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">Telefone</Label>
              <Input
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
                className="rounded-xl"
                placeholder="+351 912 345 678"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-medium">Notas / Contexto</Label>
            <Textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              className="rounded-xl"
              rows={3}
              placeholder="Ex: Procura apartamento T2 em Lisboa, orçamento ~250k"
            />
          </div>
        </div>

        <Button type="submit" className="w-full rounded-xl h-12" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          Submeter Lead
        </Button>
      </form>
    </div>
  )
}
