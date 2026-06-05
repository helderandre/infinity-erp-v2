'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import type { TemplateVariable } from '@/hooks/use-template-variables'

interface EmailVariablesGroupedProps {
  templateVariables: TemplateVariable[]
  resolvedVariables: Record<string, string>
  onInsertVariable: (key: string) => void
}

export function EmailVariablesGrouped({
  templateVariables,
  resolvedVariables,
  onInsertVariable,
}: EmailVariablesGroupedProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, TemplateVariable[]>()
    templateVariables.forEach((v) => {
      const category = v.category || 'Sem categoria'
      if (!map.has(category)) map.set(category, [])
      map.get(category)!.push(v)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [templateVariables])

  if (templateVariables.length === 0) return null

  return (
    <div className="space-y-2">
      <Label>Variáveis</Label>
      <div className="space-y-3">
        {grouped.map(([category, vars]) => (
          <div key={category}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {category}
            </p>
            <div className="flex flex-wrap gap-1">
              {vars.map((v) => {
                const resolved = resolvedVariables[v.key]
                const hasResolved = resolved !== undefined && resolved !== ''
                return (
                  <button
                    key={v.key}
                    type="button"
                    className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors text-left"
                    onClick={() => onInsertVariable(v.key)}
                    title={hasResolved ? `${v.label}: ${resolved}` : v.label}
                  >
                    {hasResolved ? (
                      <span className="font-medium">{resolved}</span>
                    ) : (
                      v.label
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Clique para inserir na posição do cursor
      </p>
    </div>
  )
}
