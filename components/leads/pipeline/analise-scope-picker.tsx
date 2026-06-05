'use client'

/**
 * Scope picker for /dashboard/crm/analise → Análise tab. Same UI as the
 * conta-corrente ScopePicker — Empresa card + horizontal-scroll consultor
 * cards with a search input — but stripped of the saldo line (no equivalent
 * single metric per consultor at this level).
 *
 * Surfaces only to management roles; the AnaliseTab hides it for everyone
 * else (a consultor only ever sees their own data).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Infinity as InfinityIcon, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export type AnaliseScope = { kind: 'company' } | { kind: 'agent'; agentId: string }

interface Consultant {
  id: string
  commercial_name: string
  profile_photo_url: string | null
}

interface Props {
  scope: AnaliseScope
  onChange: (scope: AnaliseScope) => void
}

export function AnaliseScopePicker({ scope, onChange }: Props) {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const refreshCanScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.7), behavior: 'smooth' })
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/users/consultants')
        if (!res.ok) throw new Error()
        const raw = await res.json()
        // Endpoint returns an array of `{ id, commercial_name, dev_consultant_profiles: { profile_photo_url } }`
        // shaped rows. Flatten the nested profile photo.
        const list: Consultant[] = (Array.isArray(raw) ? raw : []).map((c: any) => ({
          id: c.id,
          commercial_name: c.commercial_name,
          profile_photo_url:
            c.dev_consultant_profiles?.profile_photo_url ??
            c.profile_photo_url ??
            null,
        }))
        if (!cancelled) setConsultants(list)
      } catch {
        if (!cancelled) setConsultants([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Re-evaluate arrow visibility when content / viewport changes.
  useEffect(() => {
    refreshCanScroll()
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(refreshCanScroll)
    ro.observe(el)
    return () => ro.disconnect()
  }, [refreshCanScroll, consultants, loading])

  const filtered = consultants.filter(
    (c) => !search || c.commercial_name?.toLowerCase().includes(search.toLowerCase()),
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

      {/* Cards row + edge scroll arrows */}
      <div className="relative">
        {canLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Anterior"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/90 backdrop-blur border border-border/40 shadow-md inline-flex items-center justify-center hover:bg-background transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {canRight && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Seguinte"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/90 backdrop-blur border border-border/40 shadow-md inline-flex items-center justify-center hover:bg-background transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={refreshCanScroll}
          className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
        >
        {/* Empresa (always first) */}
        <button
          type="button"
          onClick={() => onChange({ kind: 'company' })}
          className={cn(
            'group flex-shrink-0 flex flex-col items-center gap-2 rounded-2xl p-4 w-[140px]',
            'bg-neutral-900 text-white transition-all duration-300 hover:shadow-lg',
            isCompanyActive
              ? 'ring-2 ring-neutral-900 dark:ring-white shadow-md'
              : 'opacity-90 hover:opacity-100',
          )}
        >
          <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm ring-1 ring-white/20">
            <InfinityIcon className="h-5 w-5 text-white" />
          </div>
          <span className="text-xs font-semibold text-white">Empresa</span>
          <span className="text-[10px] text-white/60 uppercase tracking-wider">Visão global</span>
        </button>

        {/* Consultor cards */}
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
                      : 'border border-border hover:border-muted-foreground/20',
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
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}
