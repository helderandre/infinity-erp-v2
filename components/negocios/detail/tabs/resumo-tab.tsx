'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Calendar, Euro, User, Building2, Phone, Mail, Tag, MapPin } from 'lucide-react'

interface ResumoTabProps {
  negocio: {
    tipo: string | null
    expected_value: number | null
    expected_close_date: string | null
    won_date: string | null
    lost_date: string | null
    lost_reason: string | null
    temperatura: string | null
    origem: string | null
    classe_imovel: string | null
    quartos: number | null
    area_m2: number | null
    orcamento: number | null
    orcamento_max: number | null
    financiamento_necessario: boolean | null
    credito_pre_aprovado: boolean | null
    valor_credito: number | null
    pipeline_stage?: { name: string; color: string | null } | null
    lead?: {
      id: string
      nome: string
      full_name: string | null
      email: string | null
      telemovel: string | null
      empresa: string | null
      nipc: string | null
    } | null
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), "d 'de' MMM yyyy", { locale: pt })
  } catch {
    return '—'
  }
}

function fmtMoney(n: number | null) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString('pt-PT')} €`
}

export function ResumoTab({ negocio }: ResumoTabProps) {
  const lead = negocio.lead
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
      {/* Lead card */}
      <Card className="p-5 space-y-3 lg:col-span-1">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Lead</h3>
        </div>
        {lead ? (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Nome</dt>
              <dd className="font-medium">{lead.full_name || lead.nome}</dd>
            </div>
            {lead.telemovel && (
              <div className="flex items-center gap-1.5 text-xs">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <a href={`tel:${lead.telemovel}`} className="hover:underline">{lead.telemovel}</a>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-1.5 text-xs">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <a href={`mailto:${lead.email}`} className="hover:underline truncate">{lead.email}</a>
              </div>
            )}
            {lead.empresa && (
              <div className="flex items-center gap-1.5 text-xs pt-2 border-t">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span>{lead.empresa}{lead.nipc ? ` · NIPC ${lead.nipc}` : ''}</span>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Sem lead associado.</p>
        )}
      </Card>

      {/* Pipeline card */}
      <Card className="p-5 space-y-3 lg:col-span-1">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Pipeline</h3>
        </div>
        <dl className="space-y-2.5 text-sm">
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Estado actual</dt>
            <dd>
              {negocio.pipeline_stage ? (
                <Badge
                  variant="outline"
                  style={
                    negocio.pipeline_stage.color
                      ? { borderColor: negocio.pipeline_stage.color, color: negocio.pipeline_stage.color }
                      : undefined
                  }
                >
                  {negocio.pipeline_stage.name}
                </Badge>
              ) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Origem</dt>
            <dd className="text-xs">{negocio.origem ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Temperatura</dt>
            <dd className="text-xs">{negocio.temperatura ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground tracking-wide flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Previsão de fecho
            </dt>
            <dd className="text-xs">{fmtDate(negocio.expected_close_date)}</dd>
          </div>
          {negocio.won_date && (
            <div>
              <dt className="text-[10px] uppercase text-emerald-600 tracking-wide">Fechado em</dt>
              <dd className="text-xs font-medium">{fmtDate(negocio.won_date)}</dd>
            </div>
          )}
          {negocio.lost_date && (
            <div>
              <dt className="text-[10px] uppercase text-red-600 tracking-wide">Perdido em</dt>
              <dd className="text-xs font-medium">
                {fmtDate(negocio.lost_date)}
                {negocio.lost_reason ? ` · ${negocio.lost_reason}` : ''}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Financeiro / Imóvel card */}
      <Card className="p-5 space-y-3 lg:col-span-1">
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Financeiro / Imóvel</h3>
        </div>
        <dl className="space-y-2.5 text-sm">
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Valor expectável</dt>
            <dd className="font-semibold">{fmtMoney(negocio.expected_value)}</dd>
          </div>
          {(negocio.orcamento != null || negocio.orcamento_max != null) && (
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Orçamento</dt>
              <dd className="text-xs">
                {fmtMoney(negocio.orcamento)}
                {negocio.orcamento_max != null && negocio.orcamento_max !== negocio.orcamento
                  ? ` – ${fmtMoney(negocio.orcamento_max)}`
                  : ''}
              </dd>
            </div>
          )}
          <div className="pt-2 border-t space-y-1.5">
            {negocio.classe_imovel && (
              <div className="text-xs"><span className="text-muted-foreground">Tipo:</span> {negocio.classe_imovel}</div>
            )}
            {negocio.quartos != null && (
              <div className="text-xs"><span className="text-muted-foreground">Quartos:</span> {negocio.quartos}</div>
            )}
            {negocio.area_m2 != null && (
              <div className="text-xs"><span className="text-muted-foreground">Área:</span> {negocio.area_m2} m²</div>
            )}
          </div>
          {negocio.financiamento_necessario && (
            <div className="pt-2 border-t space-y-1">
              <div className="text-xs"><span className="text-muted-foreground">Financiamento:</span> Necessário</div>
              {negocio.credito_pre_aprovado && (
                <div className="text-xs"><span className="text-muted-foreground">Pré-aprovado:</span> Sim</div>
              )}
              {negocio.valor_credito != null && (
                <div className="text-xs"><span className="text-muted-foreground">Valor:</span> {fmtMoney(negocio.valor_credito)}</div>
              )}
            </div>
          )}
        </dl>
      </Card>
    </div>
  )
}
