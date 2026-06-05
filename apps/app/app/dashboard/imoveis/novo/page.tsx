'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { classifyUserMembership } from '@/lib/auth/roles'
import { PropertyEditSheet } from '@/components/properties/property-edit-sheet'

/**
 * Página `/dashboard/imoveis/novo`.
 *
 * Monta o `<PropertyEditSheet>` em modo `create` — mesma UI do edit sheet
 * (tabs Geral, Localização, Especs, Contrato, Apresentação) com a tab
 * Media escondida até o imóvel existir. Ao guardar, navega para o detalhe
 * do imóvel recém-criado. Fechar sem guardar volta para a listagem.
 */
export default function NovoImovelPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [open, setOpen] = useState(true)

  // Consultores não criam imóveis directamente — só via fluxo de angariação.
  useEffect(() => {
    if (userLoading || !user) return
    if (classifyUserMembership(user.role_names ?? []) === 'consultor') {
      router.replace('/dashboard/imoveis')
    }
  }, [user, userLoading, router])

  // Quando o sheet fecha (cancelar / X / Escape), volta à listagem.
  useEffect(() => {
    if (!open) router.push('/dashboard/imoveis')
  }, [open, router])

  return (
    <PropertyEditSheet
      mode="create"
      open={open}
      onOpenChange={setOpen}
      onSaved={(created) => {
        if (created?.id) {
          router.push(`/dashboard/imoveis/${created.slug || created.id}`)
        } else {
          router.push('/dashboard/imoveis')
        }
      }}
    />
  )
}
