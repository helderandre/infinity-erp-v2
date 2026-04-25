import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAuth } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { EmpresaTabsNav } from '@/components/financial/empresa-tabs-nav'
import { VistaConsultor } from '@/components/financial/consultor/vista-consultor'

// Drill-down read-only da Vista Consultor para utilizadores com `users`
// (gestão). Permite ao broker / office manager ver a vista pessoal
// de qualquer consultor sem editar.
//
// Rota: /dashboard/financeiro/consultor/[id]?tab=resumo|comissoes|loja|conta-corrente
export default async function ConsultorDrillDownPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  if (auth.permissions.users !== true) {
    redirect('/dashboard/financeiro')
  }

  const { id } = await params

  const supabase = await createClient()
  const { data: agent } = await (supabase as any)
    .from('dev_users')
    .select('id, commercial_name')
    .eq('id', id)
    .maybeSingle()

  if (!agent) notFound()

  return (
    <div className="space-y-4">
      <EmpresaTabsNav active="por-consultor" />
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-2 rounded-full">
          <Link href="/dashboard/financeiro/por-consultor">
            <ArrowLeft className="h-4 w-4" />
            Voltar à lista
          </Link>
        </Button>
      </div>
      <VistaConsultor agentId={agent.id} agentName={agent.commercial_name} readOnly />
    </div>
  )
}
