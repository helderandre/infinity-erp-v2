'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CreditForm } from '@/components/credit/credit-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function NovoCreditoPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [leads, setLeads] = useState<{ id: string; nome: string; email: string | null }[]>([])

  useEffect(() => {
    fetch('/api/leads?limit=100')
      .then(res => res.ok ? res.json() : { data: [] })
      .then(json => setLeads(
        (json.data || []).map((l: Record<string, unknown>) => ({
          id: l.id as string,
          nome: l.nome as string,
          email: l.email as string | null,
        }))
      ))
      .catch(() => {})
  }, [])

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Erro ao criar pedido')
      }
      const json = await res.json()
      toast.success('Pedido de crédito criado com sucesso')
      router.push(`/dashboard/credito/${json.data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar pedido')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Pedido de Crédito</h1>
          <p className="text-muted-foreground">
            Preencha os dados para iniciar um pedido de crédito habitação
          </p>
        </div>
      </div>

      <CreditForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        leads={leads}
      />
    </div>
  )
}
