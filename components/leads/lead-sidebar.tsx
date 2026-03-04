'use client'

import { Phone, MessageSquare, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LEAD_ESTADOS, LEAD_TEMPERATURAS, formatDate } from '@/lib/constants'

const ESTADO_COLORS: Record<string, string> = {
  'Novo': 'bg-sky-500',
  'Em contacto': 'bg-yellow-500',
  'Qualificado': 'bg-emerald-500',
  'Em negociação': 'bg-blue-500',
  'Convertido': 'bg-purple-500',
  'Perdido': 'bg-red-500',
  'Arquivado': 'bg-slate-400',
}
import type { LeadWithAgent } from '@/types/lead'

// WhatsApp icon (not in lucide)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

interface LeadSidebarProps {
  lead: LeadWithAgent
  estado: string
  temperatura: string
  onEstadoChange: (value: string) => void
  onTemperaturaChange: (value: string) => void
}

export function LeadSidebar({
  lead,
  estado,
  temperatura,
  onEstadoChange,
  onTemperaturaChange,
}: LeadSidebarProps) {
  const tempMap: Record<string, { emoji: string; label: string; activeClass: string }> = {
    Frio: { emoji: '❄️', label: 'Fria', activeClass: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-700' },
    Morno: { emoji: '☀️', label: 'Morna', activeClass: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-700' },
    Quente: { emoji: '🔥', label: 'Quente', activeClass: 'bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-950 dark:text-red-300 dark:ring-red-700' },
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6 pb-6 space-y-6">
        {/* Name */}
        <h2 className="text-xl font-semibold text-center">{lead.nome}</h2>

        {/* Quick action buttons */}
        <div className="flex justify-center gap-4">
          {lead.telemovel && (
            <a href={`tel:${lead.telemovel}`} className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
                <Phone className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">Ligar</span>
            </a>
          )}
          {!lead.telemovel && (
            <div className="flex flex-col items-center gap-1 opacity-40">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                <Phone className="h-5 w-5" />
              </div>
              <span className="text-[11px] text-muted-foreground">Ligar</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-1 opacity-40">
            <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-[11px] text-muted-foreground">SMS</span>
          </div>

          {lead.telemovel ? (
            <a
              href={`https://wa.me/${lead.telemovel?.replace(/\D/g, '')}`}
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

          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="flex flex-col items-center gap-1">
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

        {/* Temperature */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Temperatura</p>
          <div className="flex gap-2">
            {LEAD_TEMPERATURAS.map((t) => {
              const info = tempMap[t.value]
              const isActive = temperatura === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => onTemperaturaChange(t.value)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                    ${isActive
                      ? (info?.activeClass || 'bg-foreground/10 ring-1 ring-foreground/20')
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }
                  `}
                >
                  <span>{info?.emoji}</span>
                  <span>{info?.label || t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Estado */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</p>
          <Select value={estado} onValueChange={onEstadoChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_ESTADOS.map((e) => (
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

        {/* Meta info */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-start gap-3 text-sm">
            <span className="text-muted-foreground mt-0.5">📅</span>
            <div>
              <p className="text-muted-foreground text-xs">Data de entrada</p>
              <p className="font-medium text-sm">{formatDate(lead.created_at)}</p>
            </div>
          </div>
          {lead.origem && (
            <div className="flex items-start gap-3 text-sm">
              <span className="text-muted-foreground mt-0.5">🔗</span>
              <div>
                <p className="text-muted-foreground text-xs">Origem</p>
                <p className="font-medium text-sm">{lead.origem}</p>
              </div>
            </div>
          )}
          {lead.agent?.commercial_name && (
            <div className="flex items-start gap-3 text-sm">
              <span className="text-muted-foreground mt-0.5">👤</span>
              <div>
                <p className="text-muted-foreground text-xs">Consultor</p>
                <p className="font-medium text-sm">{lead.agent.commercial_name}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
