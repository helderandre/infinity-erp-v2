'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link2, Plus, Loader2, Unlink, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Neg = {
  id: string
  tipo?: string | null
  localizacao?: string | null
  business_type?: string | null
  deal_group_id?: string | null
  estado?: string | null
  quartos?: number | null
  quartos_min?: number | null
  lead_id?: string | null
  lead?: { id: string; nome?: string | null; full_name?: string | null } | null
}

/**
 * Manual linking of two opportunities of the same contact after creation
 * ("compra depende da venda", or any related-deal grouping). Both end up in a
 * shared deal_group_id via POST /api/crm/negocios/[id]/link. Self-contained:
 * fetches the contact's other deals to show the current sibling + the picker.
 */
export function NegocioLinkControl({
  negocioId,
  leadId,
  dealGroupId,
  onChanged,
  embed = false,
  pickerOpen: pickerOpenProp,
  onPickerOpenChange,
}: {
  negocioId: string
  leadId: string | null
  dealGroupId: string | null
  onChanged?: () => void
  /** Embedded mode: render only the linked-deal list + the picker dialog (no
   *  card / title / button). The parent supplies the trigger button and
   *  controls the picker via pickerOpen/onPickerOpenChange. */
  embed?: boolean
  pickerOpen?: boolean
  onPickerOpenChange?: (open: boolean) => void
}) {
  const [negocios, setNegocios] = useState<Neg[]>([])
  const [groupRows, setGroupRows] = useState<Neg[]>([])
  const [loading, setLoading] = useState(false)
  const [internalPickerOpen, setInternalPickerOpen] = useState(false)
  const pickerOpen = pickerOpenProp ?? internalPickerOpen
  const setPickerOpen = onPickerOpenChange ?? setInternalPickerOpen
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!leadId) return
    setLoading(true)
    try {
      // Candidatos para o picker (outros negócios do mesmo contacto) + membros
      // do grupo (podem pertencer a outra pessoa — ex.: a venda do cônjuge).
      const [res, groupRes] = await Promise.all([
        fetch(`/api/negocios?lead_id=${leadId}`),
        dealGroupId
          ? fetch(`/api/negocios?deal_group_id=${dealGroupId}`)
          : Promise.resolve(null),
      ])
      const json = await res.json()
      setNegocios(((json.data || []) as Neg[]).filter((n) => n.id !== negocioId))
      if (groupRes) {
        const groupJson = await groupRes.json()
        setGroupRows(((groupJson.data || []) as Neg[]).filter((n) => n.id !== negocioId))
      } else {
        setGroupRows([])
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [leadId, negocioId, dealGroupId])

  useEffect(() => { void load() }, [load])

  const linked = dealGroupId
    ? (groupRows.length > 0
        ? groupRows
        : negocios.filter((n) => n.deal_group_id === dealGroupId))
    : []
  const candidates = negocios.filter((n) => !dealGroupId || n.deal_group_id !== dealGroupId)
  // Tipologia procurada/oferecida (T3+, T2) em vez do tipo de imóvel — é o
  // que distingue dois negócios do mesmo contacto na lista de associação.
  const typology = (n: Neg) => {
    const isBuyerType = n.tipo === 'Comprador' || n.tipo === 'Compra' || n.tipo === 'Arrendatário'
    if (isBuyerType && n.quartos_min != null) return `T${n.quartos_min}+`
    if (n.quartos != null) return `T${n.quartos}`
    if (n.quartos_min != null) return `T${n.quartos_min}+`
    return null
  }
  const label = (n: Neg) => {
    // Quando o negócio ligado pertence a outra pessoa, o nome dela é a
    // primeira coisa a aparecer.
    const personName =
      n.lead_id && n.lead_id !== leadId
        ? n.lead?.full_name || n.lead?.nome || null
        : null
    return (
      [personName, n.tipo, typology(n), n.localizacao].filter(Boolean).join(' · ') || 'Negócio'
    )
  }

  const link = async (target: Neg) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/crm/negocios/${negocioId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_negocio_id: target.id }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Erro') }
      toast.success('Negócios ligados')
      setPickerOpen(false)
      await load()
      onChanged?.()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao ligar')
    } finally {
      setBusy(false)
    }
  }

  const unlink = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/crm/negocios/${negocioId}/link`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Negócio desligado')
      await load()
      onChanged?.()
    } catch {
      toast.error('Erro ao desligar')
    } finally {
      setBusy(false)
    }
  }

  if (!leadId) return null

  const linkedList = linked.length > 0 ? (
    <div className="space-y-2">
      {linked.map((n) => (
        <div
          key={n.id}
          className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/5 px-3 py-2"
        >
          <Link2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{label(n)}</span>
          {n.estado && (
            <span className="text-[10px] text-muted-foreground shrink-0">{n.estado}</span>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={unlink}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 h-8 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
        Desligar
      </button>
    </div>
  ) : null

  const picker = (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ligar a outro negócio</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Este contacto não tem outros negócios para ligar.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {candidates.map((n) => (
              <button
                key={n.id}
                type="button"
                disabled={busy}
                onClick={() => link(n)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl border border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-50',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{label(n)}</span>
                  {n.estado && (
                    <span className="block truncate text-[11px] text-muted-foreground">{n.estado}</span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )

  // Embedded: just the linked list + the picker dialog (parent owns the card +
  // the "Ligar" trigger button).
  if (embed) {
    return <>{linkedList}{picker}</>
  }

  // Standalone card — stay quiet when there's nothing to link to and no link.
  if (linked.length === 0 && candidates.length === 0 && !loading) return null

  return (
    <section className="rounded-2xl bg-background border border-border/50 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">Negócios ligados</h3>
      </div>

      {linked.length > 0 ? (
        linkedList
      ) : (
        <>
          <p className="text-[12px] text-muted-foreground">
            Liga este negócio a outro do mesmo contacto (ex.: a compra depende da venda).
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={candidates.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 text-white px-3 h-8 text-xs font-medium hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Ligar a outro negócio
          </button>
        </>
      )}

      {picker}
    </section>
  )
}
