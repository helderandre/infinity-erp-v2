import Link from 'next/link'
import { Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { MetaTabsNav } from './_components/meta-tabs-nav'

export default function AnaliseMetaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Análise Meta</h1>
          <p className="text-muted-foreground text-sm">
            Dados sincronizados via webhook do meta-api (leads, formulários,
            campanhas e anúncios).
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/integracoes/meta">
            <Settings2 className="mr-2 h-4 w-4" />
            Integração
          </Link>
        </Button>
      </div>

      <MetaTabsNav />

      {children}
    </div>
  )
}
