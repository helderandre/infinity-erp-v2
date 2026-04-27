'use client'

import { useEffect, useState } from 'react'
import { DealMarketingMomentCard } from './deal-marketing-moment-card'
import type { ProcSubtask } from '@/types/subtask'

type MomentType = 'cpcv' | 'escritura' | 'contrato_arrendamento' | 'entrega_chaves'

interface MarketingMoment {
  id: string
  photo_urls: string[]
  manual_caption: string | null
  ai_description: string | null
  ai_description_model: string | null
  ai_description_generated_at: string | null
  published_to_instagram: boolean
  published_to_linkedin: boolean
}

interface SubtaskCardAiCaptionProps {
  subtask: ProcSubtask
  dealId: string | null
  onCompleted: () => void
}

export function SubtaskCardAiCaption({ subtask, dealId, onCompleted }: SubtaskCardAiCaptionProps) {
  const config = (subtask.config ?? {}) as Record<string, unknown>
  const momentType = (config.moment_type as MomentType | undefined) ?? 'cpcv'

  const [existingMoment, setExistingMoment] = useState<MarketingMoment | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!dealId) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/deals/${dealId}/marketing-moments`)
        if (!res.ok) return
        const { data } = await res.json()
        if (cancelled) return
        // Filter by moment_type, take most recent
        const match = (data as MarketingMoment[] & { moment_type: string }[]).find(
          (m: any) => m.moment_type === momentType
        )
        setExistingMoment(match ?? null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dealId, momentType])

  if (!dealId) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        Esta subtarefa requer um deal associado ao processo. Submete o negócio primeiro.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        A carregar momento de marketing…
      </div>
    )
  }

  return (
    <DealMarketingMomentCard
      dealId={dealId}
      momentType={momentType}
      existingMoment={existingMoment}
      onSaved={(saved) => setExistingMoment(saved)}
      onMarkSubtaskComplete={subtask.is_completed ? undefined : onCompleted}
    />
  )
}
