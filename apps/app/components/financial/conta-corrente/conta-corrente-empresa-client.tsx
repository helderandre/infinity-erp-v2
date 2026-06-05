'use client'

import { useCallback, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContaCorrenteUnified } from './conta-corrente-unified'
import { ScopePicker } from './scope-picker'
import { PorConsultorTable } from '@/components/financial/empresa/por-consultor-table'
import type { LedgerScope } from '@/lib/financial/ledger-types'

const VIEWS = ['individual', 'geral'] as const
type View = (typeof VIEWS)[number]

// Conta Corrente da empresa com 2 top-tabs:
//   - Individual: picker (Empresa | consultor) + ledger unificado
//   - Geral: tabela com todos os consultores e respectivos KPIs
export function ContaCorrenteEmpresaClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const viewFromUrl = (searchParams.get('view') as View | null) ?? 'individual'
  const view: View = VIEWS.includes(viewFromUrl as View) ? viewFromUrl : 'individual'

  const [scope, setScope] = useState<LedgerScope>({ kind: 'company' })

  const setView = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'individual') params.delete('view')
      else params.set('view', next)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="space-y-6">
      <Tabs value={view} onValueChange={setView}>
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          <TabsList className="bg-transparent p-0 h-auto">
            <TabsTrigger
              value="individual"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              Individual
            </TabsTrigger>
            <TabsTrigger
              value="geral"
              className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900"
            >
              Geral
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="individual" className="mt-6 space-y-6">
          <ScopePicker scope={scope} onChange={setScope} />
          <ContaCorrenteUnified scope={scope} />
        </TabsContent>

        <TabsContent value="geral" className="mt-6">
          <PorConsultorTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
