'use client'

/**
 * Inbox de leads Meta — sub-tab Leads em CRM → Análise → Meta. Pesquisa,
 * filtro "Por atribuir", paginação e atribuição manual, alimentada por
 * GET /api/analise-meta/leads. Totalmente auto-contida: o detalhe do lead
 * abre num <LeadDetailSheet> inline (a secção standalone /dashboard/analise-meta
 * está em vias de ser removida — não linkar para lá).
 *
 * Scope: gestão vê todos os leads; um consultor vê apenas os leads das
 * campanhas/anúncios atribuídos a si (enforced server-side, mode='mine').
 */

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  CheckCircle2, Clock, Loader2, Mail, Phone, Search, User,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { AssignLeadButton } from '@/components/analise-meta/assign-lead-button'
import { LeadDetailSheet } from '@/components/analise-meta/lead-detail-sheet'

const PAGE_SIZE = 50

type LeadRow = {
  id: string
  leadgen_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  form_id: string | null
  ad_id: string | null
  campaign_id: string | null
  signature_valid: boolean
  received_at: string
  fb_created_time: string | null
  processed: boolean
  lead_id: string | null
  form_name: string | null
  campaign_name: string | null
  ad_name: string | null
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { locale: pt, addSuffix: true })
}

export function MetaLeadsInboxView() {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [total, setTotal] = useState(0)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [mode, setMode] = useState<'all' | 'mine'>('all')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [onlyUnattributed, setOnlyUnattributed] = useState(false)
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim())
    if (onlyUnattributed) params.set('status', 'por_atribuir')
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
        setCanManage(j.can_manage === true)
        setMode(j.mode === 'mine' ? 'mine' : 'all')
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [debouncedQuery, onlyUnattributed, page, reloadKey])

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
          {total} lead{total === 1 ? '' : 's'} {onlyUnattributed ? 'por atribuir' : 'no total'}
        </p>
      </div>

      {/* Quick filters */}
      <div className="flex items-center gap-2">
        {([
          { active: !onlyUnattributed, label: 'Todos', value: false },
          { active: onlyUnattributed, label: 'Por atribuir', value: true },
        ] as const).map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => {
              setOnlyUnattributed(f.value)
              setPage(1)
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              f.active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
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
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Leads recebidos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="hidden md:table-cell">Formulário / Campanha</TableHead>
                  <TableHead className="w-[140px]">Criado</TableHead>
                  <TableHead className="w-[110px]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => setOpenLeadId(lead.id)}
                          className="flex items-center gap-1.5 text-left font-medium hover:underline"
                        >
                          <User className="text-muted-foreground h-3.5 w-3.5" />
                          {lead.full_name ?? '—'}
                        </button>
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
                        <RelatedInfo label="Formulário" id={lead.form_id} name={lead.form_name} />
                        <RelatedInfo label="Campanha" id={lead.campaign_id} name={lead.campaign_name} />
                        <RelatedInfo label="Anúncio" id={lead.ad_id} name={lead.ad_name} />
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
                          <Badge variant="default" className="gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Processado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Por processar
                          </Badge>
                        )}
                        {!lead.signature_valid && (
                          <Badge variant="destructive" className="text-[10px]">
                            Assinatura inválida
                          </Badge>
                        )}
                        {lead.lead_id && (
                          <Badge variant="secondary" className="text-[10px]">
                            Associado
                          </Badge>
                        )}
                        {!lead.processed && canManage && (
                          <AssignLeadButton
                            leadId={lead.id}
                            leadName={lead.full_name}
                            onAssigned={() => setReloadKey((k) => k + 1)}
                          />
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

function RelatedInfo({
  label,
  id,
  name,
}: {
  label: string
  id: string | null
  name: string | null
}) {
  if (!id) {
    return (
      <span className="text-muted-foreground">
        {label}: <span className="text-muted-foreground/70">—</span>
      </span>
    )
  }

  return (
    <span className="text-muted-foreground">
      {label}:{' '}
      {name ? (
        <span className="text-foreground">{name}</span>
      ) : (
        <span className="font-mono text-[10px]" title={id}>
          {id}
        </span>
      )}
    </span>
  )
}
