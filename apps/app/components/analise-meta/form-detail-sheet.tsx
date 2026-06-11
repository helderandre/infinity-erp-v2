'use client'

/**
 * Glassmorphic form-detail sheet — opened from the AdDetailSheet (nested). Tabs:
 *   1. Estatísticas — answer distribution per question (response stats)
 *   2. Leads        — recent leads from this form
 *
 * Mirrors the loja tab-pill design and the lead/ad sheet glass language.
 */

import { useEffect, useState } from 'react'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Loader2, FileText, User, Mail, Phone, Clock, BarChart3, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { formatMetaStatus, metaStatusVariant, formatQuestionType } from '@/lib/meta/labels'
import { useIsMobile } from '@/hooks/use-mobile'
import { LeadDetailSheet } from '@/components/analise-meta/lead-detail-sheet'

const GLASS = 'rounded-2xl border border-border/40 bg-card/50 backdrop-blur-xl'
const TAB_TRIGGER = cn(
  'inline-flex items-center justify-center shrink-0 gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300',
  'data-[state=active]:bg-neutral-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
  'dark:data-[state=active]:bg-white dark:data-[state=active]:text-neutral-900',
  'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-muted/50',
)

interface QuestionStat {
  key: string
  label: string
  type: string
  total: number
  choices: { label: string; count: number }[] | null
}

interface Bundle {
  form: { form_id: string; form_name: string | null; status: string | null; locale: string | null; fb_created_time: string | null }
  totalLeads: number
  statsTruncated: boolean
  stats: QuestionStat[]
  recentLeads: Array<{ id: string; full_name: string | null; email: string | null; phone: string | null; ad_id: string | null; ad_name: string | null; fb_created_time: string | null; received_at: string; processed: boolean }>
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

// Stable pastel colour per ad, for the lead's ad tag.
function adColor(seed: string): { backgroundColor: string; color: string } {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return { backgroundColor: `hsl(${h} 70% 90% / 0.6)`, color: `hsl(${h} 60% 38%)` }
}

export function FormDetailSheet({
  formId,
  open,
  onOpenChange,
}: {
  formId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Bundle | null>(null)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !formId) return
    let active = true
    setLoading(true)
    setData(null)
    fetch(`/api/analise-meta/forms/${formId}`)
      .then((r) => r.json())
      .then((json) => {
        if (active && !json.error) setData(json as Bundle)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, formId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-0 overflow-hidden border-border/40 p-0 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[88dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Detalhe do formulário</SheetTitle>
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
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="bg-muted/60 flex h-8 w-8 items-center justify-center rounded-xl">
                    <FileText className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-semibold leading-tight">
                    {data.form.form_name ?? data.form.form_id}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={metaStatusVariant(data.form.status)} className="text-[10px]">
                    {formatMetaStatus(data.form.status)}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {data.totalLeads} {data.totalLeads === 1 ? 'lead' : 'leads'}
                  </span>
                </div>
              </div>

              <Tabs defaultValue="estatisticas" className="space-y-4">
                <TabsList className="inline-flex h-auto w-fit items-center gap-1 self-start rounded-full border border-border/30 bg-muted/40 p-1 shadow-sm backdrop-blur-sm">
                  <TabsTrigger value="estatisticas" className={TAB_TRIGGER}>
                    <BarChart3 className="h-3.5 w-3.5" />
                    Estatísticas
                  </TabsTrigger>
                  <TabsTrigger value="leads" className={TAB_TRIGGER}>
                    <Users className="h-3.5 w-3.5" />
                    Leads
                  </TabsTrigger>
                </TabsList>

                {/* Estatísticas */}
                <TabsContent value="estatisticas" className="space-y-3">
                  {data.stats.length === 0 ? (
                    <div className={`${GLASS} text-muted-foreground p-6 text-center text-sm`}>
                      Sem perguntas registadas para este formulário.
                    </div>
                  ) : (
                    data.stats.map((q) => (
                      <div key={q.key} className={`${GLASS} p-4`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{q.label}</p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {formatQuestionType(q.type)}
                          </Badge>
                        </div>
                        {q.choices ? (
                          <div className="mt-3 space-y-2">
                            {q.choices.map((c) => {
                              const pct = q.total ? Math.round((c.count / q.total) * 100) : 0
                              return (
                                <div key={c.label}>
                                  <div className="mb-1 flex items-center justify-between text-xs">
                                    <span className="truncate pr-2">{c.label}</span>
                                    <span className="text-muted-foreground shrink-0 tabular-nums">
                                      {c.count} <span className="text-[10px]">({pct}%)</span>
                                    </span>
                                  </div>
                                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                                    <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-muted-foreground mt-2 text-xs">
                            {q.total} {q.total === 1 ? 'resposta' : 'respostas'} (texto livre)
                          </p>
                        )}
                      </div>
                    ))
                  )}
                  {data.statsTruncated && (
                    <p className="text-muted-foreground/70 text-[11px]">
                      Estatísticas baseadas nos primeiros 5000 leads.
                    </p>
                  )}
                </TabsContent>

                {/* Leads */}
                <TabsContent value="leads" className="space-y-2">
                  <div className="text-muted-foreground flex items-center gap-1.5 px-0.5 text-xs">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-foreground font-medium tabular-nums">{data.totalLeads}</span> leads no total
                    {data.recentLeads.length < data.totalLeads && (
                      <span>· a mostrar os {data.recentLeads.length} mais recentes</span>
                    )}
                  </div>
                  <div className={`${GLASS} overflow-hidden`}>
                    {data.recentLeads.length === 0 ? (
                      <p className="text-muted-foreground/60 p-4 text-xs">Ainda não chegou nenhum lead.</p>
                    ) : (
                      <ul className="divide-y divide-border/30">
                        {data.recentLeads.map((l) => (
                          <li key={l.id}>
                            <button
                              type="button"
                              onClick={() => setOpenLeadId(l.id)}
                              className="hover:bg-muted/40 flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors"
                            >
                              <div className="min-w-0">
                                <span className="flex items-center gap-1.5 text-sm font-medium">
                                  <User className="text-muted-foreground h-3.5 w-3.5" />
                                  {l.full_name ?? '—'}
                                </span>
                                <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                                  {l.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      <span className="max-w-[160px] truncate">{l.email}</span>
                                    </span>
                                  )}
                                  {l.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {l.phone}
                                    </span>
                                  )}
                                </div>
                                {l.ad_name && (
                                  <span
                                    className="mt-1 inline-block max-w-[180px] truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
                                    style={adColor(l.ad_id ?? l.ad_name)}
                                    title={l.ad_name}
                                  >
                                    {l.ad_name}
                                  </span>
                                )}
                              </div>
                              <span className="text-muted-foreground/70 flex shrink-0 items-center gap-1 text-[10px]">
                                <Clock className="h-3 w-3" />
                                {fmtRelative(l.fb_created_time ?? l.received_at)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </SheetContent>

      <LeadDetailSheet
        leadId={openLeadId}
        open={!!openLeadId}
        onOpenChange={(o) => !o && setOpenLeadId(null)}
      />
    </Sheet>
  )
}
