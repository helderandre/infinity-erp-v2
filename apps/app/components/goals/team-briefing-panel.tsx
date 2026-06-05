'use client'

import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'

interface TeamBriefingPanelProps {
  briefing: string | null
  isLoading: boolean
  onGenerate: () => void
}

export function TeamBriefingPanel({ briefing, isLoading, onGenerate }: TeamBriefingPanelProps) {
  if (!briefing) {
    return (
      <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
        <div className="h-10 w-10 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="h-5 w-5 text-purple-500" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Gera um briefing semanal da equipa para a reunião
        </p>
        <Button size="sm" onClick={onGenerate} disabled={isLoading} className="rounded-full">
          {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          Gerar briefing semanal
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-purple-50 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-purple-500" />
          </div>
          <h3 className="text-sm font-semibold">Briefing da Equipa</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={onGenerate} disabled={isLoading} className="rounded-full text-xs h-8">
          {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
          Regenerar
        </Button>
      </div>
      <div className="px-6 py-5">
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {briefing}
        </div>
      </div>
    </div>
  )
}
