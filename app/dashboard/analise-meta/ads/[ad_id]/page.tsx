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
  CardDescription,
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
import { formatMetaStatus, metaStatusVariant } from '@/lib/meta/labels'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

import { RawPayloadCard } from '../../_components/raw-payload'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Anúncio — Análise Meta' }

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

export default async function AdDetailPage({
  params,
}: {
  params: Promise<{ ad_id: string }>
}) {
  const { ad_id } = await params
  const supabase = createCrmAdminClient()

  const adRes = await supabase
    .schema('meta')
    .from('meta_ads_raw')
    .select('*')
    .eq('ad_id', ad_id)
    .maybeSingle()

  if (!adRes.data) notFound()

  const ad = adRes.data

  // Segundo round (depende do ad para descobrir campaign_id)
  const [campRes, leadsCountRes, leadsRes] = await Promise.all([
    ad.campaign_id
      ? supabase
          .schema('meta')
          .from('meta_campaigns_raw')
          .select('campaign_id, name, status, objective')
          .eq('campaign_id', ad.campaign_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .schema('meta')
      .from('meta_leads_raw')
      .select('id', { count: 'exact', head: true })
      .eq('ad_id', ad_id),
    supabase
      .schema('meta')
      .from('meta_leads_raw')
      .select(
        'id, leadgen_id, email, full_name, phone, form_id, received_at, fb_created_time, processed',
      )
      .eq('ad_id', ad_id)
      .order('fb_created_time', { ascending: false, nullsFirst: false })
      .order('received_at', { ascending: false })
      .limit(20),
  ])

  const parentCampaign = campRes.data
  const totalLeads = leadsCountRes.count ?? 0
  const recentLeads = leadsRes.data ?? []

  // Batch lookup dos nomes dos formulários referenciados pelos leads recentes
  const formIds = Array.from(
    new Set(recentLeads.map((l) => l.form_id).filter(Boolean) as string[]),
  )
  const formsLookup = formIds.length
    ? await supabase
        .schema('meta')
        .from('meta_forms_raw')
        .select('form_id, form_name')
        .in('form_id', formIds)
    : { data: [] as { form_id: string; form_name: string | null }[] }
  const formNameById = new Map(
    (formsLookup.data ?? []).map((f) => [f.form_id, f.form_name]),
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard/analise-meta/ads">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <ImageIcon className="text-muted-foreground h-5 w-5" />
          <h1 className="text-2xl font-semibold">{ad.name ?? '(sem nome)'}</h1>
          <Badge variant={metaStatusVariant(ad.status)} className="text-[10px]">
            {formatMetaStatus(ad.status)}
          </Badge>
        </div>
        <p className="text-muted-foreground font-mono text-xs">{ad.ad_id}</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile
          label="Leads"
          value={totalLeads}
          icon={<User className="h-4 w-4" />}
        />
        <KpiTile
          label="Criado"
          value={fmtRelative(ad.fb_created_time)}
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiTile
          label="Recebido"
          value={fmtRelative(ad.received_at)}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Parent campaign */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campanha pai</CardTitle>
          <CardDescription>
            A que campanha + adset este anúncio pertence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parentCampaign ? (
            <div className="bg-muted/30 flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/analise-meta/campanhas/${parentCampaign.campaign_id}`}
                  className="flex items-center gap-1.5 font-medium hover:underline"
                >
                  <Target className="text-muted-foreground h-3.5 w-3.5" />
                  {parentCampaign.name ?? parentCampaign.campaign_id}
                </Link>
                <p className="text-muted-foreground font-mono text-[10px]">
                  {parentCampaign.campaign_id}
                </p>
              </div>
              <Badge
                variant={metaStatusVariant(parentCampaign.status)}
                className="text-[10px]"
              >
                {formatMetaStatus(parentCampaign.status)}
              </Badge>
            </div>
          ) : ad.campaign_id ? (
            <p className="text-muted-foreground text-sm">
              Campanha referenciada (<code>{ad.campaign_id}</code>) ainda não foi
              sincronizada. Provavelmente vem num próximo evento.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Este anúncio não está associado a nenhuma campanha.
            </p>
          )}

          {ad.adset_id && (
            <p className="text-muted-foreground mt-3 text-xs">
              Adset:{' '}
              <code className="text-foreground font-mono text-[10px]">
                {ad.adset_id}
              </code>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Creative */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criativo</CardTitle>
        </CardHeader>
        <CardContent>
          {ad.creative_id || ad.creative_name ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Row label="Nome" value={ad.creative_name ?? '—'} />
              <Row
                label="ID"
                value={<code className="text-xs">{ad.creative_id ?? '—'}</code>}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sem detalhes de criativo no payload. Refaz o sync deste anúncio
              para puxar a info actualizada.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row
              label="Criado no Facebook"
              value={<span className="text-xs">{fmtPt(ad.fb_created_time)}</span>}
            />
            <Row
              label="Recebido"
              value={<span className="text-xs">{fmtPt(ad.received_at)}</span>}
            />
            <Row
              label="Assinatura"
              value={
                ad.signature_valid ? (
                  <Badge variant="default" className="text-[10px]">
                    Válida
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">
                    Inválida
                  </Badge>
                )
              }
            />
          </div>
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
              Ainda não chegou nenhum lead deste anúncio.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Formulário
                  </TableHead>
                  <TableHead className="w-[140px]">Criado</TableHead>
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
                      {lead.form_id ? (
                        <Link
                          href={`/dashboard/analise-meta/formularios/${lead.form_id}`}
                          className="text-foreground hover:underline"
                        >
                          {formNameById.get(lead.form_id) ?? (
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {lead.form_id}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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

      <RawPayloadCard payload={ad.payload} />
    </div>
  )
}

function KpiTile({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
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
