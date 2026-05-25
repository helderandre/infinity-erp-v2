import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Globe } from 'lucide-react'

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
  formatLocale,
  formatMetaStatus,
  metaStatusVariant,
} from '@/lib/meta/labels'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

import { MetaEmptyState } from '../_components/meta-empty-state'
import { MetaSearchInput } from '../_components/search-input'
import { MetaPaginationNav } from '../_components/pagination-nav'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Formulários — Análise Meta' }

const PAGE_SIZE = 50
const BASE_PATH = '/dashboard/analise-meta/formularios'

type SearchParams = Promise<{ q?: string; page?: string }>

type FormRow = {
  id: string
  form_id: string
  page_id: string | null
  form_name: string | null
  status: string | null
  locale: string | null
  fb_created_time: string | null
  received_at: string
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

export default async function FormulariosMetaPage({
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
    .from('meta_forms_raw')
    .select(
      'id, form_id, page_id, form_name, status, locale, fb_created_time, received_at',
      { count: 'exact' },
    )

  if (q) {
    const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(`form_name.ilike.%${safe}%,form_id.ilike.%${safe}%`)
  }

  const { data, count, error } = await query
    .order('received_at', { ascending: false })
    .range(from, to)

  if (error) {
    return (
      <div className="text-destructive text-sm">
        Erro a carregar formulários: {error.message}
      </div>
    )
  }

  const forms = (data ?? []) as FormRow[]
  const total = count ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetaSearchInput
          action={BASE_PATH}
          defaultValue={q}
          placeholder="Pesquisar por nome ou form_id…"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {total} formulário{total === 1 ? '' : 's'}
        </p>
      </div>

      {forms.length === 0 ? (
        <MetaEmptyState entityLabel="formulários" />
      ) : (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Formulários sincronizados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[100px]">Estado</TableHead>
                  <TableHead className="hidden w-[120px] md:table-cell">
                    Idioma
                  </TableHead>
                  <TableHead className="hidden w-[160px] lg:table-cell">
                    Page ID
                  </TableHead>
                  <TableHead className="w-[150px]">Recebido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          href={`/dashboard/analise-meta/formularios/${form.form_id}`}
                          className="font-medium hover:underline"
                        >
                          {form.form_name ?? form.form_id}
                        </Link>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {form.form_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={metaStatusVariant(form.status)} className="text-[10px]">
                        {formatMetaStatus(form.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Globe className="h-3 w-3" />
                        {formatLocale(form.locale)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                      {form.page_id ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtRelative(form.received_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {forms.length > 0 && (
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
