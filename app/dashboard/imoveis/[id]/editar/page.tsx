'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProperty } from '@/hooks/use-property'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { PropertyEditSheet } from '@/components/properties/property-edit-sheet'

/**
 * Página `/dashboard/imoveis/[id]/editar`.
 *
 * Hoje monta o `<PropertyEditSheet>` directamente (mesma UI usada inline a
 * partir do detalhe do imóvel). Quando o utilizador fecha, voltamos à
 * página de detalhe do imóvel — esta rota fica como deep-link estável
 * que abre directamente o sheet de edição.
 */
export default function EditarImovelPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { property, isLoading } = useProperty(id)
  const { user, loading: userLoading } = useUser()
  const [open, setOpen] = useState(true)

  // Edição reservada ao angariador (`consultant_id === me`) ou gestão.
  // Acesso directo via URL devolve o consultor à página de detalhe.
  useEffect(() => {
    if (isLoading || userLoading || !property || !user) return
    const isOwner = property.consultant_id === user.id
    const isManagement = isManagementRole(user.role_names ?? [])
    if (!isOwner && !isManagement) {
      router.replace(`/dashboard/imoveis/${property.id}`)
    }
  }, [isLoading, userLoading, property, user, router])

  // Fechar o sheet → voltar à página de detalhe.
  useEffect(() => {
    if (!open && property) {
      router.push(`/dashboard/imoveis/${property.id}`)
    }
  }, [open, property, router])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold">Imóvel não encontrado</h2>
        </div>
      </div>
    )
  }

  return (
    <PropertyEditSheet
      open={open}
      onOpenChange={setOpen}
      propertyId={property.id}
      // Refresh local property hook quando o sheet sinaliza um save.
      onSaved={() => {
        // Mantém o sheet aberto — o utilizador pode continuar a editar.
      }}
    />
  )
}
