'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, TrendingUp, Target, AlertTriangle } from 'lucide-react'
import type { AIAdvice } from '@/types/goal'

interface WeeklyReportAIAdviceProps {
  advice: AIAdvice | null
  onGenerate: (type: 'weekly' | 'monthly' | 'manager_prep') => Promise<AIAdvice | null>
  isManager?: boolean
}

export function WeeklyReportAIAdvice({ advice, onGenerate, isManager }: WeeklyReportAIAdviceProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [localAdvice, setLocalAdvice] = useState<AIAdvice | null>(advice)

  const handleGenerate = async (type: 'weekly' | 'monthly' | 'manager_prep') => {
    setIsLoading(true)
    try {
      const result = await onGenerate(type)
      if (result) setLocalAdvice(result)
    } finally {
      setIsLoading(false)
    }
  }

  if (!localAdvice) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground mb-4">
          Gera conselhos personalizados com base nos dados desta semana
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            onClick={() => handleGenerate('weekly')}
            disabled={isLoading}
            className="rounded-xl"
          >
            {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Conselhos semanais
          </Button>
          {isManager && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGenerate('manager_prep')}
              disabled={isLoading}
              className="rounded-xl"
            >
              Preparar 1:1
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Strengths */}
      {localAdvice.strengths && localAdvice.strengths.length > 0 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h4 className="text-sm font-semibold text-emerald-800">Pontos fortes</h4>
          </div>
          <ul className="space-y-1">
            {localAdvice.strengths.map((s, i) => (
              <li key={i} className="text-sm text-emerald-700 pl-4 relative before:content-['•'] before:absolute before:left-0">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips */}
      {localAdvice.weekly_tips && localAdvice.weekly_tips.length > 0 && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-semibold text-blue-800">Conselhos para a próxima semana</h4>
          </div>
          <ul className="space-y-1.5">
            {localAdvice.weekly_tips.map((t, i) => (
              <li key={i} className="text-sm text-blue-700 pl-4 relative before:content-['•'] before:absolute before:left-0">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Focus areas */}
      {localAdvice.focus_areas && localAdvice.focus_areas.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-amber-800">Áreas de foco</h4>
          </div>
          <ul className="space-y-1">
            {localAdvice.focus_areas.map((f, i) => (
              <li key={i} className="text-sm text-amber-700 pl-4 relative before:content-['•'] before:absolute before:left-0">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Manager talking points */}
      {isManager && localAdvice.manager_talking_points && localAdvice.manager_talking_points.length > 0 && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h4 className="text-sm font-semibold text-purple-800">Pontos para o 1:1</h4>
          </div>
          <ul className="space-y-1">
            {localAdvice.manager_talking_points.map((tp, i) => (
              <li key={i} className="text-sm text-purple-700 pl-4 relative before:content-['•'] before:absolute before:left-0">
                {tp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Regenerate */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleGenerate('weekly')}
          disabled={isLoading}
          className="rounded-xl text-xs"
        >
          {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
          Regenerar
        </Button>
        {isManager && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleGenerate('manager_prep')}
            disabled={isLoading}
            className="rounded-xl text-xs"
          >
            Preparar 1:1
          </Button>
        )}
      </div>
    </div>
  )
}
