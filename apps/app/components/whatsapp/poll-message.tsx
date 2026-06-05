"use client"

import { BarChart3 } from "lucide-react"
import type { WppMessage, PollData } from "@/lib/types/whatsapp-web"

interface PollMessageProps {
  message: WppMessage
  isSent?: boolean
}

export function PollMessage({ message, isSent }: PollMessageProps) {
  const pollData = message.poll_data as PollData | null
  if (!pollData) return null

  const totalVotes = pollData.options.reduce((sum, o) => sum + (o.votes || 0), 0)

  return (
    <div className="min-w-[260px] max-w-[320px]">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 text-emerald-600" />
        <span className="text-sm font-medium">Sondagem</span>
      </div>

      <p className="text-sm font-semibold mb-3">{pollData.name}</p>

      <div className="space-y-2">
        {pollData.options.map((option, i) => {
          const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
          return (
            <div key={i} className="relative">
              <div
                className={`absolute inset-0 rounded-lg transition-all ${isSent ? 'bg-emerald-300/60 dark:bg-emerald-700/40' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2 rounded-lg border">
                <span className="text-sm">{option.name}</span>
                {totalVotes > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {option.votes} ({Math.round(pct)}%)
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {totalVotes > 0
          ? `${totalVotes} ${totalVotes === 1 ? 'voto' : 'votos'}`
          : 'Sem votos ainda'}
        {pollData.selectableCount === 0
          ? ' · Selecção múltipla'
          : pollData.selectableCount > 1
            ? ` · Máx. ${pollData.selectableCount} opções`
            : ''}
      </p>
    </div>
  )
}
