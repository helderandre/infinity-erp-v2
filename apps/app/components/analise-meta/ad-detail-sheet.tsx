'use client'

/**
 * Glassmorphic ad-detail sheet — opened from the campaign funnel (instead of
 * navigating to the ad page). Mirrors the LeadEntrySheet design language
 * (right-side glass panel, bottom sheet on mobile).
 */

import { useEffect, useState } from 'react'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import {
  Loader2,
  Image as ImageIcon,
  Target,
  Users,
  CheckCircle2,
  FileText,
  User,
  Mail,
  Phone,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatMetaStatus, metaStatusVariant } from '@/lib/meta/labels'
import { useIsMobile } from '@/hooks/use-mobile'
import { AttributionPanel } from '@/components/analise-meta/attribution-panel'
import { FormDetailSheet } from '@/components/analise-meta/form-detail-sheet'
import { LeadDetailSheet } from '@/components/analise-meta/lead-detail-sheet'
import { CreativePreview, type CreativeRow } from '@/components/analise-meta/creative-preview'

interface Bundle {
  ad: { id: string; ad_id: string; name: string | null; status: string | null; creative_id: string | null; creative_name: string | null; campaign_id: string | null }
  campaign: { campaign_id: string; name: string | null; status: string | null } | null
  creative: CreativeRow | null
  totalLeads: number
  inCrm: number
  forms: { form_id: string; name: string | null; count: number }[]
  recentLeads: Array<{ id: string; full_name: string | null; email: string | null; phone: string | null; fb_created_time: string | null; received_at: string; processed: boolean }>
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

const GLASS = 'rounded-2xl border border-border/40 bg-card/50 backdrop-blur-xl'

export function AdDetailSheet({
  adId,
  open,
  onOpenChange,
}: {
  adId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Bundle | null>(null)
  const [openFormId, setOpenFormId] = useState<string | null>(null)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !adId) return
    let active = true
    setLoading(true)
    setData(null)
    fetch(`/api/analise-meta/ads/${adId}`)
      .then((r) => r.json())
      .then((json) => {
        if (active && !json.error) setData(json as Bundle)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, adId])

  return (
    <>
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
          <SheetTitle>Detalhe do anúncio</SheetTitle>
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
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-semibold leading-tight">{data.ad.name ?? data.ad.ad_id}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={metaStatusVariant(data.ad.status)} className="text-[10px]">
                    {formatMetaStatus(data.ad.status)}
                  </Badge>
                  {data.campaign && (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <Target className="h-3 w-3" />
                      {data.campaign.name ?? data.campaign.campaign_id}
                    </span>
                  )}
                </div>
                {data.ad.creative_name && (
                  <p className="text-muted-foreground text-xs">{data.ad.creative_name}</p>
                )}
              </div>

              {/* KPIs */}
              <div className={`${GLASS} grid grid-cols-2 divide-x divide-border/40 overflow-hidden`}>
                <div className="p-3">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase">
                    <Users className="h-3.5 w-3.5 text-sky-500" /> Leads
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">{data.totalLeads}</p>
                </div>
                <div className="p-3">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No CRM
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">{data.inCrm}</p>
                </div>
              </div>

              {/* Creative */}
              <div className={`${GLASS} p-4`}>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <ImageIcon className="h-4 w-4" /> Criativo
                </h3>
                <CreativePreview
                  creative={data.creative}
                  fallbackName={data.ad.creative_name}
                  fallbackCreativeId={data.ad.creative_id}
                  adStatus={data.ad.status}
                />
              </div>

              {/* Attribution */}
              <div className={`${GLASS} p-4`}>
                <AttributionPanel scope="ad" targetId={data.ad.ad_id} targetName={data.ad.name} bare />
              </div>

              {/* Forms */}
              <div className={`${GLASS} p-4`}>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <FileText className="h-4 w-4" /> Formulários
                </h3>
                {data.forms.length === 0 ? (
                  <p className="text-muted-foreground/60 mt-2 text-xs">Sem formulários com leads ainda.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {data.forms.map((f) => (
                      <button
                        key={f.form_id}
                        onClick={() => setOpenFormId(f.form_id)}
                        className="bg-muted/40 hover:bg-muted flex w-full items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-xs transition-colors"
                      >
                        <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate font-medium">{f.name ?? f.form_id}</span>
                        <span className="text-muted-foreground tabular-nums">{f.count} leads</span>
                        <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent leads */}
              <div className={`${GLASS} overflow-hidden`}>
                <h3 className="flex items-center gap-1.5 border-b border-border/30 px-4 py-2.5 text-sm font-semibold">
                  <Users className="h-4 w-4" /> Leads recentes
                </h3>
                {data.recentLeads.length === 0 ? (
                  <p className="text-muted-foreground/60 p-4 text-xs">Ainda não chegou nenhum lead deste anúncio.</p>
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
                            <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-2 text-[11px]">
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
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <FormDetailSheet
      formId={openFormId}
      open={!!openFormId}
      onOpenChange={(o) => !o && setOpenFormId(null)}
    />
    <LeadDetailSheet
      leadId={openLeadId}
      open={!!openLeadId}
      onOpenChange={(o) => !o && setOpenLeadId(null)}
    />
    </>
  )
}
