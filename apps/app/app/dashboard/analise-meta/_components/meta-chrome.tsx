'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { MetaTabsNav } from './meta-tabs-nav'

// The section chrome (title + tabs) belongs to the list views only. On a detail
// page (campaign / ad / form / lead) we're "inside" a record, which has its own
// header + back button — so the tab picker is hidden there.
const LIST_PATHS = new Set([
  '/dashboard/analise-meta',
  '/dashboard/analise-meta/pedidos',
  '/dashboard/analise-meta/campanhas',
  '/dashboard/analise-meta/leads',
])

export function MetaChrome() {
  const pathname = usePathname()
  if (!LIST_PATHS.has(pathname)) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Análise Meta</h1>
          <p className="text-muted-foreground text-sm">
            Campanhas do Facebook e Instagram, os seus anúncios e formulários.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href="/dashboard/integracoes/meta">
            <Settings2 className="mr-2 h-4 w-4" />
            Integração
          </Link>
        </Button>
      </div>

      <MetaTabsNav />
    </div>
  )
}
