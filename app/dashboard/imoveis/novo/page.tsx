'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PropertyForm } from '@/components/properties/property-form'
import { ArrowLeft, Building2 } from 'lucide-react'
import { toast } from 'sonner'

export default function NovoImovelPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(data: {
    property: Record<string, unknown>
    specifications: Record<string, unknown>
    internal: Record<string, unknown>
  }) {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data.property,
          specifications: data.specifications,
          internal: data.internal,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar imóvel')
      }
      const { id, slug } = await res.json()
      toast.success('Imóvel criado com sucesso')
      router.push(`/dashboard/imoveis/${slug || id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar imóvel')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 sm:px-8 py-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Novo Imóvel</h1>
              <p className="text-neutral-400 text-sm">Preencha os dados para criar um novo imóvel</p>
            </div>
          </div>
        </div>
      </div>

      <PropertyForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  )
}
