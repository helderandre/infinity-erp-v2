'use client'

import { useState } from 'react'
import { Camera, Sparkles, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useMarketingMomentsDue, type MarketingMomentDueItem } from '@/hooks/use-marketing-moments-due'
import { DealMarketingMomentCard } from '@/components/processes/deal-marketing-moment-card'
import { format, parseISO, isToday, isPast } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const EVENT_TYPE_LABELS: Record<MarketingMomentDueItem['event_type'], string> = {
  cpcv: 'CPCV',
  escritura: 'Escritura',
  contrato_arrendamento: 'Contrato de Arrendamento',
  entrega_chaves: 'Entrega de Chaves',
}

interface MarketingMomentsDueSectionProps {
  showAll?: boolean
  className?: string
}

export function MarketingMomentsDueSection({ showAll = false, className }: MarketingMomentsDueSectionProps) {
  const { items, isLoading, error, refetch } = useMarketingMomentsDue({ all: showAll })
  const [activeItem, setActiveItem] = useState<MarketingMomentDueItem | null>(null)

  if (isLoading) {
    return (
      <div className={cn('rounded-lg border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        A carregar momentos de marketing pendentes…
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive', className)}>
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-pink-600" />
          <h3 className="text-sm font-semibold">Momentos de marketing pendentes</h3>
          <Badge variant="outline" className="text-[10px] px-1.5">
            {items.length}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((item) => {
          const date = parseISO(item.scheduled_at)
          const overdue = isPast(date) && !isToday(date)
          const today = isToday(date)
          return (
            <button
              key={item.event_id}
              type="button"
              onClick={() => setActiveItem(item)}
              className={cn(
                'group flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors text-left w-full',
                today && 'border-pink-500/40 bg-pink-50/40',
                overdue && 'border-amber-500/50 bg-amber-50/30',
              )}
            >
              <div className={cn(
                'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
                today ? 'bg-pink-500/15 text-pink-600' : overdue ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground',
              )}>
                <Camera className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {EVENT_TYPE_LABELS[item.event_type] ?? item.event_type}
                    {item.lead_name ? ` — ${item.lead_name}` : ''}
                  </span>
                  {today && <Badge className="text-[10px] px-1.5 py-0 bg-pink-500 hover:bg-pink-600">Hoje</Badge>}
                  {overdue && <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-600">Em atraso</Badge>}
                </div>
                {item.property_address && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.property_address}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(date, "d 'de' MMMM 'às' HH:mm", { locale: pt })}
                  {item.deal_reference ? ` · ${item.deal_reference}` : ''}
                </p>
              </div>
              <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          )
        })}
      </div>

      {activeItem && (
        <Dialog open={!!activeItem} onOpenChange={(open) => !open && setActiveItem(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Momento de Marketing — {EVENT_TYPE_LABELS[activeItem.event_type] ?? activeItem.event_type}
              </DialogTitle>
              <DialogDescription>
                {activeItem.lead_name ? `${activeItem.lead_name} · ` : ''}
                {activeItem.property_address ?? activeItem.deal_reference ?? ''}
              </DialogDescription>
            </DialogHeader>
            <DealMarketingMomentCard
              dealId={activeItem.deal_id}
              momentType={activeItem.event_type}
              onSaved={() => {
                refetch()
                setActiveItem(null)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// Wrapper button to embed the section as a single CTA when no items exist
export function MarketingMomentsDueButton({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <Button variant="outline" size="sm" className="gap-1.5">
      <Camera className="h-3.5 w-3.5" />
      Marketing pendente
      <Badge className="ml-1 px-1.5 py-0">{count}</Badge>
    </Button>
  )
}
