'use client'

/**
 * Glassmorphic lead-detail sheet — abre inline a partir da inbox de leads, do
 * AdDetailSheet ou do FormDetailSheet, em vez de navegar para a (descontinuada)
 * página standalone /dashboard/analise-meta/leads/[id]. Mostra contacto,
 * respostas ao formulário humanizadas, origem e datas.
 *
 * Dados: GET /api/analise-meta/leads/[id] (gestão vê tudo; consultor só os
 * leads das campanhas atribuídas a si).
 */

import { useEffect, useState } from 'react'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  CheckCircle2, Clock, FileText, Image as ImageIcon, Loader2, Mail, Phone,
  Target, User,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { formatQuestionType } from '@/lib/meta/labels'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

const GLASS = 'rounded-2xl border border-border/40 bg-card/50 backdrop-blur-xl'

interface FormQuestionOption {
  key: string
  value: string
}

interface FormQuestion {
  id: string
  key: string
  label: string
  type: string
  options?: FormQuestionOption[]
}

interface LeadFieldData {
  name: string
  values: string[]
}

interface Bundle {
  lead: {
    id: string
    leadgen_id: string
    full_name: string | null
    email: string | null
    phone: string | null
    page_id: string | null
    form_id: string | null
    campaign_id: string | null
    ad_id: string | null
    signature_valid: boolean
    received_at: string
    fb_created_time: string | null
    processed: boolean
    processed_at: string | null
    lead_id: string | null
  }
  field_data: LeadFieldData[]
  form: { form_id: string; form_name: string | null; questions: FormQuestion[] } | null
  campaign: { campaign_id: string; name: string | null } | null
  ad: { ad_id: string; name: string | null } | null
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

function fmtPt(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

// A Meta envia as respostas como chaves normalizadas (ex.: `t1_-_desde_€305.000_`);
// resolve para o `value` humano quando a pergunta tem opções declaradas.
function resolveAnswerValue(rawValue: string, question: FormQuestion | undefined): string {
  if (!question?.options) return rawValue
  const opt = question.options.find((o) => o.key === rawValue)
  return opt?.value ?? rawValue
}

export function LeadDetailSheet({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Bundle | null>(null)

  useEffect(() => {
    if (!open || !leadId) return
    let active = true
    setLoading(true)
    setData(null)
    fetch(`/api/analise-meta/leads/${leadId}`)
      .then((r) => r.json())
      .then((json) => {
        if (active && !json.error) setData(json as Bundle)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, leadId])

  const questionByKey = new Map((data?.form?.questions ?? []).map((q) => [q.key, q]))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 overflow-hidden border-border/40 p-0 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[88dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Detalhe do lead</SheetTitle>
        </VisuallyHidden>
        {isMobile && (
          <div className="bg-muted-foreground/25 absolute left-1/2 top-2.5 z-10 h-1 w-10 -translate-x-1/2 rounded-full" />
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {loading || !data ? (
            <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="bg-muted/60 flex h-8 w-8 items-center justify-center rounded-xl">
                    <User className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-semibold leading-tight">
                    {data.lead.full_name ?? '(sem nome)'}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {data.lead.processed ? (
                    <Badge variant="default" className="gap-1 text-[10px]">
                      <CheckCircle2 className="h-3 w-3" />
                      Processado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Por processar
                    </Badge>
                  )}
                  {data.lead.lead_id && (
                    <Badge variant="secondary" className="text-[10px]">
                      Associado a CRM
                    </Badge>
                  )}
                  {!data.lead.signature_valid && (
                    <Badge variant="destructive" className="text-[10px]">
                      Assinatura inválida
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground font-mono text-xs">
                  ID Facebook: {data.lead.leadgen_id}
                </p>
              </div>

              {/* Contacto */}
              <div className={`${GLASS} space-y-1.5 p-4 text-sm`}>
                <h3 className="mb-1 text-sm font-semibold">Contacto</h3>
                {data.lead.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="text-muted-foreground h-4 w-4" />
                    <a href={`mailto:${data.lead.email}`} className="hover:underline">
                      {data.lead.email}
                    </a>
                  </p>
                )}
                {data.lead.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="text-muted-foreground h-4 w-4" />
                    <a href={`tel:${data.lead.phone.replace(/\s/g, '')}`} className="hover:underline">
                      {data.lead.phone}
                    </a>
                  </p>
                )}
                {!data.lead.email && !data.lead.phone && (
                  <p className="text-muted-foreground text-sm">Sem dados de contacto.</p>
                )}
              </div>

              {/* Respostas ao formulário */}
              <div className={`${GLASS} p-4`}>
                <h3 className="text-sm font-semibold">Respostas ao formulário</h3>
                {data.form && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {data.form.form_name ?? data.form.form_id}
                  </p>
                )}
                {data.field_data.length === 0 ? (
                  <p className="text-muted-foreground mt-2 text-sm">
                    Sem field_data no payload deste lead.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/30 mt-3 rounded-xl border border-border/40">
                    {data.field_data.map((fd) => {
                      const q = questionByKey.get(fd.name)
                      return (
                        <li key={fd.name} className="space-y-1 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium">{q?.label ?? fd.name}</p>
                            {q?.type && (
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                {formatQuestionType(q.type)}
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {fd.values.length === 0 ? (
                              <span>—</span>
                            ) : fd.values.length === 1 ? (
                              <span className="text-foreground">
                                {resolveAnswerValue(fd.values[0], q)}
                              </span>
                            ) : (
                              <ul className="text-foreground list-disc pl-5">
                                {fd.values.map((v, i) => (
                                  <li key={`${v}-${i}`}>{resolveAnswerValue(v, q)}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* Origem */}
              <div className={`${GLASS} space-y-2 p-4 text-sm`}>
                <h3 className="mb-1 text-sm font-semibold">Origem</h3>
                <OriginRow
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Formulário"
                  name={data.form?.form_name ?? null}
                  id={data.lead.form_id}
                />
                <OriginRow
                  icon={<Target className="h-3.5 w-3.5" />}
                  label="Campanha"
                  name={data.campaign?.name ?? null}
                  id={data.lead.campaign_id}
                />
                <OriginRow
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                  label="Anúncio"
                  name={data.ad?.name ?? null}
                  id={data.lead.ad_id}
                />
              </div>

              {/* Datas */}
              <div className={`${GLASS} space-y-1.5 p-4 text-sm`}>
                <h3 className="mb-1 text-sm font-semibold">Datas</h3>
                <p className="flex flex-wrap items-center gap-2">
                  <Clock className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">Criado no Facebook:</span>
                  <span>{fmtPt(data.lead.fb_created_time)}</span>
                  <span className="text-muted-foreground text-xs">
                    ({fmtRelative(data.lead.fb_created_time)})
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-2">
                  <Clock className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">Recebido pelo ERP:</span>
                  <span>{fmtPt(data.lead.received_at)}</span>
                  <span className="text-muted-foreground text-xs">
                    ({fmtRelative(data.lead.received_at)})
                  </span>
                </p>
                {data.lead.processed && data.lead.processed_at && (
                  <p className="flex flex-wrap items-center gap-2">
                    <CheckCircle2 className="text-muted-foreground h-4 w-4" />
                    <span className="text-muted-foreground">Processado:</span>
                    <span>{fmtPt(data.lead.processed_at)}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function OriginRow({
  icon,
  label,
  name,
  id,
}: {
  icon: React.ReactNode
  label: string
  name: string | null
  id: string | null
}) {
  return (
    <p className="flex items-center gap-2">
      {icon}
      <span className="text-muted-foreground">{label}:</span>{' '}
      {!id ? (
        <span className="text-muted-foreground/70">—</span>
      ) : name ? (
        <span className="min-w-0 truncate">{name}</span>
      ) : (
        <span className="text-muted-foreground font-mono text-xs">{id}</span>
      )}
    </p>
  )
}
