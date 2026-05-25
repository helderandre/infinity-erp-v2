import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Mail,
  Phone,
  Target,
  User,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatCampaignObjective,
  formatMetaBudgetCents,
  formatMetaStatus,
  metaStatusVariant,
} from '@/lib/meta/labels'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

import { RawPayloadCard } from '../../_components/raw-payload'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Campanha — Análise Meta' }

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

function fmtPt(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default async function CampanhaDetailPage({
  params,
}: {
  params: Promise<{ campaign_id: string }>
}) {
  const { campaign_id } = await params
  const supabase = createCrmAdminClient()

  const [campRes, adsRes, leadsCountRes, leadsRes] = await Promise.all([
    supabase
      .schema('meta')
      .from('meta_campaigns_raw')
      .select('*')
      .eq('campaign_id', campaign_id)
      .maybeSingle(),
    supabase
      .schema('meta')
      .from('meta_ads_raw')
      .select(
        'id, ad_id, name, status, adset_id, creative_id, creative_name, fb_created_time, received_at',
      )
      .eq('campaign_id', campaign_id)
      .order('received_at', { ascending: false }),
    supabase
      .schema('meta')
      .from('meta_leads_raw')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id),
    supabase
      .schema('meta')
      .from('meta_leads_raw')
      .select(
        'id, leadgen_id, email, full_name, phone, ad_id, form_id, received_at, fb_created_time, processed',
      )
      .eq('campaign_id', campaign_id)
      .order('fb_created_time', { ascending: false, nullsFirst: false })
      .order('received_at', { ascending: false })
      .limit(20),
  ])

  if (!campRes.data) notFound()

  const campaign = campRes.data
  const ads = adsRes.data ?? []
  const totalLeads = leadsCountRes.count ?? 0
  const recentLeads = leadsRes.data ?? []
  const activeAds = ads.filter((a) => a.status === 'ACTIVE').length

  // Batch lookup dos nomes form/ad referenciados pelos leads recentes
  const formIds = Array.from(
    new Set(recentLeads.map((l) => l.form_id).filter(Boolean) as string[]),
  )
  const adIds = Array.from(
    new Set(recentLeads.map((l) => l.ad_id).filter(Boolean) as string[]),
  )
  const [formsLookup, adsLookup] = await Promise.all([
    formIds.length
      ? supabase
          .schema('meta')
          .from('meta_forms_raw')
          .select('form_id, form_name')
          .in('form_id', formIds)
      : Promise.resolve({ data: [] as { form_id: string; form_name: string | null }[] }),
    adIds.length
      ? supabase
          .schema('meta')
          .from('meta_ads_raw')
          .select('ad_id, name')
          .in('ad_id', adIds)
      : Promise.resolve({ data: [] as { ad_id: string; name: string | null }[] }),
  ])
  const formNameById = new Map(
    (formsLookup.data ?? []).map((f) => [f.form_id, f.form_name]),
  )
  const adNameById = new Map(
    (adsLookup.data ?? []).map((a) => [a.ad_id, a.name]),
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard/analise-meta/campanhas">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Target className="text-muted-foreground h-5 w-5" />
          <h1 className="text-2xl font-semibold">
            {campaign.name ?? '(sem nome)'}
          </h1>
          <Badge variant={metaStatusVariant(campaign.status)} className="text-[10px]">
            {formatMetaStatus(campaign.status)}
          </Badge>
        </div>
        <p className="text-muted-foreground font-mono text-xs">
          {campaign.campaign_id}
          {campaign.ad_account_id && ` · ${campaign.ad_account_id}`}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiTile
          label="Anúncios"
          value={`${activeAds}/${ads.length}`}
          icon={<ImageIcon className="h-4 w-4" />}
          sub="activos"
        />
        <KpiTile
          label="Leads"
          value={totalLeads}
          icon={<User className="h-4 w-4" />}
        />
        <KpiTile
          label="Orçamento diário"
          value={formatMetaBudgetCents(campaign.daily_budget)}
        />
        <KpiTile
          label="Orçamento total"
          value={formatMetaBudgetCents(campaign.lifetime_budget)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row
              label="Objectivo"
              value={formatCampaignObjective(campaign.objective)}
            />
            <Row label="Ad Account" value={campaign.ad_account_id ?? '—'} />
            <Row
              label="Início programado"
              value={<span className="text-xs">{fmtPt(campaign.start_time)}</span>}
            />
            <Row
              label="Fim programado"
              value={<span className="text-xs">{fmtPt(campaign.stop_time)}</span>}
            />
            <Row
              label="Criada no Facebook"
              value={
                <span className="text-xs">
                  {fmtPt(campaign.fb_created_time)}
                </span>
              }
            />
            <Row
              label="Recebida"
              value={<span className="text-xs">{fmtPt(campaign.received_at)}</span>}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Anúncios
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              ({ads.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ads.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Nenhum anúncio sincronizado para esta campanha.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[110px]">Estado</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Criativo
                  </TableHead>
                  <TableHead className="w-[140px]">Recebido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          href={`/dashboard/analise-meta/ads/${ad.ad_id}`}
                          className="font-medium hover:underline"
                        >
                          {ad.name ?? ad.ad_id}
                        </Link>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {ad.ad_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={metaStatusVariant(ad.status)}
                        className="text-[10px]"
                      >
                        {formatMetaStatus(ad.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {ad.creative_name ?? ad.creative_id ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtRelative(ad.received_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Leads recentes
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              ({recentLeads.length} de {totalLeads})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentLeads.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Ainda não chegou nenhum lead desta campanha.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Form / Ad
                  </TableHead>
                  <TableHead className="w-[140px]">
                    <Clock className="inline h-3 w-3" /> Criado
                  </TableHead>
                  <TableHead className="w-[110px]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/dashboard/analise-meta/leads/${lead.id}`}
                          className="flex items-center gap-1.5 font-medium hover:underline"
                        >
                          <User className="text-muted-foreground h-3.5 w-3.5" />
                          {lead.full_name ?? '—'}
                        </Link>
                        {lead.email && (
                          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-xs md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <RelatedLink
                          label="Formulário"
                          id={lead.form_id}
                          name={lead.form_id ? formNameById.get(lead.form_id) ?? null : null}
                          href={lead.form_id ? `/dashboard/analise-meta/formularios/${lead.form_id}` : null}
                        />
                        <RelatedLink
                          label="Anúncio"
                          id={lead.ad_id}
                          name={lead.ad_id ? adNameById.get(lead.ad_id) ?? null : null}
                          href={lead.ad_id ? `/dashboard/analise-meta/ads/${lead.ad_id}` : null}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtRelative(lead.fb_created_time ?? lead.received_at)}
                    </TableCell>
                    <TableCell>
                      {lead.processed ? (
                        <Badge variant="default" className="gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" />
                          Processado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Por processar
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RawPayloadCard payload={campaign.payload} />
    </div>
  )
}

function KpiTile({
  label,
  value,
  icon,
  sub,
}: {
  label: string
  value: string | number
  icon?: React.ReactNode
  sub?: string
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
    </div>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  // Plain divs em vez de dt/dd — ver nota no formularios/[form_id]/page.tsx.
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </>
  )
}

/**
 * Mostra o nome humanizado da entidade com link para o detalhe. Quando o nome
 * ainda não foi sincronizado, cai para o ID em monospace small.
 */
function RelatedLink({
  label,
  id,
  name,
  href,
}: {
  label: string
  id: string | null
  name: string | null
  href: string | null
}) {
  if (!id) {
    return (
      <span className="text-muted-foreground">
        {label}: <span className="text-muted-foreground/70">—</span>
      </span>
    )
  }
  const display = name ? (
    name
  ) : (
    <span className="font-mono text-[10px]" title={id}>
      {id}
    </span>
  )
  return (
    <span className="text-muted-foreground">
      {label}:{' '}
      {href ? (
        <Link href={href} className="text-foreground hover:underline">
          {display}
        </Link>
      ) : (
        display
      )}
    </span>
  )
}
