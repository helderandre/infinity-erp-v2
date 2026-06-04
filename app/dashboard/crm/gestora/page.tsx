'use client'

/**
 * Gestão de Leads deixou de ter página própria — foi convertida num Sheet
 * aberto pelo botão de definições no topo da página Leads.
 *
 * Esta rota mantém-se apenas como redireccionamento para não partir
 * bookmarks e os deep-links de push (?tab=por_atribuir|overdue) que agora
 * mapeiam para ?gestao=... na página Leads.
 */

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function GestoraRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const tab = searchParams.get('tab')
    // Old tabs → new sheet tabs. 'unassigned'/'distribution' folded into the
    // 3-tab set (por_atribuir / overdue / consultor).
    const map: Record<string, string> = {
      por_atribuir: 'por_atribuir',
      unassigned: 'por_atribuir',
      overdue: 'overdue',
      distribution: 'consultor',
    }
    const gestao = tab && map[tab] ? map[tab] : 'por_atribuir'
    router.replace(`/dashboard/crm/leads?gestao=${gestao}`)
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}

export default function GestoraPage() {
  return (
    <Suspense fallback={null}>
      <GestoraRedirect />
    </Suspense>
  )
}
