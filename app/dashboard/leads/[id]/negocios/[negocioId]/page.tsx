'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { NegocioSidebar } from '@/components/negocios/negocio-sidebar'
import { NegocioDataCard } from '@/components/negocios/negocio-data-card'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'
import { mapNegocioToAcquisition } from '@/lib/utils/negocio-to-acquisition'
import type { NegocioWithLeadBasic } from '@/types/lead'

export default function NegocioDetailPage() {
  const { id: leadId, negocioId } = useParams<{ id: string; negocioId: string }>()
  const router = useRouter()

  const [negocio, setNegocio] = useState<NegocioWithLeadBasic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [acquisitionDialogOpen, setAcquisitionDialogOpen] = useState(false)

  const loadNegocio = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`)
      if (!res.ok) throw new Error('Negócio não encontrado')
      const data = await res.json()
      setNegocio(data)
      setForm(data)
    } catch {
      toast.error('Erro ao carregar negócio')
      router.push(`/dashboard/leads/${leadId}`)
    } finally {
      setIsLoading(false)
    }
  }, [negocioId, leadId, router])

  useEffect(() => {
    loadNegocio()
  }, [loadNegocio])

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {}
      const skipFields = ['id', 'lead_id', 'created_at', 'lead']
      for (const [key, value] of Object.entries(form)) {
        if (skipFields.includes(key)) continue
        body[key] = value ?? null
      }
      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar')
      }
      toast.success('Negócio actualizado com sucesso')
      setRefreshKey((k) => k + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const saveSidebarField = async (field: string, value: string) => {
    updateField(field, value)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error('Erro ao guardar')
      toast.success('Actualizado')
    } catch {
      toast.error('Erro ao guardar')
    }
  }

  const handleQuickFillApply = async (fields: Record<string, unknown>) => {
    const newForm = { ...form, ...fields }
    setForm(newForm)
    try {
      await fetch(`/api/negocios/${negocioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      setRefreshKey((k) => k + 1)
    } catch {
      toast.error('Erro ao guardar dados extraídos')
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-6">
        <div className="w-72 shrink-0">
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[500px] w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!negocio) return null

  const tipo = (form.tipo as string) || negocio.tipo

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/leads/${leadId}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <div className="flex gap-6 items-start">
        {/* Left sidebar */}
        <div className="w-72 shrink-0">
          <NegocioSidebar
            tipo={tipo}
            leadName={negocio.lead?.nome || 'Lead'}
            createdAt={negocio.created_at}
            phone={negocio.lead?.telemovel || negocio.lead?.telefone || null}
            email={negocio.lead?.email || null}
            estado={(form.estado as string) || 'Aberto'}
            negocioId={negocioId}
            onEstadoChange={(v) => saveSidebarField('estado', v)}
            onQuickFillApply={handleQuickFillApply}
            onStartAcquisition={() => setAcquisitionDialogOpen(true)}
          />
        </div>

        {/* Right main content */}
        <div className="flex-1 min-w-0">
          <NegocioDataCard
            tipo={tipo}
            negocioId={negocioId}
            form={form}
            onFieldChange={updateField}
            onSave={handleSave}
            isSaving={isSaving}
            refreshKey={refreshKey}
          />
        </div>
      </div>

      {/* Acquisition Dialog */}
      <AcquisitionDialog
        open={acquisitionDialogOpen}
        onOpenChange={setAcquisitionDialogOpen}
        negocioId={negocioId}
        prefillData={mapNegocioToAcquisition(form)}
        onComplete={(procInstanceId) => {
          setAcquisitionDialogOpen(false)
          toast.success('Angariação criada com sucesso!')
          router.push(`/dashboard/processos/${procInstanceId}`)
        }}
      />
    </div>
  )
}
