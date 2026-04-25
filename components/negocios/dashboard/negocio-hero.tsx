'use client'

import { ArrowLeft, Mail, Phone, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { EstadoPipelineSelector } from '@/components/negocios/estado-pipeline-selector'
import {
  TemperaturaSelector,
  type Temperatura,
} from '@/components/negocios/temperatura-selector'
import { ObservationsButton } from '@/components/crm/observations-dialog'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

interface NegocioHeroProps {
  tipo: string
  isCompraEVenda?: boolean
  perspective?: 'compra' | 'venda'
  onPerspectiveChange?: (p: 'compra' | 'venda') => void
  // Lead
  clientName: string
  phone: string | null
  email: string | null
  // Status
  estado: string
  pipelineStageId: string | null
  temperatura: Temperatura | null | undefined
  observacoes: string | null
  createdAt: string
  // Handlers
  onBack: () => void
  onPipelineChange: (stage: { id: string; name: string }) => void
  onTemperaturaChange: (next: Temperatura) => void
  onObservationsSave: (next: string | null) => Promise<void>
  onAiFill: () => void
}

export function NegocioHero({
  tipo,
  isCompraEVenda,
  perspective,
  onPerspectiveChange,
  clientName,
  phone,
  email,
  estado,
  pipelineStageId,
  temperatura,
  observacoes,
  createdAt,
  onBack,
  onPipelineChange,
  onTemperaturaChange,
  onObservationsSave,
  onAiFill,
}: NegocioHeroProps) {
  const initials = (clientName || 'L').slice(0, 2).toUpperCase()

  return (
    <header
      className={cn(
        'rounded-3xl border border-border/40 px-5 py-5 sm:px-7 sm:py-6',
        'bg-card/60 supports-[backdrop-filter]:bg-card/40 backdrop-blur-xl',
        'shadow-sm',
      )}
    >
      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors -ml-1 mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left: avatar + name + status */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-muted/70 border border-border/40 flex items-center justify-center shrink-0">
            <span className="text-base sm:text-lg font-semibold text-foreground/80">
              {initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">
              {tipo}
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight mt-0.5 truncate">
              {clientName}
            </h1>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <EstadoPipelineSelector
                tipo={tipo}
                perspective={isCompraEVenda ? perspective : undefined}
                pipelineStageId={pipelineStageId}
                fallbackLabel={estado}
                onChange={onPipelineChange}
              />
              <TemperaturaSelector value={temperatura} onChange={onTemperaturaChange} />
              <ObservationsButton observacoes={observacoes} onSave={onObservationsSave} />
              <span className="text-[11px] text-muted-foreground/70 ml-1">
                desde {format(new Date(createdAt), "d MMM yyyy", { locale: pt })}
              </span>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {phone && (
            <a
              href={`tel:${phone}`}
              title="Ligar"
              className={contactButtonClass}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          {phone && (
            <a
              href={`https://wa.me/${phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              className={contactButtonClass}
            >
              <WhatsAppIcon className="h-4 w-4" />
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} title="Email" className={contactButtonClass}>
              <Mail className="h-4 w-4" />
            </a>
          )}
          {(phone || email) && (
            <span className="h-6 w-px bg-border/60 mx-1" aria-hidden />
          )}
          <button
            type="button"
            onClick={onAiFill}
            title="Preencher com IA"
            className={contactButtonClass}
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Compra e Venda perspective toggle */}
      {isCompraEVenda && onPerspectiveChange && (
        <div className="mt-4">
          <div className="inline-flex items-center gap-1 p-0.5 rounded-full bg-muted/60 border border-border/40">
            <button
              type="button"
              onClick={() => onPerspectiveChange('compra')}
              className={cn(
                'px-4 py-1 rounded-full text-xs font-medium transition-all',
                perspective === 'compra'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Compra
            </button>
            <button
              type="button"
              onClick={() => onPerspectiveChange('venda')}
              className={cn(
                'px-4 py-1 rounded-full text-xs font-medium transition-all',
                perspective === 'venda'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Venda
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

const contactButtonClass = cn(
  'h-9 w-9 rounded-full border border-border/40 flex items-center justify-center transition-all',
  'bg-foreground/[0.04] supports-[backdrop-filter]:bg-foreground/[0.03] backdrop-blur-sm',
  'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08]',
)
