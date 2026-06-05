'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  FileUp, CalendarClock, MessageSquare, ChevronRight, Building2, Check,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getPortalHome } from './actions'
import type { PortalHomeData, PendingAction, PortalProperty, ProcessSummary } from './actions'

const fmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const ACTION_ICONS = {
  document: FileUp,
  visit: CalendarClock,
  message: MessageSquare,
} as const

const URGENCY_COLORS = {
  high: 'bg-red-500/15 text-red-600',
  medium: 'bg-amber-500/15 text-amber-600',
  low: 'bg-slate-500/15 text-slate-600',
} as const

export default function PortalHomePage() {
  const [data, setData] = useState<PortalHomeData | null>(null)
  const [loading, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await getPortalHome()
        setData(result)
      } catch { /* handled by empty state */ }
    })
  }, [])

  if (!data) {
    return <HomeSkeleton />
  }

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Ola, {data.user.name}
        </h1>
        <p className="text-sm text-muted-foreground capitalize">{today}</p>
      </div>

      {/* Process summary card */}
      {data.process && (
        <Card className="rounded-xl shadow-sm border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Processo {data.process.external_ref}</p>
              <Badge variant="secondary" className="text-xs">
                {data.process.percent_complete}%
              </Badge>
            </div>
            <Progress value={data.process.percent_complete} className="h-2" />
            {data.process.current_stage_name && (
              <p className="text-xs text-muted-foreground">
                Fase actual: {data.process.current_stage_name}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending actions */}
      {data.pending_actions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Proximas Accoes
          </h2>
          <div className="space-y-2">
            {data.pending_actions.map((action) => (
              <ActionCard key={action.id} action={action} />
            ))}
          </div>
        </section>
      )}

      {/* Process mini stepper */}
      {data.process && data.process.stages.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              O Seu Processo
            </h2>
            <Link
              href="/portal/processo"
              className="text-xs text-primary font-medium flex items-center gap-0.5"
            >
              Ver detalhes <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <MiniStepper stages={data.process.stages} />
        </section>
      )}

      {/* Properties */}
      {data.properties.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Imoveis
            </h2>
            <Link
              href="/portal/imoveis"
              className="text-xs text-primary font-medium flex items-center gap-0.5"
            >
              Ver todos <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
            {data.properties.map((property) => (
              <PropertyMiniCard key={property.id} property={property} />
            ))}
          </div>
        </section>
      )}

      {/* Last message */}
      {data.last_message && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Mensagens
            </h2>
            <Link
              href="/portal/mensagens"
              className="text-xs text-primary font-medium flex items-center gap-0.5"
            >
              Ver todas <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm font-medium">{data.last_message.consultant_name}</p>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {data.last_message.content}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Empty state if nothing to show */}
      {!data.process && data.pending_actions.length === 0 && data.properties.length === 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-6 text-center space-y-2">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Bem-vindo ao portal. O seu consultor ira adicionar informacoes brevemente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ActionCard({ action }: { action: PendingAction }) {
  const Icon = ACTION_ICONS[action.type] || FileUp
  return (
    <Link href={action.href}>
      <Card className="rounded-xl shadow-sm active:scale-[0.98] transition-transform">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${URGENCY_COLORS[action.urgency]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{action.title}</p>
            <p className="text-xs text-muted-foreground truncate">{action.description}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}

function MiniStepper({ stages }: { stages: ProcessSummary['stages'] }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-1">
          {stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                    stage.status === 'completed'
                      ? 'bg-emerald-500 text-white'
                      : stage.status === 'active'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stage.status === 'completed' ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-14 truncate">
                  {stage.name}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 rounded-full mt-[-16px] ${
                    stage.status === 'completed' ? 'bg-emerald-500' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PropertyMiniCard({ property }: { property: PortalProperty }) {
  return (
    <Link href="/portal/imoveis" className="snap-start">
      <Card className="rounded-xl shadow-sm w-56 shrink-0 overflow-hidden active:scale-[0.98] transition-transform">
        <div className="aspect-video relative bg-muted">
          {property.cover_url ? (
            <Image
              src={property.cover_url}
              alt={property.title}
              fill
              className="object-cover"
              sizes="224px"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Building2 className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <CardContent className="p-3 space-y-1">
          <p className="text-sm font-medium truncate">{property.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {[property.city, property.zone].filter(Boolean).join(', ') || 'Portugal'}
          </p>
          {property.listing_price != null && (
            <p className="text-sm font-semibold text-primary">
              {fmt.format(property.listing_price)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-3">
          <Skeleton className="h-44 w-56 rounded-xl shrink-0" />
          <Skeleton className="h-44 w-56 rounded-xl shrink-0" />
        </div>
      </div>
    </div>
  )
}
