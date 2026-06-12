'use client'

/**
 * Inbox de leads Meta — sub-tab Leads em CRM → Análise → Meta. Lista limpa dos
 * leads recebidos (pesquisa + paginação), alimentada por GET /api/analise-meta/
 * leads. O detalhe abre num <LeadDetailSheet> inline.
 *
 * É uma vista de leitura para gestão de leads: NÃO mostra estado de atribuição
 * nem acções de atribuir/reatribuir — isso é gerido nas regras de atribuição.
 *
 * Scope: gestão vê todos os leads; um consultor vê apenas os leads das
 * campanhas/anúncios atribuídos a si (enforced server-side, mode='mine').
 */

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Clock, Loader2, Mail, Phone, Search, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useDebounce } from '@/hooks/use-debounce'
import { LeadDetailSheet } from '@/components/analise-meta/lead-detail-sheet'

const PAGE_SIZE = 50

type LeadRow = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  campaign_id: string | null
  received_at: string
  fb_created_time: string | null
  campaign_name: string | null
  ad_name: string | null
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

export function MetaLeadsInboxView({
  from,
  to,
  consultantId,
}: {
  from?: string
  to?: string
  consultantId?: string | null
} = {}) {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [mode, setMode] = useState<'all' | 'mine'>('all')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [page, setPage] = useState(1)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)

  // (Filter changes remount this view via a `key` in the parent, so page resets
  // to 1 automatically — no separate reset effect needed.)
  useEffect(() => {
    let active = true
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim())
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (consultantId) params.set('consultant_id', consultantId)
    fetch(`/api/analise-meta/leads?${params}`)
      .then(async (r) => {
        if (r.status === 403) {
          if (active) setForbidden(true)
          return null
        }
        return r.json()
      })
      .then((j) => {
        if (!active || !j) return
        setLeads(j.leads ?? [])
        setTotal(j.total ?? 0)
        setMode(j.mode === 'mine' ? 'mine' : 'all')
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [debouncedQuery, page, from, to, consultantId])

  if (forbidden) {
    return (
      <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
        A inbox de leads Meta está disponível apenas para gestão.
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Pesquisar por nome, email, telefone…"
            className="pl-9"
          />
        </div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {total} lead{total === 1 ? '' : 's'}
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar leads…
        </div>
      ) : leads.length === 0 ? (
        <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
          {debouncedQuery.trim()
            ? 'Nenhum lead corresponde à pesquisa.'
            : mode === 'mine'
              ? 'Ainda não tens leads Meta — os leads das campanhas atribuídas a ti aparecem aqui.'
              : 'Ainda não há leads Meta sincronizados.'}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="hidden md:table-cell">Campanha</TableHead>
                  <TableHead className="w-[150px]">Criado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => setOpenLeadId(lead.id)}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 font-medium">
                          <User className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                          {lead.full_name ?? '—'}
                        </span>
                        {lead.email && (
                          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{lead.email}</span>
                          </span>
                        )}
                        {lead.phone && (
                          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3 shrink-0" />
                            {lead.phone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {lead.campaign_name ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{lead.campaign_name}</span>
                          {lead.ad_name && (
                            <span className="text-muted-foreground text-xs">{lead.ad_name}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/70 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        {fmtRelative(lead.fb_created_time ?? lead.received_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Seguinte
          </Button>
        </div>
      )}

      <LeadDetailSheet
        leadId={openLeadId}
        open={!!openLeadId}
        onOpenChange={(o) => !o && setOpenLeadId(null)}
      />
    </div>
  )
}
