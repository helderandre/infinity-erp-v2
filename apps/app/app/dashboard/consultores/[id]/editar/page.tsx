'use client'

import { useParams, useRouter } from 'next/navigation'
import { useConsultant } from '@/hooks/use-consultant'
import { ConsultantForm } from '@/components/consultants/consultant-form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

export default function EditarConsultorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { consultant, isLoading } = useConsultant(id)
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/libraries/roles')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setRoles(data || []))
      .catch(() => {})
  }, [])

  const handleSubmit = async (data: any) => {
    try {
      const res = await fetch(`/api/consultants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar')
      }

      toast.success('Consultor actualizado com sucesso')
      router.push(`/dashboard/consultores/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar consultor')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!consultant) {
    return (
      <div className="space-y-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold">Consultor não encontrado</h2>
        </div>
      </div>
    )
  }

  const profile = consultant.dev_consultant_profiles
  const privateData = consultant.dev_consultant_private_data
  const currentRoleId = consultant.user_roles?.[0]?.role_id || ''

  const defaultValues = {
    user: {
      commercial_name: consultant.commercial_name,
      professional_email: consultant.professional_email || '',
      is_active: consultant.is_active ?? true,
      display_website: consultant.display_website ?? false,
    },
    profile: {
      bio: profile?.bio || '',
      phone_commercial: profile?.phone_commercial || '',
      specializations: profile?.specializations || [],
      languages: profile?.languages || [],
      instagram_handle: profile?.instagram_handle || '',
      linkedin_url: profile?.linkedin_url || '',
    },
    private_data: {
      full_name: privateData?.full_name || '',
      nif: privateData?.nif || '',
      iban: privateData?.iban || '',
      address_private: privateData?.address_private || '',
      monthly_salary: privateData?.monthly_salary ?? null,
      commission_rate: privateData?.commission_rate ?? null,
      hiring_date: privateData?.hiring_date || '',
    },
    role_id: currentRoleId,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editar Consultor</h1>
          <p className="text-sm text-muted-foreground">{consultant.commercial_name}</p>
        </div>
      </div>

      <ConsultantForm
        defaultValues={defaultValues}
        roles={roles}
        onSubmit={handleSubmit}
        isEdit
      />
    </div>
  )
}
