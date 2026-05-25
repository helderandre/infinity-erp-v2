import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Target } from 'lucide-react'

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
import {
  formatCampaignObjective,
  formatMetaBudgetCents,
  formatMetaStatus,
  metaStatusVariant,
} from '@/lib/meta/labels'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

import { MetaEmptyState } from '../_components/meta-empty-state'
import { MetaSearchInput } from '../_components/search-input'
import { MetaPaginationNav } from '../_components/pagination-nav'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Campanhas — Análise Meta' }

const PAGE_SIZE = 50
const BASE_PATH = '/dashboard/analise-meta/campanhas'

type SearchParams = Promise<{ q?: string; page?: string }>

type CampaignRow = {
  id: string
  campaign_id: string
  ad_account_id: string | null
  name: string | null
  status: string | null
  objective: string | null
  daily_budget: string | null
  lifetime_budget: string | null
  start_time: string | null
  stop_time: string | null
  fb_created_time: string | null
  received_at: string
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

export default async function CampanhasMetaPage({
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
    .from('meta_campaigns_raw')
    .select(
      'id, campaign_id, ad_account_id, name, status, objective, daily_budget, lifetime_budget, start_time, stop_time, fb_created_time, received_at',
      { count: 'exact' },
    )

  if (q) {
    const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(
      `name.ilike.%${safe}%,campaign_id.ilike.%${safe}%,objective.ilike.%${safe}%`,
    )
  }

  const { data, count, error } = await query
    .order('received_at', { ascending: false })
    .range(from, to)

  if (error) {
    return (
      <div className="text-destructive text-sm">
        Erro a carregar campanhas: {error.message}
      </div>
    )
  }

  const campaigns = (data ?? []) as CampaignRow[]
  const total = count ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetaSearchInput
          action={BASE_PATH}
          defaultValue={q}
          placeholder="Pesquisar por nome, ID ou objetivo…"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {total} campanha{total === 1 ? '' : 's'}
        </p>
      </div>

      {campaigns.length === 0 ? (
        <MetaEmptyState entityLabel="campanhas" />
      ) : (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Campanhas sincronizadas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[100px]">Estado</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Objetivo
                  </TableHead>
                  <TableHead className="hidden w-[130px] md:table-cell">
                    Orçamento
                  </TableHead>
                  <TableHead className="w-[140px]">Recebido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          href={`/dashboard/analise-meta/campanhas/${c.campaign_id}`}
                          className="flex items-center gap-1.5 font-medium hover:underline"
                        >
                          <Target className="text-muted-foreground h-3.5 w-3.5" />
                          {c.name ?? c.campaign_id}
                        </Link>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {c.campaign_id}
                          {c.ad_account_id && ` · ${c.ad_account_id}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={metaStatusVariant(c.status)} className="text-[10px]">
                        {formatMetaStatus(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-xs md:table-cell">
                      {formatCampaignObjective(c.objective)}
                    </TableCell>
                    <TableCell className="hidden text-xs tabular-nums md:table-cell">
                      <div className="flex flex-col">
                        <span>diário: {formatMetaBudgetCents(c.daily_budget)}</span>
                        <span className="text-muted-foreground">
                          total: {formatMetaBudgetCents(c.lifetime_budget)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtRelative(c.received_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {campaigns.length > 0 && (
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
