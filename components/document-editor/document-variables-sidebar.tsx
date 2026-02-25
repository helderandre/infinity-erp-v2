'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, Variable } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { TemplateVariable } from '@/hooks/use-template-variables'

interface DocumentVariablesSidebarProps {
  allVariables: TemplateVariable[]
  onVariableClick?: (key: string) => void
}

export function DocumentVariablesSidebar({
  allVariables,
  onVariableClick,
}: DocumentVariablesSidebarProps) {
  const [isOpen, setIsOpen] = useState(true)

  const grouped = useMemo(() => {
    const map = new Map<string, TemplateVariable[]>()
    allVariables.forEach((variable) => {
      const category = variable.category || 'Sem categoria'
      if (!map.has(category)) map.set(category, [])
      map.get(category)!.push(variable)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [allVariables])

  const filtered = grouped.filter(([, vars]) => vars.length > 0)

  if (!isOpen) {
    return (
      <div className="flex flex-col items-center border-l border-border bg-card w-12 py-2 gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="h-8 w-8 p-0 rounded"
        >
          <Variable className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col border-l border-border bg-card w-72 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Variáveis</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma variável.</p>
          ) : (
            filtered.map(([category, vars]) => (
              <div key={category}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {vars.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => onVariableClick?.(v.key)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-accent transition-colors"
                      title={`{{${v.key}}}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border px-4 py-2">
        <p className="text-xs text-muted-foreground">Clique para inserir</p>
      </div>
    </div>
  )
}
