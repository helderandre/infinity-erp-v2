'use client'

import { useMemo } from 'react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  CREDIT_STATUS_PIPELINE,
  CREDIT_STATUS_COLORS,
  CREDIT_TERMINAL_STATUSES,
} from '@/lib/constants'
import { CreditCard } from './credit-card'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { CreditRequestListItem } from '@/types/credit'

interface CreditPipelineProps {
  requests: CreditRequestListItem[]
  onRequestClick: (id: string) => void
}

export function CreditPipeline({ requests, onRequestClick }: CreditPipelineProps) {
  const [terminalExpanded, setTerminalExpanded] = useState(false)

  // Group requests by status
  const grouped = useMemo(() => {
    const map: Record<string, CreditRequestListItem[]> = {}
    for (const status of CREDIT_STATUS_PIPELINE) {
      map[status] = []
    }
    for (const status of CREDIT_TERMINAL_STATUSES) {
      map[status] = []
    }
    for (const req of requests) {
      if (map[req.status]) {
        map[req.status].push(req)
      }
    }
    return map
  }, [requests])

  // Pipeline statuses (non-terminal)
  const pipelineStatuses = CREDIT_STATUS_PIPELINE.filter(
    (s) => !(CREDIT_TERMINAL_STATUSES as readonly string[]).includes(s)
  )

  // Terminal statuses summary
  const terminalStatuses = CREDIT_TERMINAL_STATUSES.filter(
    (s) => grouped[s] && grouped[s].length > 0
  )
  const terminalTotal = CREDIT_TERMINAL_STATUSES.reduce(
    (sum, s) => sum + (grouped[s]?.length ?? 0),
    0
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Pipeline columns */}
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4" style={{ minWidth: 'max-content' }}>
          {pipelineStatuses.map((status) => {
            const items = grouped[status] ?? []
            const config = CREDIT_STATUS_COLORS[status]

            return (
              <div
                key={status}
                className="flex flex-col rounded-lg border bg-muted/30"
                style={{ minWidth: 240, width: 280 }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('h-2 w-2 rounded-full', config?.dot ?? 'bg-muted-foreground')}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium">
                      {config?.label ?? status}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                      config?.bg ?? 'bg-muted',
                      config?.text ?? 'text-muted-foreground'
                    )}
                  >
                    {items.length}
                  </span>
                </div>

                {/* Column body */}
                <div className="flex flex-col gap-2 p-2 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Sem pedidos
                    </p>
                  ) : (
                    items.map((req) => (
                      <CreditCard
                        key={req.id}
                        request={req}
                        onClick={() => onRequestClick(req.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Terminal statuses — collapsed summary */}
      {terminalTotal > 0 && (
        <div className="rounded-lg border bg-muted/20">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
            onClick={() => setTerminalExpanded((prev) => !prev)}
          >
            <div className="flex items-center gap-3">
              {terminalExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                Pedidos terminados
              </span>
              <span className="text-xs text-muted-foreground">
                ({terminalTotal})
              </span>
            </div>
            <div className="flex items-center gap-2">
              {terminalStatuses.map((status) => {
                const config = CREDIT_STATUS_COLORS[status]
                return (
                  <span
                    key={status}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                      config?.bg ?? 'bg-muted',
                      config?.text ?? 'text-muted-foreground'
                    )}
                  >
                    {config?.label ?? status}: {grouped[status]?.length ?? 0}
                  </span>
                )
              })}
            </div>
          </button>

          {terminalExpanded && (
            <div className="border-t px-4 py-3">
              <ScrollArea className="w-full">
                <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
                  {terminalStatuses.map((status) => {
                    const items = grouped[status] ?? []
                    const config = CREDIT_STATUS_COLORS[status]

                    return (
                      <div
                        key={status}
                        className="flex flex-col rounded-lg border bg-muted/30"
                        style={{ minWidth: 240, width: 260 }}
                      >
                        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn('h-2 w-2 rounded-full', config?.dot ?? 'bg-muted-foreground')}
                              aria-hidden="true"
                            />
                            <span className="text-sm font-medium">
                              {config?.label ?? status}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                              config?.bg ?? 'bg-muted',
                              config?.text ?? 'text-muted-foreground'
                            )}
                          >
                            {items.length}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 p-2 max-h-[300px] overflow-y-auto">
                          {items.map((req) => (
                            <CreditCard
                              key={req.id}
                              request={req}
                              onClick={() => onRequestClick(req.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
