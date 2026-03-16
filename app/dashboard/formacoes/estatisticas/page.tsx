'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TrainingStatsOverview } from '@/components/training/training-stats-overview'
import { useTrainingStats } from '@/hooks/use-training-stats'

export default function EstatisticasPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EstatisticasContent />
    </Suspense>
  )
}

function EstatisticasContent() {
  const { stats, isLoading } = useTrainingStats()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/formacoes"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estatísticas de Formação</h1>
          <p className="text-muted-foreground">Visão geral do progresso de formação</p>
        </div>
      </div>

      <TrainingStatsOverview stats={stats} isLoading={isLoading} />
    </div>
  )
}
