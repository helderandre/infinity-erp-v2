import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Image as ImageIcon } from 'lucide-react'

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
import { MetaStatusBadge } from '../_components/status-badge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Anúncios — Análise Meta' }

const PAGE_SIZE = 50
const BASE_PATH = '/dashboard/analise-meta/ads'

type SearchParams = Promise<{ q?: string; page?: string }>

type AdRow = {
  id: string
  ad_id: string
  campaign_id: string | null
  adset_id: string | null
  name: string | null
  status: string | null
  creative_id: string | null
  creative_name: string | null
  fb_created_time: string | null
  received_at: string
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

export default async function AdsMetaPage({
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
    .from('meta_ads_raw')
    .select(
      'id, ad_id, campaign_id, adset_id, name, status, creative_id, creative_name, fb_created_time, received_at',
      { count: 'exact' },
    )

  if (q) {
    const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(
      `name.ilike.%${safe}%,ad_id.ilike.%${safe}%,creative_name.ilike.%${safe}%`,
    )
  }

  const { data, count, error } = await query
    .order('received_at', { ascending: false })
    .range(from, to)

  if (error) {
    return (
      <div className="text-destructive text-sm">
        Erro a carregar anúncios: {error.message}
      </div>
    )
  }

  const ads = (data ?? []) as AdRow[]
  const total = count ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetaSearchInput
          action={BASE_PATH}
          defaultValue={q}
          placeholder="Pesquisar por nome, ID ou criativo…"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {total} anúncio{total === 1 ? '' : 's'}
        </p>
      </div>

      {ads.length === 0 ? (
        <MetaEmptyState entityLabel="anúncios" />
      ) : (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Anúncios sincronizados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[100px]">Estado</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Criativo
                  </TableHead>
                  <TableHead className="hidden w-[180px] lg:table-cell">
                    Campanha / Adset
                  </TableHead>
                  <TableHead className="w-[140px]">Recebido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {ad.name ?? ad.ad_id}
                        </span>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {ad.ad_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <MetaStatusBadge status={ad.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      <div className="flex items-start gap-1">
                        {(ad.creative_id || ad.creative_name) && (
                          <ImageIcon className="mt-0.5 h-3 w-3 shrink-0" />
                        )}
                        <div className="flex flex-col">
                          <span>{ad.creative_name ?? '—'}</span>
                          {ad.creative_id && (
                            <span className="font-mono text-[10px]">
                              {ad.creative_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden font-mono text-[10px] lg:table-cell">
                      <div className="flex flex-col">
                        <span>cmp: {ad.campaign_id ?? '—'}</span>
                        <span>ads: {ad.adset_id ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtRelative(ad.received_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {ads.length > 0 && (
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
