'use client'

import { useEffect, useState } from 'react'
import { Infinity as InfinityIcon, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/constants'
import type { LedgerScope } from '@/lib/financial/ledger-types'

interface ConsultantSummary {
  id: string
  commercial_name: string
  profile_photo_url: string | null
  saldo_cc: number
  credit_limit: number | null
}

interface ScopePickerProps {
  scope: LedgerScope
  onChange: (scope: LedgerScope) => void
}

export function ScopePicker({ scope, onChange }: ScopePickerProps) {
  const [consultants, setConsultants] = useState<ConsultantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/financial/consultants-summary')
        const json = await res.json()
        setConsultants(json.consultants ?? [])
      } catch {
        setConsultants([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = consultants.filter(
    (c) => !search || c.commercial_name?.toLowerCase().includes(search.toLowerCase())
  )

  const isCompanyActive = scope.kind === 'company'

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Pesquisar consultor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-8 rounded-full bg-muted/50 border-0 text-xs"
        />
      </div>

      {/* Cards row */}
      <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* ─── Empresa card (sempre primeiro) ─── */}
        <button
          type="button"
          onClick={() => onChange({ kind: 'company' })}
          className={cn(
            'group flex-shrink-0 flex flex-col items-center gap-2 rounded-2xl p-4 w-[140px]',
            'bg-neutral-900 text-white transition-all duration-300',
            'hover:shadow-lg',
            isCompanyActive
              ? 'ring-2 ring-neutral-900 dark:ring-white shadow-md'
              : 'opacity-90 hover:opacity-100'
          )}
        >
          <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm ring-1 ring-white/20">
            <InfinityIcon className="h-5 w-5 text-white" />
          </div>
          <span className="text-xs font-semibold text-white">Empresa</span>
          <span className="text-[10px] text-white/60 uppercase tracking-wider">Visão global</span>
        </button>

        {/* ─── Consultor cards ─── */}
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] w-[140px] flex-shrink-0 rounded-2xl" />
            ))
          : filtered.map((c) => {
              const isActive = scope.kind === 'agent' && scope.agentId === c.id
              const initials =
                c.commercial_name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || '—'
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ kind: 'agent', agentId: c.id })}
                  className={cn(
                    'group flex-shrink-0 flex flex-col items-center gap-2 rounded-2xl p-4 w-[140px]',
                    'bg-card/50 backdrop-blur-sm transition-all duration-300',
                    'hover:shadow-lg hover:bg-card/80',
                    isActive
                      ? 'border-2 border-neutral-900 dark:border-white shadow-md bg-card/80'
                      : 'border border-border hover:border-muted-foreground/20'
                  )}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={c.profile_photo_url ?? undefined} />
                    <AvatarFallback className="text-xs bg-gradient-to-br from-neutral-200 to-neutral-400 dark:from-neutral-600 dark:to-neutral-800">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium truncate w-full text-center">
                    {c.commercial_name}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      c.saldo_cc >= 0 ? 'text-emerald-600' : 'text-red-600'
                    )}
                  >
                    {formatCurrency(c.saldo_cc)}
                  </span>
                </button>
              )
            })}
      </div>
    </div>
  )
}
