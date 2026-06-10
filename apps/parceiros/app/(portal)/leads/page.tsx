'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Phone, Check } from 'lucide-react'
// Real CRM lead pipeline, locked to the partner's referred leads (@/ -> apps/app).
import { LeadsKanban } from '@/components/leads/pipeline/leads-kanban'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default function LeadsPage() {
  const router = useRouter()
  // Counts now come from the kanban itself (onFilteredCountsChange) so the
  // hero KPIs track the active filters — especially the Consultor filter.
  const [counts, setCounts] = useState<{ novo: number; contactado: number; qualificado: number } | null>(null)

  const kpis = [
    { Icon: Sparkles, label: 'Novos', value: counts?.novo },
    { Icon: Phone, label: 'Contactados', value: counts?.contactado },
    { Icon: Check, label: 'Qualificados', value: counts?.qualificado },
  ]

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 space-y-4 px-8 py-8 sm:px-10 sm:py-10">
          <h1 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
            As minhas referências
          </h1>
          <div className="flex justify-center">
            <div className="inline-flex items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              {kpis.map(({ Icon, label, value }, i) => (
                <div
                  key={label}
                  className={cn(
                    'flex min-w-[88px] flex-col items-center justify-center gap-0.5 px-5 py-2.5 md:flex-row md:gap-2',
                    i > 0 && 'border-l border-white/10',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="hidden h-3 w-3 text-white/50 md:block" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</span>
                  </div>
                  {value == null ? (
                    <Skeleton className="h-4 w-8 bg-white/10" />
                  ) : (
                    <span className="text-base font-bold tabular-nums text-white">{value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Locked to "referenciadas" — partner only sees leads they referred.
          Consultor filter + filter-aware hero counts wired in. */}
      <LeadsKanban
        view="referenciadas"
        onViewChange={() => {}}
        showConsultantFilter
        onFilteredCountsChange={setCounts}
        onOpenReferredDeal={(dealId) => router.push(`/oportunidades?deal=${dealId}`)}
      />
    </div>
  )
}
