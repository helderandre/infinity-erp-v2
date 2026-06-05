'use client'

/**
 * "Por atribuir" tab inside Gestão de Leads — raw Meta leads that arrived
 * without an attribution rule and haven't entered the CRM yet
 * (meta.meta_leads_raw, processed=false). Replaces the old standalone
 * /dashboard/analise-meta/leads?status=por_atribuir page.
 *
 * Lists the leads with search + per-row "Atribuir", plus multi-select →
 * bulk "Atribuir a…" (same UX as the reassign bar on the other gestora tabs):
 * tick several leads and assign them all to one consultor in one go.
 */

import { useCallback, useEffect, useState } from 'react'
import { Mail, Phone, User, Clock, Inbox, Search, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { AssignLeadButton } from '@/components/analise-meta/assign-lead-button'

interface HydratedLead {
  id: string
  leadgen_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  form_name: string | null
  campaign_name: string | null
  ad_name: string | null
  signature_valid: boolean
  lead_id: string | null
  fb_created_time: string | null
  received_at: string
}

interface Consultant {
  id: string
  commercial_name: string | null
}

interface Props {
  /** Called after an assign so the parent can refresh the tab count badge. */
  onChanged?: () => void
}

export function GestoraPorAtribuirTab({ onChanged }: Props) {
  const [rows, setRows] = useState<HydratedLead[]>([])
  const [total, setTotal] = useState(0)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  // Multi-select → bulk assign.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [target, setTarget] = useState('')
  const [assigning, setAssigning] = useState(false)

  const fetchData = useCallback(async (search: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      const res = await fetch(`/api/analise-meta/unattributed-leads?${params}`)
      const json = await res.json()
      setRows(Array.isArray(json.data) ? json.data : [])
      setTotal(typeof json.total === 'number' ? json.total : 0)
      setCanManage(!!json.can_manage)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search; immediate on first load / clear.
  useEffect(() => {
    const t = setTimeout(() => fetchData(q), q ? 300 : 0)
    return () => clearTimeout(t)
  }, [q, fetchData])

  // Load the consultor list once we know the user can assign.
  useEffect(() => {
    if (!canManage || consultants.length) return
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => setConsultants(Array.isArray(j) ? j : j.data ?? []))
      .catch(() => {})
  }, [canManage, consultants.length])

  // Drop selected ids that no longer exist after a refetch.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const live = new Set(rows.map((r) => r.id))
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (live.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [rows])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  }, [allSelected, rows])

  const handleAssigned = useCallback(() => {
    fetchData(q)
    onChanged?.()
  }, [fetchData, q, onChanged])

  const handleBulkAssign = useCallback(async () => {
    if (!target || selectedIds.size === 0) return
    setAssigning(true)
    try {
      const res = await fetch('/api/analise-meta/leads/assign-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: Array.from(selectedIds), consultant_id: target }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error === 'forbidden' ? 'Sem permissão.' : 'Não foi possível atribuir.')
        return
      }
      const n = json.assigned ?? 0
      toast.success(`${n} lead${n === 1 ? '' : 's'} atribuída${n === 1 ? '' : 's'}`)
      setSelectedIds(new Set())
      setTarget('')
      fetchData(q)
      onChanged?.()
    } catch {
      toast.error('Erro ao atribuir.')
    } finally {
      setAssigning(false)
    }
  }, [target, selectedIds, fetchData, q, onChanged])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por nome, email, telefone…"
            className="h-9 rounded-full pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          {canManage && rows.length > 0 && (
            <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              Seleccionar tudo
            </label>
          )}
          <p className="text-muted-foreground text-xs tabular-nums">
            {total} lead{total === 1 ? '' : 's'} por atribuir
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="bg-muted/50 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
            <Inbox className="text-muted-foreground/30 h-8 w-8" />
          </div>
          <h3 className="text-lg font-medium">{q ? 'Sem resultados' : 'Nada por atribuir'}</h3>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            {q
              ? 'Nenhuma lead corresponde à pesquisa.'
              : 'Todas as leads Meta foram atribuídas — as novas sem regra aparecem aqui.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((lead, idx) => {
            const isSelected = selectedIds.has(lead.id)
            return (
              <div
                key={lead.id}
                className={cn(
                  'group bg-card/50 animate-in fade-in slide-in-from-bottom-2 rounded-2xl border p-4 backdrop-blur-sm transition-all hover:shadow-sm',
                  isSelected && 'border-primary/30 bg-primary/5',
                )}
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                <div className="flex items-start gap-3">
                  {canManage && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(lead.id)}
                      className="mt-0.5 shrink-0"
                      aria-label={`Seleccionar ${lead.full_name ?? 'lead'}`}
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                        <User className="text-muted-foreground h-3.5 w-3.5" />
                        {lead.full_name ?? '—'}
                      </span>
                      {!lead.signature_valid && (
                        <Badge variant="destructive" className="gap-1 text-[9px]">
                          <ShieldAlert className="h-3 w-3" />
                          Assinatura inválida
                        </Badge>
                      )}
                      {lead.lead_id && (
                        <Badge variant="secondary" className="text-[9px]">
                          Já no CRM
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {lead.phone && (
                        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <Phone className="h-3 w-3" />
                          {lead.phone}
                        </span>
                      )}
                      {lead.email && (
                        <span className="text-muted-foreground flex max-w-[220px] items-center gap-1 truncate text-[11px]">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{lead.email}</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {lead.campaign_name && (
                        <span className="bg-muted/60 dark:bg-muted/30 rounded-full px-2 py-0.5 text-[10px] font-medium">
                          {lead.campaign_name}
                        </span>
                      )}
                      {lead.form_name && (
                        <span className="text-muted-foreground line-clamp-1 text-[10px]">{lead.form_name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(lead.fb_created_time ?? lead.received_at), {
                        addSuffix: true,
                        locale: pt,
                      })}
                    </span>
                    {canManage ? (
                      <AssignLeadButton leadId={lead.id} leadName={lead.full_name} onAssigned={handleAssigned} />
                    ) : (
                      <span className="text-muted-foreground/70 text-[10px] italic">Sem permissão p/ atribuir</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating bulk-assign bar — mirrors the reassign bar on the other tabs. */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="border-primary/30 bg-card flex flex-wrap items-center gap-2 rounded-2xl border p-3 shadow-xl sm:flex-nowrap sm:gap-4 sm:p-4">
            <Badge variant="secondary" className="shrink-0 rounded-full text-xs">
              {selectedIds.size} sel.
            </Badge>
            <ArrowRight className="text-muted-foreground hidden h-4 w-4 shrink-0 sm:block" />
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-8 w-full rounded-full text-xs sm:w-56">
                <SelectValue placeholder="Atribuir a..." />
              </SelectTrigger>
              <SelectContent>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.commercial_name ?? c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                size="sm"
                className="flex-1 rounded-full sm:flex-none"
                onClick={handleBulkAssign}
                disabled={!target || assigning}
              >
                {assigning && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Atribuir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
