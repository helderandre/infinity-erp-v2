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

import { MetaEmptyState } from '../_components/meta-empty-state'
import { MetaSearchInput } from '../_components/search-input'
import { MetaPaginationNav } from '../_components/pagination-nav'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leads Meta — Análise Meta' }

const PAGE_SIZE = 50
const BASE_PATH = '/dashboard/analise-meta/leads'

type SearchParams = Promise<{ q?: string; page?: string }>

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
  const page = Math.max(1, Number(sp.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = createCrmAdminClient()
  let query = supabase
    .schema('meta')
    .from('meta_leads_raw')
    .select(
      'id, leadgen_id, email, full_name, phone, page_id, form_id, ad_id, campaign_id, signature_valid, received_at, fb_created_time, processed, processed_at, lead_id',
      { count: 'exact' },
    )

  if (q) {
    // OR sobre email, full_name, phone, leadgen_id
    const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(
      `email.ilike.%${safe}%,full_name.ilike.%${safe}%,phone.ilike.%${safe}%,leadgen_id.ilike.%${safe}%`,
    )
  }

  const { data, count, error } = await query
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetaSearchInput
          action={BASE_PATH}
          defaultValue={q}
          placeholder="Pesquisar por nome, email, telefone, leadgen_id…"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {total} lead{total === 1 ? '' : 's'} no total
        </p>
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
                  <TableHead className="w-[140px]">Recebido</TableHead>
                  <TableHead className="w-[110px]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 font-medium">
                          <User className="text-muted-foreground h-3.5 w-3.5" />
                          {lead.full_name ?? '—'}
                        </span>
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
                          leadgen_id: {lead.leadgen_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="text-muted-foreground">
                          form: <code>{lead.form_id ?? '—'}</code>
                        </span>
                        <span className="text-muted-foreground">
                          campanha: <code>{lead.campaign_id ?? '—'}</code>
                        </span>
                        <span className="text-muted-foreground">
                          ad: <code>{lead.ad_id ?? '—'}</code>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtRelative(lead.received_at)}
                        </span>
                        {lead.fb_created_time && (
                          <span className="text-muted-foreground text-[10px]">
                            FB: {fmtRelative(lead.fb_created_time)}
                          </span>
                        )}
                      </div>
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
