'use client'

import { useEffect, useState, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Users,
  Phone,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react'
import type { NegocioInteressado } from '@/types/lead'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

interface NegocioInteressadosProps {
  negocioId: string
  refreshKey?: number
}

export function NegocioInteressados({ negocioId, refreshKey }: NegocioInteressadosProps) {
  const [interessados, setInteressados] = useState<NegocioInteressado[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [strict, setStrict] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const qs = strict ? '' : '?strict=false'
      const res = await fetch(`/api/negocios/${negocioId}/interessados${qs}`)
      if (res.ok) {
        const data = await res.json()
        setInteressados(data.data || [])
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [negocioId, refreshKey, strict])

  useEffect(() => {
    load()
  }, [load])

  const Header = (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Compradores interessados
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="interessados-strict" className="text-xs text-muted-foreground cursor-pointer">
            Match estrito
          </Label>
          <Switch
            id="interessados-strict"
            checked={strict}
            onCheckedChange={setStrict}
            aria-label="Modo estrito (filtros apertados; desligar mostra mais compradores com tags de discrepância)"
          />
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Recarregar"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Header}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (interessados.length === 0) {
    return (
      <div className="space-y-4">
        {Header}
        <EmptyState
          icon={Users}
          title={strict ? 'Nenhum interessado encontrado' : 'Sem compradores no sistema'}
          description={
            strict
              ? 'Active o modo solto para alargar a pesquisa a compradores fora dos critérios apertados.'
              : 'Não existem compradores potenciais registados no sistema.'
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Header}

      {/* List */}
      <div className="space-y-2">
        {interessados.map((int) => {
          const hasContact = !!(int.phone || int.email)
          const badges = int.badges ?? []

          return (
            <div
              key={int.negocioId}
              className="rounded-xl border px-4 py-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{int.firstName}</p>
                  <p className="text-xs text-muted-foreground truncate">{int.colleague}</p>
                </div>

                {hasContact ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {int.phone && (
                      <a
                        href={`https://wa.me/${int.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900 flex items-center justify-center transition-colors"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                      </a>
                    )}
                    {int.phone && (
                      <a
                        href={`tel:${int.phone}`}
                        className="w-9 h-9 rounded-full bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900 flex items-center justify-center transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {int.phone && (
                      <a
                        href={`sms:${int.phone}`}
                        className="w-9 h-9 rounded-full border text-muted-foreground hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-sm italic text-muted-foreground shrink-0">sem contacto</span>
                )}
              </div>

              {badges.length > 0 && <MismatchBadgesRow badges={badges} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MismatchBadgesRow({ badges }: { badges: NonNullable<NegocioInteressado['badges']> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => {
        const Icon = b.type === 'warning' ? AlertTriangle : Info
        const cls =
          b.type === 'warning'
            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
        return (
          <span
            key={b.key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
          >
            <Icon className="h-2.5 w-2.5" />
            {b.label}
          </span>
        )
      })}
    </div>
  )
}
