'use client'

/**
 * Leads — dedicated top-level page (above Oportunidades). Three tabs:
 *   1. Pipeline      — kanban of lead entries by lifecycle status
 *   2. Meta          — the consultor's attributed campaigns/ads + results
 *   3. Distribuição  — where leads come from + lifecycle breakdown
 *
 * Leads are kept distinct from Oportunidades on purpose: this is the inbound
 * triage stage; qualifying a lead spawns an opportunity in /dashboard/crm.
 */

import { Target, Facebook, PieChart } from 'lucide-react'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LeadsKanban } from '@/components/leads/pipeline/leads-kanban'
import { MetaTab } from '@/components/leads/pipeline/meta-tab'
import { DistribuicaoTab } from '@/components/leads/pipeline/distribuicao-tab'

export default function LeadsPipelinePage() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Target className="text-muted-foreground h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-muted-foreground text-sm">
            Triagem de leads recebidos. Qualifica para criar uma oportunidade.
          </p>
        </div>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Target className="h-4 w-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-1.5">
            <Facebook className="h-4 w-4" />
            Meta
          </TabsTrigger>
          <TabsTrigger value="distribuicao" className="gap-1.5">
            <PieChart className="h-4 w-4" />
            Distribuição
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <LeadsKanban />
        </TabsContent>
        <TabsContent value="meta">
          <MetaTab />
        </TabsContent>
        <TabsContent value="distribuicao">
          <DistribuicaoTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
