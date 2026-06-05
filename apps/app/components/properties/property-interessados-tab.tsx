'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Users, Phone, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'

const fmtSentDate = (iso: string | null): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface InteressadoCandidate {
  id: string // negocio id
  tipo: string | null
  estado: string | null
  orcamento: number | null
  orcamento_max: number | null
  localizacao: string | null
  observacoes: string | null
  tipo_imovel: string | null
  quartos_min: number | null
  price_flag: 'green' | 'yellow' | 'orange' | 'red' | null
  badges: { type: 'success' | 'warning' | 'info'; label: string }[]
  geo_source?: string
  /** ISO date string when this property was last sent to this negocio (null if never). */
  last_sent_at: string | null
  lead?: {
    id: string
    nome: string | null
    email: string | null
    telemovel: string | null
    agent?: {
      id: string
      commercial_name: string | null
    } | null
  }
  consultant?: {
    id: string
    commercial_name: string | null
  } | null
}

interface InteressadosResponse {
  linked: any[]
  suggestions: InteressadoCandidate[]
}

const fmtBudget = (n: InteressadoCandidate) => {
  const min = n.orcamento ? Number(n.orcamento) : 0
  const max = n.orcamento_max ? Number(n.orcamento_max) : 0
  if (max && min) return `${(min / 1000).toFixed(0)}k–${(max / 1000).toFixed(0)}k €`
  if (max) return `até ${(max / 1000).toFixed(0)}k €`
  if (min) return `${(min / 1000).toFixed(0)}k €`
  return null
}

const PRICE_FLAG_COLOR: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  yellow: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  orange: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  red: 'bg-red-500/15 text-red-700 dark:text-red-400',
}

const PRICE_FLAG_LABEL: Record<string, string> = {
  green: 'Encaixa no orçamento',
  yellow: 'Ligeiramente acima',
  orange: 'Acima do orçamento',
  red: 'Muito acima',
}

interface PropertyInteressadosTabProps {
  propertyId: string
  propertySlug: string | null
  propertyTitle: string | null
  propertyPrice: number | null
}

export function PropertyInteressadosTab({
  propertyId, propertySlug: _propertySlug, propertyTitle: _propertyTitle, propertyPrice: _propertyPrice,
}: PropertyInteressadosTabProps) {
  const [strict, setStrict] = useState(true)
  const [data, setData] = useState<InteressadosResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const debounced = useDebounce(search, 250)

  const refetch = () => {
    setLoading(true)
    setError(null)
    return fetch(`/api/properties/${propertyId}/interessados?strict=${strict}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((json: InteressadosResponse) => setData(json))
      .catch((e) => setError(typeof e === 'string' ? e : 'Erro ao carregar interessados'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/properties/${propertyId}/interessados?strict=${strict}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((json: InteressadosResponse) => {
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled) setError(typeof e === 'string' ? e : 'Erro ao carregar interessados')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [propertyId, strict])

  const filtered = useMemo(() => {
    const list = data?.suggestions ?? []
    const lower = debounced.toLowerCase().trim()
    if (!lower) return list
    return list.filter((n) => {
      const name = n.lead?.nome?.toLowerCase() ?? ''
      const loc = n.localizacao?.toLowerCase() ?? ''
      return name.includes(lower) || loc.includes(lower)
    })
  }, [data?.suggestions, debounced])

  const selectableWithPhone = useMemo(
    () => filtered.filter((n) => !!n.lead?.telemovel),
    [filtered]
  )

  const allSelected = selectableWithPhone.length > 0 &&
    selectableWithPhone.every((n) => selected.has(n.id))

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableWithPhone.map((n) => n.id)));
    }
  }

  const sendWhatsapp = async () => {
    const targets = filtered.filter((n) => selected.has(n.id) && n.lead?.telemovel)
    if (targets.length === 0) {
      toast.error('Sem destinatários com número de telemóvel')
      return
    }

    setSending(true)
    const toastId = toast.loading(`A enviar para ${targets.length} contacto(s)…`)
    try {
      const res = await fetch(`/api/properties/${propertyId}/share-via-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negocio_ids: targets.map((n) => n.id) }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.error ?? `Erro ${res.status}`)
      }
      const succeeded = json?.succeeded ?? 0
      const failed = (json?.attempted ?? 0) - succeeded
      if (succeeded > 0 && failed === 0) {
        toast.success(`Enviado a ${succeeded} contacto(s) via WhatsApp`, { id: toastId })
      } else if (succeeded > 0) {
        toast.warning(`Enviado a ${succeeded}; ${failed} falharam`, { id: toastId })
      } else {
        toast.error('Nenhum envio bem-sucedido', { id: toastId })
      }
      setSelected(new Set())
      // Refresh para mostrar o "Enviado em..." badge actualizado
      await refetch()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao enviar', { id: toastId })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header — filter pills + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm w-fit">
          <button
            type="button"
            onClick={() => setStrict(true)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-medium transition-all',
              strict
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Rígidos
          </button>
          <button
            type="button"
            onClick={() => setStrict(false)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-medium transition-all',
              !strict
                ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Soltos
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar lead ou zona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-full bg-muted/50 border-0 text-xs"
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {strict
          ? 'Match estrito: respeita orçamento, tipologia e zona da pesquisa.'
          : 'Match alargado: inclui contactos com critérios mais flexíveis.'}
      </p>

      {/* Selection bar */}
      {selectableWithPhone.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl ring-1 ring-border/40 bg-background/60 px-4 py-2.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            <span className="text-muted-foreground">
              {selected.size > 0 ? `${selected.size} seleccionado(s)` : `Seleccionar todos (${selectableWithPhone.length})`}
            </span>
          </label>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full h-7 text-[11px] gap-1"
                onClick={() => setSelected(new Set())}
              >
                <X className="h-3 w-3" />
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={sendWhatsapp}
                disabled={sending}
                className="rounded-full h-7 text-[11px] gap-1.5 bg-[#25D366] hover:bg-[#20bd57] text-white"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                )}
                Enviar via WhatsApp
              </Button>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-12 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">Sem interessados</p>
          <p className="text-xs text-muted-foreground mt-1">
            {strict
              ? 'Tenta o filtro "Soltos" para ver matches mais alargados.'
              : 'Não encontrámos contactos com critérios compatíveis.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => (
            <InteressadoCard
              key={n.id}
              negocio={n}
              checked={selected.has(n.id)}
              onToggle={() => toggle(n.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function InteressadoCard({
  negocio: n, checked, onToggle,
}: {
  negocio: InteressadoCandidate
  checked: boolean
  onToggle: () => void
}) {
  const name = n.lead?.nome ?? 'Sem nome'
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '—'
  const budget = fmtBudget(n)
  const phone = n.lead?.telemovel
  const hasPhone = !!phone
  const ownerName = n.consultant?.commercial_name ?? n.lead?.agent?.commercial_name ?? null
  const warnings = n.badges.filter((b) => b.type === 'warning')
  const sentLabel = fmtSentDate(n.last_sent_at)

  return (
    <li
      className={cn(
        'group rounded-2xl ring-1 ring-border/40 bg-background/60 p-3 transition-all',
        checked && 'ring-border bg-background/80 shadow-sm',
        !hasPhone && 'opacity-70',
        sentLabel && 'ring-emerald-500/30 bg-emerald-500/[0.04]',
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          disabled={!hasPhone}
          className="mt-1 shrink-0"
          title={hasPhone ? 'Seleccionar' : 'Sem telemóvel — não pode receber via WhatsApp'}
        />

        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-[10px] bg-gradient-to-br from-neutral-200 to-neutral-400 dark:from-neutral-600 dark:to-neutral-800">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{name}</p>
            {n.tipo && (
              <Badge variant="outline" className="rounded-full text-[10px] h-4 px-1.5 shrink-0">
                {n.tipo}
              </Badge>
            )}
            {n.price_flag && (
              <Badge
                className={cn(
                  'rounded-full text-[10px] h-4 px-1.5 border-0 shrink-0',
                  PRICE_FLAG_COLOR[n.price_flag]
                )}
                title={PRICE_FLAG_LABEL[n.price_flag]}
              >
                {PRICE_FLAG_LABEL[n.price_flag]}
              </Badge>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            {budget && <span>{budget}</span>}
            {n.localizacao && <><span>·</span><span className="truncate">{n.localizacao}</span></>}
            {n.tipo_imovel && <><span>·</span><span>{n.tipo_imovel}</span></>}
            {n.quartos_min ? <><span>·</span><span>T{n.quartos_min}+</span></> : null}
          </div>

          {warnings.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {warnings.slice(0, 3).map((b, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="rounded-full text-[9px] h-4 px-1.5 border-amber-300/40 text-amber-700 dark:text-amber-400"
                >
                  {b.label}
                </Badge>
              ))}
              {warnings.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{warnings.length - 3}</span>
              )}
            </div>
          )}

          {ownerName && (
            <p className="text-[10px] text-muted-foreground mt-1 truncate">
              Responsável: {ownerName}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {hasPhone ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Phone className="h-3 w-3" />
              {phone}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Sem telemóvel</span>
          )}
          {sentLabel && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
              title="Imóvel já foi enviado a este contacto"
            >
              <CheckCircle2 className="h-3 w-3" />
              Enviado em {sentLabel}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}
