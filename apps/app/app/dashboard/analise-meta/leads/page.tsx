import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Mail, Phone, User, CheckCircle2, Clock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { createClient } from '@/lib/supabase/server'
import { canManageAttribution } from '@/lib/analise-meta/can-manage-attribution'
import { cn } from '@/lib/utils'

import { MetaEmptyState } from '../_components/meta-empty-state'
import { MetaSearchInput } from '../_components/search-input'
import { MetaPaginationNav } from '../_components/pagination-nav'
import { AssignLeadButton } from '@/components/analise-meta/assign-lead-button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leads Meta — Análise Meta' }

const PAGE_SIZE = 50
const BASE_PATH = '/dashboard/analise-meta/leads'

type SearchParams = Promise<{ q?: string; page?: string; status?: string }>

type LeadRow = {
  id: string
  leadgen_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  page_id: string | null
  form_id: string | null
  ad_id: string | null
  campaign_id: string | null
  signature_valid: boolean
  received_at: string
  fb_created_time: string | null
  processed: boolean
  processed_at: string | null
  lead_id: string | null
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

export default async function LeadsMetaPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ''
  const onlyUnattributed = sp.status === 'por_atribuir'
  const page = Math.max(1, Number(sp.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = createCrmAdminClient()

  // Who can assign leads manually from the inbox.
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  const canManage = user ? await canManageAttribution(supabase, user.id) : false

  let query = supabase
    .schema('meta')
    .from('meta_leads_raw')
    .select(
      'id, leadgen_id, email, full_name, phone, page_id, form_id, ad_id, campaign_id, signature_valid, received_at, fb_created_time, processed, processed_at, lead_id',
      { count: 'exact' },
    )

  // "Por atribuir" = ainda não entrou no CRM (sem regra que o atribuísse).
  if (onlyUnattributed) {
    query = query.eq('processed', false)
  }

  if (q) {
    // OR sobre email, full_name, phone, leadgen_id
    const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(
      `email.ilike.%${safe}%,full_name.ilike.%${safe}%,phone.ilike.%${safe}%,leadgen_id.ilike.%${safe}%`,
    )
  }

  // Ordena pela data real do lead no Facebook (mais útil que received_at, que
  // colapsa para "agora" sempre que há backfill/replay). NULLS LAST + tiebreaker
  // em received_at para registos pré-backfill sem fb_created_time.
  const { data, count, error } = await query
    .order('fb_created_time', { ascending: false, nullsFirst: false })
    .order('received_at', { ascending: false })
    .range(from, to)

  if (error) {
    return (
      <div className="text-destructive text-sm">
        Erro a carregar leads: {error.message}
      </div>
    )
  }

  const leads = (data ?? []) as LeadRow[]
  const total = count ?? 0

  // Batch lookup: nomes de form/campanha/ad para evitar mostrar IDs crus.
  // O custo é 3 queries pequenas in:[ids] — paralelizadas. Páginas com 0
  // skip total pois os arrays ficam vazios.
  const formIds = Array.from(
    new Set(leads.map((l) => l.form_id).filter(Boolean) as string[]),
  )
  const campaignIds = Array.from(
    new Set(leads.map((l) => l.campaign_id).filter(Boolean) as string[]),
  )
  const adIds = Array.from(
    new Set(leads.map((l) => l.ad_id).filter(Boolean) as string[]),
  )

  const [formsRes, campaignsRes, adsRes] = await Promise.all([
    formIds.length
      ? supabase
          .schema('meta')
          .from('meta_forms_raw')
          .select('form_id, form_name')
          .in('form_id', formIds)
      : Promise.resolve({ data: [] as { form_id: string; form_name: string | null }[] }),
    campaignIds.length
      ? supabase
          .schema('meta')
          .from('meta_campaigns_raw')
          .select('campaign_id, name')
          .in('campaign_id', campaignIds)
      : Promise.resolve({ data: [] as { campaign_id: string; name: string | null }[] }),
    adIds.length
      ? supabase
          .schema('meta')
          .from('meta_ads_raw')
          .select('ad_id, name')
          .in('ad_id', adIds)
      : Promise.resolve({ data: [] as { ad_id: string; name: string | null }[] }),
  ])

  const formNameById = new Map(
    (formsRes.data ?? []).map((f) => [f.form_id, f.form_name]),
  )
  const campaignNameById = new Map(
    (campaignsRes.data ?? []).map((c) => [c.campaign_id, c.name]),
  )
  const adNameById = new Map(
    (adsRes.data ?? []).map((a) => [a.ad_id, a.name]),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetaSearchInput
          action={BASE_PATH}
          defaultValue={q}
          placeholder="Pesquisar por nome, email, telefone, leadgen_id…"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {total} lead{total === 1 ? '' : 's'} {onlyUnattributed ? 'por atribuir' : 'no total'}
        </p>
      </div>

      {/* Quick filters */}
      <div className="flex items-center gap-2">
        <FilterChip href={BASE_PATH} active={!onlyUnattributed} label="Todos" />
        <FilterChip
          href={`${BASE_PATH}?status=por_atribuir`}
          active={onlyUnattributed}
          label="Por atribuir"
        />
      </div>

      {leads.length === 0 ? (
        <MetaEmptyState entityLabel="leads" />
      ) : (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Leads recebidos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Formulário / Campanha
                  </TableHead>
                  <TableHead className="w-[140px]">Criado</TableHead>
                  <TableHead className="w-[110px]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
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
                        <span className="text-muted-foreground font-mono text-[10px]">
                          ID Facebook: {lead.leadgen_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <RelatedLink
                          label="Formulário"
                          id={lead.form_id}
                          name={lead.form_id ? formNameById.get(lead.form_id) ?? null : null}
                          href={lead.form_id ? `/dashboard/analise-meta/formularios/${lead.form_id}` : null}
                        />
                        <RelatedLink
                          label="Campanha"
                          id={lead.campaign_id}
                          name={lead.campaign_id ? campaignNameById.get(lead.campaign_id) ?? null : null}
                          href={lead.campaign_id ? `/dashboard/analise-meta/campanhas/${lead.campaign_id}` : null}
                        />
                        <RelatedLink
                          label="Anúncio"
                          id={lead.ad_id}
                          name={lead.ad_id ? adNameById.get(lead.ad_id) ?? null : null}
                          href={lead.ad_id ? `/dashboard/analise-meta/ads/${lead.ad_id}` : null}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        {fmtRelative(lead.fb_created_time ?? lead.received_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {lead.processed ? (
                          <Badge
                            variant="default"
                            className="gap-1 text-[10px]"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Processado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Por processar
                          </Badge>
                        )}
                        {!lead.signature_valid && (
                          <Badge
                            variant="destructive"
                            className="text-[10px]"
                          >
                            Assinatura inválida
                          </Badge>
                        )}
                        {lead.lead_id && (
                          <Badge variant="secondary" className="text-[10px]">
                            Associado
                          </Badge>
                        )}
                        {!lead.processed && canManage && (
                          <AssignLeadButton leadId={lead.id} leadName={lead.full_name} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {leads.length > 0 && (
        <MetaPaginationNav
          basePath={BASE_PATH}
          searchParams={{ q }}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      )}
    </div>
  )
}

/**
 * Mostra o nome humanizado da entidade (Formulário/Campanha/Anúncio) com link
 * para o respectivo detalhe. Quando o nome ainda não foi sincronizado (ex.: ad
 * recente), cai para o ID em monospace small como pista de debug. Quando não
 * existe sequer um ID associado ao lead, mostra "—".
 */
function FilterChip({
  href,
  active,
  label,
}: {
  href: string
  active: boolean
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </Link>
  )
}

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
