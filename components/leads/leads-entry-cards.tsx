'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Zap, ArrowRight, Sparkles, Clock, Loader2,
  CheckCircle2, XCircle, User, Mail, Phone, Globe,
  Megaphone, Calendar, UserCheck, FileText, Hash,
  ShoppingCart, Store, Key, Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', website: 'Website',
  landing_page: 'Landing Page', manual: 'Manual', voice: 'Voz',
  partner: 'Parceiro', organic: 'Orgânico', walk_in: 'Presencial',
  phone_call: 'Chamada', social_media: 'Redes Sociais', other: 'Outro',
}

const STATUS_STYLES: Record<string, { label: string; class: string; icon: typeof CheckCircle2 }> = {
  new: { label: 'Novo', class: 'bg-sky-500/10 text-sky-600', icon: Zap },
  contacted: { label: 'Contactado', class: 'bg-amber-500/10 text-amber-600', icon: Clock },
  seen: { label: 'Visto', class: 'bg-yellow-500/10 text-yellow-600', icon: Clock },
  processing: { label: 'Em Curso', class: 'bg-blue-500/10 text-blue-600', icon: ArrowRight },
  converted: { label: 'Convertido', class: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  discarded: { label: 'Descartado', class: 'bg-slate-500/10 text-slate-600', icon: XCircle },
}

const QUALIFY_OPTIONS = [
  { value: 'Compra', label: 'Compra', description: 'O cliente quer comprar um imóvel', icon: ShoppingCart, color: 'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30' },
  { value: 'Venda', label: 'Venda', description: 'O cliente quer vender um imóvel', icon: Store, color: 'hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' },
  { value: 'Arrendatário', label: 'Arrendamento (procura)', description: 'O cliente procura um imóvel para arrendar', icon: Key, color: 'hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30' },
  { value: 'Arrendador', label: 'Arrendamento (proprietário)', description: 'O cliente quer arrendar o seu imóvel', icon: Building2, color: 'hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30' },
]

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium mt-0.5">{value}</p>
      </div>
    </div>
  )
}

interface LeadsEntryCardsProps {
  entries: any[]
  loading: boolean
  contactId: string
  onQualified?: () => void
}

export function LeadsEntryCards({ entries, loading, contactId, onQualified }: LeadsEntryCardsProps) {
  const router = useRouter()
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null)
  const [qualifyEntryId, setQualifyEntryId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleQualify = async (entry: any, tipo: string) => {
    setSubmitting(true)
    try {
      const tipoToType: Record<string, string> = {
        'Compra': 'comprador',
        'Venda': 'vendedor',
        'Arrendatário': 'arrendatario',
        'Arrendador': 'arrendador',
      }
      const pipelineType = tipoToType[tipo] || 'comprador'

      const stagesRes = await fetch(`/api/crm/kanban/${pipelineType}`)
      const stagesData = await stagesRes.json()
      const pipelineStages = (stagesData.columns || []).map((c: any) => c.stage).filter((s: any) => !s.is_terminal)
      const targetStage = pipelineStages.find((s: any) => s.order_index === 1) || pipelineStages[0]

      if (!targetStage) {
        toast.error('Fase de pipeline não encontrada')
        return
      }

      const payload: Record<string, any> = {
        lead_id: contactId,
        entry_id: entry.id,
        tipo,
        pipeline_stage_id: targetStage.id,
        assigned_consultant_id: entry.assigned_consultant?.id || null,
        observacoes: entry.notes || null,
      }

      const res = await fetch('/api/crm/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao qualificar')
      }

      const negocio = await res.json()
      toast.success('Lead qualificado — negócio criado')
      setQualifyEntryId(null)
      setSelectedEntry(null)
      onQualified?.()
      router.push(`/dashboard/leads/${contactId}/negocios/${negocio.id}`)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao qualificar lead')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    )
  }

  const activeEntries = entries.filter((e) => !['converted', 'discarded'].includes(e.status))
  const pastEntries = entries.filter((e) => ['converted', 'discarded'].includes(e.status))

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
          <Zap className="h-7 w-7 text-muted-foreground/30" />
        </div>
        <p className="text-muted-foreground text-sm">Nenhum lead para este contacto</p>
      </div>
    )
  }

  const qualifyEntry = entries.find((e) => e.id === qualifyEntryId)

  return (
    <div className="space-y-3">
      {/* Active entries — compact cards */}
      {activeEntries.map((entry) => {
        const statusInfo = STATUS_STYLES[entry.status] || STATUS_STYLES.new
        return (
          <div
            key={entry.id}
            onClick={() => setSelectedEntry(entry)}
            className="flex items-center gap-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="h-10 w-10 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{entry.raw_name || 'Lead sem nome'}</p>
                <Badge className={cn('text-[9px] h-4 rounded-full gap-0.5', statusInfo.class)}>
                  <statusInfo.icon className="h-2.5 w-2.5" />
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                {entry.source && <span>{SOURCE_LABELS[entry.source] || entry.source}</span>}
                {entry.campaign?.name && <span>· {entry.campaign.name}</span>}
                <span>· {format(new Date(entry.created_at), "d MMM yyyy HH:mm", { locale: pt })}</span>
                {entry.has_referral && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 rounded-full gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" />
                    Ref.{entry.referral_pct ? ` ${entry.referral_pct}%` : ''}
                  </Badge>
                )}
              </div>
              {entry.notes && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{entry.notes}</p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        )
      })}

      {/* Past entries */}
      {pastEntries.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Anteriores</p>
          {pastEntries.map((entry) => {
            const statusInfo = STATUS_STYLES[entry.status] || STATUS_STYLES.new
            return (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="flex items-center gap-3 rounded-xl border border-border/30 bg-muted/20 p-3 opacity-60 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Badge className={cn('text-[9px] h-4 rounded-full gap-0.5', statusInfo.class)}>
                  <statusInfo.icon className="h-2.5 w-2.5" />
                  {statusInfo.label}
                </Badge>
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  {SOURCE_LABELS[entry.source] || entry.source}
                  {entry.notes ? ` — ${entry.notes}` : ''}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {format(new Date(entry.created_at), "d MMM yyyy", { locale: pt })}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Sheet — lead entry detail */}
      <Sheet open={!!selectedEntry} onOpenChange={(open) => { if (!open) setSelectedEntry(null) }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto p-0">
          {selectedEntry && (() => {
            const si = STATUS_STYLES[selectedEntry.status] || STATUS_STYLES.new
            return (
              <>
                {/* Hero header */}
                <SheetHeader className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 px-6 pt-8 pb-6 space-y-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-blue-400" />
                    <span className="text-blue-400 text-[11px] font-semibold tracking-widest uppercase">Lead</span>
                  </div>
                  <SheetTitle className="text-xl font-bold text-white tracking-tight">
                    {selectedEntry.raw_name || 'Lead sem nome'}
                  </SheetTitle>
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    <Badge className={cn('text-[10px] h-5 rounded-full gap-1', si.class)}>
                      <si.icon className="h-3 w-3" />
                      {si.label}
                    </Badge>
                    {selectedEntry.source && (
                      <Badge variant="outline" className="text-[10px] h-5 rounded-full text-white/70 border-white/20">
                        {SOURCE_LABELS[selectedEntry.source] || selectedEntry.source}
                      </Badge>
                    )}
                    {selectedEntry.campaign?.name && (
                      <Badge variant="outline" className="text-[10px] h-5 rounded-full text-white/70 border-white/20 gap-1">
                        <Megaphone className="h-2.5 w-2.5" />
                        {selectedEntry.campaign.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-2">
                    {format(new Date(selectedEntry.created_at), "d 'de' MMMM yyyy 'às' HH:mm", { locale: pt })}
                  </p>
                </SheetHeader>

                <div className="px-6 py-6 space-y-5">
                  {/* Qualify button */}
                  {!['converted', 'discarded'].includes(selectedEntry.status) && (
                    <Button
                      size="lg"
                      className="w-full rounded-xl font-semibold gap-2 h-12 text-base"
                      onClick={() => setQualifyEntryId(selectedEntry.id)}
                    >
                      <ArrowRight className="h-5 w-5" />
                      Qualificar Lead
                    </Button>
                  )}

                  {/* Contact info */}
                  {(selectedEntry.raw_name || selectedEntry.raw_email || selectedEntry.raw_phone) && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contacto</p>
                      <div className="space-y-3">
                        {selectedEntry.raw_email && (
                          <a href={`mailto:${selectedEntry.raw_email}`} className="flex items-center gap-3 text-sm hover:text-primary transition-colors">
                            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span>{selectedEntry.raw_email}</span>
                          </a>
                        )}
                        {selectedEntry.raw_phone && (
                          <a href={`tel:${selectedEntry.raw_phone}`} className="flex items-center gap-3 text-sm hover:text-primary transition-colors">
                            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span>{selectedEntry.raw_phone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedEntry.notes && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notas</p>
                      <div className="rounded-xl bg-muted/30 p-4">
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{selectedEntry.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Form data */}
                  {selectedEntry.form_data && Object.keys(selectedEntry.form_data).length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados do Formulário</p>
                      <div className="rounded-xl bg-muted/30 p-4 space-y-2">
                        {Object.entries(selectedEntry.form_data).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="font-medium">{String(value ?? '—')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Referral */}
                  {selectedEntry.has_referral && (
                    <div>
                      <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-2">Referência</p>
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
                        {selectedEntry.referral_pct && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Percentagem</span>
                            <span className="font-bold text-amber-700 dark:text-amber-400">{selectedEntry.referral_pct}%</span>
                          </div>
                        )}
                        {selectedEntry.referral_consultant?.commercial_name && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Consultor</span>
                            <span className="font-medium">{selectedEntry.referral_consultant.commercial_name}</span>
                          </div>
                        )}
                        {selectedEntry.referral_external_name && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Nome</span>
                            <span className="font-medium">{selectedEntry.referral_external_name}</span>
                          </div>
                        )}
                        {selectedEntry.referral_external_phone && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Contacto</span>
                            <span className="font-medium">{selectedEntry.referral_external_phone}</span>
                          </div>
                        )}
                        {selectedEntry.referral_external_email && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Email</span>
                            <span className="font-medium">{selectedEntry.referral_external_email}</span>
                          </div>
                        )}
                        {selectedEntry.referral_external_agency && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Agência</span>
                            <span className="font-medium">{selectedEntry.referral_external_agency}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Origin + Attribution in a clean 2-row layout */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-muted/30 p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Origem</p>
                      <p className="text-sm font-medium">{SOURCE_LABELS[selectedEntry.source] || selectedEntry.source}</p>
                      {selectedEntry.campaign?.name && (
                        <p className="text-xs text-muted-foreground mt-1">{selectedEntry.campaign.name}</p>
                      )}
                    </div>
                    <div className="rounded-xl bg-muted/30 p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Consultor</p>
                      <p className="text-sm font-medium">{selectedEntry.assigned_consultant?.commercial_name || 'Não atribuído'}</p>
                    </div>
                  </div>

                  {/* Campaign */}
                  {selectedEntry.campaign && (
                    <div className="rounded-xl bg-muted/30 p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Campanha</p>
                      <p className="text-sm font-medium">{selectedEntry.campaign.name}</p>
                      {selectedEntry.campaign.platform && (
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{selectedEntry.campaign.platform}</p>
                      )}
                      {selectedEntry.campaign.description && (
                        <p className="text-xs text-muted-foreground mt-1">{selectedEntry.campaign.description}</p>
                      )}
                    </div>
                  )}

                  {/* UTM */}
                  {(selectedEntry.utm_source || selectedEntry.utm_medium || selectedEntry.utm_campaign) && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">UTM</p>
                      <div className="rounded-xl bg-muted/30 p-4 space-y-1 text-sm">
                        {selectedEntry.utm_source && <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="font-medium">{selectedEntry.utm_source}</span></div>}
                        {selectedEntry.utm_medium && <div className="flex justify-between"><span className="text-muted-foreground">Medium</span><span className="font-medium">{selectedEntry.utm_medium}</span></div>}
                        {selectedEntry.utm_campaign && <div className="flex justify-between"><span className="text-muted-foreground">Campaign</span><span className="font-medium">{selectedEntry.utm_campaign}</span></div>}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* Qualify dialog — pick the type */}
      <Dialog open={!!qualifyEntryId} onOpenChange={(open) => { if (!open) setQualifyEntryId(null) }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Que tipo de negócio é?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2">
            {QUALIFY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                disabled={submitting}
                onClick={() => qualifyEntry && handleQualify(qualifyEntry, opt.value)}
                className={cn(
                  'flex items-center gap-4 rounded-xl border border-border/50 p-4 text-left transition-all',
                  opt.color,
                  submitting && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                  <opt.icon className="h-5 w-5 text-foreground/70" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
          {submitting && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A criar negócio...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
