'use client'

/**
 * "Campanhas" sub-tab no detalhe do imóvel (dentro de Interessados).
 *
 * Mostra as campanhas/anúncios Meta associados a este imóvel (via
 * leads_assignment_rules.property_id) e os leads que geraram. Alimentado por
 * GET /api/properties/[id]/campaigns. Contactos vêm redacted para gestão que
 * não é dona da entry (a API trata disso).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Loader2, Megaphone, Facebook, User, Phone, Mail, Clock, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

import { cn } from '@/lib/utils'

interface Campaign {
  rule_id: string
  name: string
  scope: 'campaign' | 'ad'
  meta_id: string | null
  consultant_id: string | null
  consultant_name: string | null
  is_active: boolean
  lead_count: number
}

interface CampaignLead {
  id: string
  source: string
  status: string
  created_at: string
  campaign_meta_id: string | null
  ad_meta_id: string | null
  contact: { id: string; nome: string | null; telemovel: string | null; email: string | null } | null
}

interface CampaignsPayload {
  campaigns: Campaign[]
  stats: { total: number; by_status: Record<string, number> }
  leads: CampaignLead[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: 'bg-sky-500/15 text-sky-700' },
  seen: { label: 'Visto', color: 'bg-yellow-500/15 text-yellow-700' },
  processing: { label: 'Em curso', color: 'bg-blue-500/15 text-blue-700' },
  converted: { label: 'Qualificado', color: 'bg-emerald-500/15 text-emerald-700' },
  discarded: { label: 'Descartado', color: 'bg-slate-500/15 text-slate-600' },
}

// Strip the "[Meta] " label prefix the attribution rule stores.
function cleanName(name: string): string {
  return name.replace(/^\[Meta\]\s*/, '')
}

export function PropertyCampaignsTab({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<CampaignsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  // Return URL para o "Voltar" da página de detalhe da campanha/anúncio cair
  // de volta aqui (imóvel → Interessados → Campanhas), e não na listagem Meta.
  const pathname = usePathname()
  const returnUrl = `${pathname}?tab=interessados&sub=campanhas`

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/properties/${propertyId}/campaigns`)
      .then((r) => r.json())
      .then((j) => {
        if (active) setData(j && Array.isArray(j.campaigns) ? j : { campaigns: [], stats: { total: 0, by_status: {} }, leads: [] })
      })
      .catch(() => {
        if (active) setData({ campaigns: [], stats: { total: 0, by_status: {} }, leads: [] })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [propertyId])

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 justify-center text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar campanhas…
      </div>
    )
  }

  if (!data || data.campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Megaphone className="text-muted-foreground/40 h-10 w-10" />
        <p className="text-sm font-medium">Nenhuma campanha associada</p>
        <p className="text-muted-foreground max-w-sm text-xs">
          Associa uma campanha Meta a este imóvel em Análise Meta → campanha → &quot;Imóvel associado&quot;.
          Os leads dessa campanha passam a aparecer aqui.
        </p>
      </div>
    )
  }

  const { campaigns, stats, leads } = data

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        <StatChip label="Total de leads" value={stats.total} highlight />
        {Object.entries(STATUS_META).map(([key, meta]) =>
          stats.by_status[key] ? (
            <StatChip key={key} label={meta.label} value={stats.by_status[key]} className={meta.color} />
          ) : null,
        )}
      </div>

      {/* Campaigns */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
          Campanhas associadas ({campaigns.length})
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {campaigns.map((c) => {
            const base = c.meta_id
              ? c.scope === 'ad'
                ? `/dashboard/analise-meta/ads/${c.meta_id}`
                : `/dashboard/analise-meta/campanhas/${c.meta_id}`
              : null
            const href = base ? `${base}?from=${encodeURIComponent(returnUrl)}` : null
            const card = (
              <>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Facebook className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                    <span className="truncate text-sm font-medium">{cleanName(c.name)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-medium">
                      {c.scope === 'ad' ? 'Anúncio' : 'Campanha'}
                    </span>
                    {c.consultant_name && (
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {c.consultant_name}
                      </span>
                    )}
                    {!c.is_active && <span className="text-amber-600">inactiva</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="text-lg font-semibold leading-none tabular-nums">{c.lead_count}</div>
                    <div className="text-muted-foreground text-[10px]">leads</div>
                  </div>
                  {href && <ChevronRight className="text-muted-foreground/50 h-4 w-4 shrink-0" />}
                </div>
              </>
            )
            return href ? (
              <Link
                key={c.rule_id}
                href={href}
                className="bg-card hover:bg-muted/40 hover:border-primary/30 flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors"
              >
                {card}
              </Link>
            ) : (
              <div key={c.rule_id} className="bg-card flex items-start justify-between gap-3 rounded-xl border p-3">
                {card}
              </div>
            )
          })}
        </div>
      </div>

      {/* Leads */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
          Leads gerados ({leads.length})
        </p>
        {leads.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs italic">Ainda sem leads destas campanhas.</p>
        ) : (
          <div className="divide-border/50 overflow-hidden rounded-xl border divide-y">
            {leads.map((l) => (
              <LeadRow key={l.id} lead={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatChip({
  label,
  value,
  highlight,
  className,
}: {
  label: string
  value: number
  highlight?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        highlight ? 'bg-primary/5 border-primary/20' : 'bg-card',
        className,
      )}
    >
      <div className="text-lg font-semibold leading-none tabular-nums">{value}</div>
      <div className="text-muted-foreground mt-0.5 text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  )
}

function LeadRow({ lead }: { lead: CampaignLead }) {
  const meta = STATUS_META[lead.status] ?? { label: lead.status, color: 'bg-muted text-muted-foreground' }
  const name = lead.contact?.nome ?? 'Lead reservado'
  const hasContactLink = !!lead.contact?.id && !!lead.contact?.telemovel // redacted rows have null phone

  const inner = (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <span className="block truncate text-sm font-medium">{name}</span>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
          {lead.contact?.telemovel && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {lead.contact.telemovel}
            </span>
          )}
          {lead.contact?.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="truncate">{lead.contact.email}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(lead.created_at), { locale: pt, addSuffix: true })}
          </span>
        </div>
      </div>
      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', meta.color)}>
        {meta.label}
      </span>
    </div>
  )

  if (hasContactLink) {
    return (
      <Link href={`/dashboard/leads/${lead.contact!.id}`} className="hover:bg-muted/40 block transition-colors">
        {inner}
      </Link>
    )
  }
  return <div>{inner}</div>
}
