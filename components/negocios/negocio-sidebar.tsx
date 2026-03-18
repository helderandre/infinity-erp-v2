'use client'

import { Phone, Mail, Building2, UserCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NEGOCIO_ESTADOS } from '@/lib/constants'
import { formatDate } from '@/lib/constants'
import { NegocioSummary } from './negocio-summary'
import { QuickFill } from './quick-fill'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const ESTADO_COLORS: Record<string, string> = {
  'Aberto': 'bg-sky-500',
  'Em Acompanhamento': 'bg-blue-500',
  'Em progresso': 'bg-indigo-500',
  'Proposta': 'bg-violet-500',
  'Fechado': 'bg-emerald-500',
  'Cancelado': 'bg-slate-400',
  'Perdido': 'bg-red-500',
}

interface NegocioSidebarProps {
  tipo: string
  leadName: string
  createdAt: string | null
  phone: string | null
  email: string | null
  estado: string
  negocioId: string
  onEstadoChange: (value: string) => void
  onQuickFillApply: (fields: Record<string, unknown>) => Promise<void>
  onStartAcquisition?: () => void
}

export function NegocioSidebar({
  tipo,
  leadName,
  createdAt,
  phone,
  email,
  estado,
  negocioId,
  onEstadoChange,
  onQuickFillApply,
  onStartAcquisition,
}: NegocioSidebarProps) {
  const showAcquisitionButton = ['Venda', 'Compra e Venda'].includes(tipo)
  const showAcompanhamentoButton = ['Compra', 'Compra e Venda'].includes(tipo)
  const isInAcompanhamento = estado === 'Em Acompanhamento'
  return (
    <Card className="w-full">
      <CardContent className="pt-6 pb-6 space-y-6">
        {/* Type label */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
          {tipo}
        </p>

        {/* Name + date */}
        <div className="text-center">
          <h2 className="text-xl font-semibold">{leadName}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Criado em {formatDate(createdAt)}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex justify-center gap-4">
          {phone ? (
            <a href={`tel:${phone}`} className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
                <Phone className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">Ligar</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-1 opacity-40">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                <Phone className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">Ligar</span>
            </div>
          )}

          {phone ? (
            <a
              href={`https://wa.me/${phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1"
            >
              <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors">
                <WhatsAppIcon className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">WhatsApp</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-1 opacity-40">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                <WhatsAppIcon className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">WhatsApp</span>
            </div>
          )}

          {email ? (
            <a href={`mailto:${email}`} className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 hover:bg-orange-100 transition-colors">
                <Mail className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">Email</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-1 opacity-40">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                <Mail className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">Email</span>
            </div>
          )}
        </div>

        {/* Estado */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</p>
          <Select value={estado} onValueChange={onEstadoChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NEGOCIO_ESTADOS.map((e) => (
                <SelectItem key={e} value={e}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${ESTADO_COLORS[e] || 'bg-slate-400'}`} />
                    {e}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Iniciar Angariação */}
        {showAcquisitionButton && onStartAcquisition && (
          <div className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onStartAcquisition}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Iniciar Angariação
            </Button>
          </div>
        )}

        {/* Acompanhamento (Compra) */}
        {showAcompanhamentoButton && !isInAcompanhamento && estado === 'Aberto' && (
          <div className={showAcquisitionButton ? '' : 'border-t pt-4'}>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onEstadoChange('Em Acompanhamento')}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Iniciar Acompanhamento
            </Button>
          </div>
        )}

        {/* Resumo IA */}
        <div className="border-t pt-4">
          <NegocioSummary negocioId={negocioId} />
        </div>

        {/* Quick Fill */}
        <div className="border-t pt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preencher com IA</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Escreve ou dita o que o cliente pretende e a IA preenche os campos.
          </p>
          <QuickFill negocioId={negocioId} tipo={tipo} onApply={onQuickFillApply} />
        </div>
      </CardContent>
    </Card>
  )
}
