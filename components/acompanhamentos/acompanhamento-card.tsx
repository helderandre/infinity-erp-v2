'use client'

import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  User,
  MapPin,
  Euro,
  Building2,
  CreditCard,
  MoreHorizontal,
  Eye,
  Trash2,
  Pause,
  Play,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ACOMPANHAMENTO_STATUS_COLORS,
} from '@/lib/constants'
import type { AcompanhamentoWithRelations } from '@/types/acompanhamento'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AcompanhamentoCardProps {
  acompanhamento: AcompanhamentoWithRelations
  onView?: (a: AcompanhamentoWithRelations) => void
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onDelete?: (id: string) => void
}

export function AcompanhamentoCard({
  acompanhamento: a,
  onView,
  onPause,
  onResume,
  onDelete,
}: AcompanhamentoCardProps) {
  const statusStyle = ACOMPANHAMENTO_STATUS_COLORS[a.status]
  const neg = a.negocio
  const clientName = a.lead?.full_name || a.lead?.nome || 'Lead'
  const initials = clientName.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  const budgetText = neg?.orcamento || neg?.orcamento_max
    ? [
        neg.orcamento ? `${(neg.orcamento / 1000).toFixed(0)}k` : '—',
        neg.orcamento_max ? `${(neg.orcamento_max / 1000).toFixed(0)}k` : '—',
      ].join(' – ') + ' €'
    : null

  return (
    <div
      className="group relative flex flex-col bg-background rounded-xl border overflow-hidden transition-all duration-300 hover:shadow-xl cursor-pointer"
      onClick={() => onView?.(a)}
    >
      {/* Top color bar */}
      <div className={cn('h-1', statusStyle.dot)} />

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Header: avatar + name + actions */}
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-400 dark:from-neutral-700 dark:to-neutral-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{clientName}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                variant="secondary"
                className={`${statusStyle.bg} ${statusStyle.text} border-0 rounded-full text-[10px] px-2 py-0`}
              >
                {statusStyle.label}
              </Badge>
              {neg?.prazo_compra && (
                <span className="text-[10px] text-muted-foreground">{neg.prazo_compra}</span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onView?.(a)}>
                <Eye className="mr-2 h-4 w-4" />Ver Detalhe
              </DropdownMenuItem>
              {a.status === 'active' && onPause && (
                <DropdownMenuItem onClick={() => onPause(a.id)}>
                  <Pause className="mr-2 h-4 w-4" />Pausar
                </DropdownMenuItem>
              )}
              {a.status === 'paused' && onResume && (
                <DropdownMenuItem onClick={() => onResume(a.id)}>
                  <Play className="mr-2 h-4 w-4" />Retomar
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(a.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />Eliminar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Criteria pills */}
        {neg && (
          <div className="space-y-2 flex-1">
            {/* Property type + typology */}
            {(neg.tipo_imovel || neg.quartos_min) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {neg.tipo_imovel && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full">
                    <Building2 className="h-2.5 w-2.5" />
                    {neg.tipo_imovel}
                  </span>
                )}
                {neg.quartos_min && (
                  <span className="text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full">
                    T{neg.quartos_min}+
                  </span>
                )}
              </div>
            )}

            {/* Location */}
            {neg.localizacao && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{neg.localizacao}</span>
              </div>
            )}

            {/* Budget */}
            {budgetText && (
              <div className="flex items-center gap-1.5">
                <Euro className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-xs font-semibold">{budgetText}</span>
              </div>
            )}

            {/* Credit badge */}
            {neg.credito_pre_aprovado && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
                <CreditCard className="h-2.5 w-2.5" />
                Pré-aprovado
                {neg.valor_credito ? ` ${(neg.valor_credito / 1000).toFixed(0)}k€` : ''}
              </span>
            )}
            {!neg.credito_pre_aprovado && neg.financiamento_necessario && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                <CreditCard className="h-2.5 w-2.5" />
                Necessita financiamento
              </span>
            )}
          </div>
        )}

        {/* Footer: contact + date + arrow */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-border/40">
          <div className="flex items-center gap-2">
            {a.lead?.telemovel && (
              <a
                href={`tel:${a.lead.telemovel}`}
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-7 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
              >
                <Phone className="h-3 w-3" />
              </a>
            )}
            {a.lead?.email && (
              <a
                href={`mailto:${a.lead.email}`}
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-7 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
              >
                <Mail className="h-3 w-3" />
              </a>
            )}
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(a.created_at), 'd MMM', { locale: pt })}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  )
}
