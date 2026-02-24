'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PropertyForm } from '@/components/properties/property-form'
import { ArrowLeft } from 'lucide-react'
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
      const { id } = await res.json()
      toast.success('Imóvel criado com sucesso')
      router.push(`/dashboard/imoveis/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar imóvel')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Imóvel</h1>
          <p className="text-muted-foreground">Criar um novo imóvel no sistema</p>
        </div>
      </div>
      <PropertyForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  )
}
