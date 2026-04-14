'use client'

import { CheckCircle2, Loader2, Mail, MessageCircle, XCircle } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SendResult } from '@/hooks/use-send-documents'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'

export function SendProgressList({ results }: { results: SendResult[] }) {
  if (results.length === 0) return null
  return (
    <div className="rounded-lg border bg-muted/30">
      <ul className="divide-y text-sm">
        {results.map((r, idx) => {
          const Icon =
            r.status === 'success'
              ? CheckCircle2
              : r.status === 'failed'
                ? XCircle
                : Loader2
          const colorClass =
            r.status === 'success'
              ? 'text-emerald-600'
              : r.status === 'failed'
                ? 'text-red-600'
                : 'text-muted-foreground'
          const ChannelIcon = r.channel === 'email' ? Mail : MessageCircle
          const statusLabel =
            r.status === 'success'
              ? DOCUMENT_LABELS.send.statusSuccess
              : r.status === 'failed'
                ? DOCUMENT_LABELS.send.statusFailed
                : r.status === 'sending'
                  ? DOCUMENT_LABELS.send.statusSending
                  : DOCUMENT_LABELS.send.statusPending

          const row = (
            <li
              key={`${r.channel}:${r.to}:${idx}`}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate font-medium">{r.to}</span>
              </span>
              <span className={`flex shrink-0 items-center gap-1 text-xs ${colorClass}`}>
                <Icon
                  className={`h-3.5 w-3.5 ${
                    r.status === 'sending' ? 'animate-spin' : ''
                  }`}
                />
                {statusLabel}
              </span>
            </li>
          )

          if (r.status === 'failed' && r.error) {
            return (
              <TooltipProvider key={`${r.channel}:${r.to}:${idx}`}>
                <Tooltip>
                  <TooltipTrigger asChild>{row}</TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    {r.error}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          }
          return row
        })}
      </ul>
    </div>
  )
}
