'use client'

/**
 * People on an oportunidade — the primary (titular) plus any co-contactos
 * (a spouse, a partner, a co-buyer). Renders under the client name in the
 * Início tab. Adding a person links an existing `leads` record; optionally it
 * also records the marriage/partnership in `lead_relationships` so it shows on
 * the contact pages too.
 *
 * Primary is driven by `negocios.lead_id`; "Tornar titular" PATCHes
 * make_primary, which the server applies by moving lead_id (forward trigger
 * mirrors the junction). The caller reloads the deal via `onPrimaryChanged`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Users, MoreHorizontal, Crown, Trash2, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const ROLE_LABELS: Record<string, string> = {
  titular: 'Titular',
  conjuge: 'Cônjuge',
  co_comprador: 'Co-comprador',
  co_vendedor: 'Co-vendedor',
  fiador: 'Fiador',
  representante: 'Representante',
  outro: 'Outro',
}
const ADDABLE_ROLES = ['conjuge', 'co_comprador', 'co_vendedor', 'fiador', 'representante', 'outro'] as const

interface Participant {
  lead_id: string
  is_primary: boolean
  role: string
  lead: { id: string; nome: string | null; email: string | null; telemovel: string | null } | null
}

interface LeadHit {
  id: string
  nome: string | null
  telemovel?: string | null
  email?: string | null
}

export function NegocioParticipants({
  negocioId,
  readOnly,
  onPrimaryChanged,
  embed = false,
  addOpen: addOpenProp,
  onAddOpenChange,
}: {
  negocioId: string
  leadId?: string | null
  readOnly?: boolean
  onPrimaryChanged?: () => void
  /** Embedded mode: render only the people list + dialogs (no card / header /
   *  Adicionar button). The parent supplies the trigger button and controls
   *  the add dialog via addOpen/onAddOpenChange. */
  embed?: boolean
  addOpen?: boolean
  onAddOpenChange?: (open: boolean) => void
}) {
  const [rows, setRows] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [internalAddOpen, setInternalAddOpen] = useState(false)
  const addOpen = addOpenProp ?? internalAddOpen
  const setAddOpen = onAddOpenChange ?? setInternalAddOpen
  const [removeTarget, setRemoveTarget] = useState<Participant | null>(null)
  const [busyLead, setBusyLead] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/negocios/${negocioId}/contactos`)
      if (!res.ok) return
      const json = await res.json()
      setRows(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [negocioId])

  useEffect(() => { load() }, [load])

  const others = useMemo(() => rows.filter((r) => !r.is_primary), [rows])

  const makePrimary = async (p: Participant) => {
    setBusyLead(p.lead_id)
    try {
      const res = await fetch(`/api/crm/negocios/${negocioId}/contactos/${p.lead_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ make_primary: true }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? 'Falha ao definir titular')
      }
      toast.success(`${p.lead?.nome ?? 'Contacto'} é agora o titular`)
      await load()
      onPrimaryChanged?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusyLead(null)
    }
  }

  const remove = async (p: Participant) => {
    setBusyLead(p.lead_id)
    try {
      const res = await fetch(`/api/crm/negocios/${negocioId}/contactos/${p.lead_id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? 'Falha ao remover')
      }
      toast.success('Contacto removido do negócio')
      setRemoveTarget(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusyLead(null)
    }
  }

  if (loading) return null
  // Nothing to show and can't edit → stay invisible.
  if (others.length === 0 && readOnly) return null

  const content =
    others.length === 0 ? (
      // In embedded mode the parent already shows the action buttons, so the
      // verbose hint is redundant — only render it in standalone card mode.
      embed ? null : (
        <p className="text-xs text-muted-foreground py-1">
          Só o titular. Adicione cônjuge, parceiro ou co-comprador se o negócio
          envolver mais do que uma pessoa.
        </p>
      )
    ) : (
      <ul className="space-y-1.5">
        {others.map((p) => (
          <li
            key={p.lead_id}
            className="flex items-center gap-2 rounded-xl bg-background/70 border border-border/40 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{p.lead?.nome ?? 'Contacto'}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                  {ROLE_LABELS[p.role] ?? p.role}
                </Badge>
              </div>
              {(p.lead?.telemovel || p.lead?.email) && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {p.lead?.telemovel || p.lead?.email}
                </p>
              )}
            </div>
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={busyLead === p.lead_id}>
                    {busyLead === p.lead_id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <MoreHorizontal className="h-3.5 w-3.5" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => makePrimary(p)}>
                    <Crown className="h-3.5 w-3.5 mr-2" /> Tornar titular
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setRemoveTarget(p)}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover do negócio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ul>
    )

  const dialogs = (
    <>
      <AddParticipantDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        negocioId={negocioId}
        existingLeadIds={rows.map((r) => r.lead_id)}
        onAdded={load}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do negócio</AlertDialogTitle>
            <AlertDialogDescription>
              Remover {removeTarget?.lead?.nome ?? 'este contacto'} das pessoas deste negócio?
              O contacto em si não é eliminado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => removeTarget && remove(removeTarget)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  // Embedded: just the list + dialogs (parent owns the card + buttons).
  if (embed) {
    return <>{content}{dialogs}</>
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-muted/20 px-3.5 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <Users className="h-3.5 w-3.5" />
          Pessoas no negócio
        </div>
        {!readOnly && (
          <Button
            type="button" variant="ghost" size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        )}
      </div>
      {content}
      {dialogs}
    </div>
  )
}

function AddParticipantDialog({
  open, onOpenChange, negocioId, existingLeadIds, onAdded,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  negocioId: string
  existingLeadIds: string[]
  onAdded: () => void | Promise<void>
}) {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const [hits, setHits] = useState<LeadHit[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<LeadHit | null>(null)
  const [role, setRole] = useState<string>('conjuge')
  const [relationship, setRelationship] = useState<string>('conjuge')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch(''); setHits([]); setPicked(null); setRole('conjuge'); setRelationship('conjuge')
    }
  }, [open])

  useEffect(() => {
    if (!open || picked) return
    let cancelled = false
    setSearching(true)
    const params = new URLSearchParams({ limit: '12' })
    if (debounced.trim()) params.set('nome', debounced.trim())
    fetch(`/api/leads?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const data = json?.data || (Array.isArray(json) ? json : [])
        setHits(data.filter((l: LeadHit) => !existingLeadIds.includes(l.id)))
      })
      .catch(() => !cancelled && setHits([]))
      .finally(() => !cancelled && setSearching(false))
    return () => { cancelled = true }
  }, [open, debounced, picked, existingLeadIds])

  const submit = async () => {
    if (!picked) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/negocios/${negocioId}/contactos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: picked.id,
          role,
          relationship_type: relationship || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(typeof j?.error === 'string' ? j.error : 'Falha ao adicionar')
      }
      toast.success(`${picked.nome ?? 'Contacto'} adicionado ao negócio`)
      onOpenChange(false)
      await onAdded()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Adicionar pessoa ao negócio</DialogTitle>
          <DialogDescription>
            Associe um contacto existente (cônjuge, parceiro, co-comprador…).
          </DialogDescription>
        </DialogHeader>

        {!picked ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Procurar contacto por nome…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border/50 divide-y divide-border/40">
              {searching ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                </div>
              ) : hits.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Sem contactos.</div>
              ) : (
                hits.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setPicked(l)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-sm font-medium truncate">{l.nome ?? 'Sem nome'}</div>
                    {(l.telemovel || l.email) && (
                      <div className="text-[11px] text-muted-foreground truncate">{l.telemovel || l.email}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{picked.nome ?? 'Sem nome'}</div>
                {(picked.telemovel || picked.email) && (
                  <div className="text-[11px] text-muted-foreground truncate">{picked.telemovel || picked.email}</div>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPicked(null)}>
                Mudar
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Papel no negócio</label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADDABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Relação com o titular</label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conjuge">Cônjuge</SelectItem>
                    <SelectItem value="parceiro">Parceiro(a)</SelectItem>
                    <SelectItem value="familiar">Familiar</SelectItem>
                    <SelectItem value="socio">Sócio</SelectItem>
                    <SelectItem value="representante_legal">Representante legal</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A relação fica também registada nos dois contactos.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!picked || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
