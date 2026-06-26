'use client'

/**
 * Relationships of a contacto (cônjuge / parceiro / familiar …). Surfaces the
 * marriage/partnership recorded in `lead_relationships`, in either direction.
 * Mounted on the contact detail page (Resumo). Adding here is the same link
 * that the negócio "Adicionar pessoa" flow can create — one source of truth.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, Plus, Trash2, Loader2, Search, ArrowUpRight, UserPlus, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const REL_LABELS: Record<string, string> = {
  conjuge: 'Cônjuge',
  parceiro: 'Parceiro(a)',
  familiar: 'Familiar',
  socio: 'Sócio',
  representante_legal: 'Rep. legal',
  outro: 'Outro',
}

interface Relationship {
  id: string
  relationship_type: string
  other: { id: string; nome: string | null; telemovel: string | null; email: string | null } | null
}
interface LeadHit { id: string; nome: string | null; telemovel?: string | null; email?: string | null }

export function ContactRelationships({
  contactId,
  bare = false,
}: {
  contactId: string
  /** Render without the outer card chrome (border/bg/padding) — for embedding
   *  as a section inside another card (e.g. the leads sidebar contact card). */
  bare?: boolean
}) {
  const [rows, setRows] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Relationship | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/relationships`)
      if (!res.ok) return
      const json = await res.json()
      setRows(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => { load() }, [load])

  const remove = async (r: Relationship) => {
    setBusy(r.id)
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/relationships/${r.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? 'Falha ao remover')
      }
      toast.success('Relação removida')
      setRemoveTarget(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return null

  return (
    <div className={bare ? '' : 'rounded-2xl border border-border/50 bg-background/80 backdrop-blur-sm p-4 shadow-sm'}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Heart className="h-4 w-4 text-rose-500" /> Relações
        </h3>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sem relações. Adicione um cônjuge, parceiro ou familiar.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {r.other ? (
                    <Link
                      href={`/dashboard/crm/contactos/${r.other.id}`}
                      className="group inline-flex items-center gap-1 text-sm font-medium truncate hover:underline underline-offset-2"
                    >
                      {r.other.nome ?? 'Contacto'}
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-sm font-medium truncate">Contacto</span>
                  )}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                    {REL_LABELS[r.relationship_type] ?? r.relationship_type}
                  </Badge>
                </div>
                {(r.other?.telemovel || r.other?.email) && (
                  <p className="text-[11px] text-muted-foreground truncate">{r.other?.telemovel || r.other?.email}</p>
                )}
              </div>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600"
                disabled={busy === r.id}
                onClick={() => setRemoveTarget(r)}
              >
                {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AddRelationshipDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contactId={contactId}
        excludeIds={[contactId, ...rows.map((r) => r.other?.id).filter(Boolean) as string[]]}
        onAdded={load}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover relação</AlertDialogTitle>
            <AlertDialogDescription>
              Remover a relação com {removeTarget?.other?.nome ?? 'este contacto'}? Os contactos não são eliminados.
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
    </div>
  )
}

function AddRelationshipDialog({
  open, onOpenChange, contactId, excludeIds, onAdded,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  contactId: string
  excludeIds: string[]
  onAdded: () => void | Promise<void>
}) {
  const { user } = useUser()
  const [mode, setMode] = useState<'search' | 'create'>('search')
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const [hits, setHits] = useState<LeadHit[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<LeadHit | null>(null)
  const [relType, setRelType] = useState('conjuge')
  const [saving, setSaving] = useState(false)
  // Criar novo contacto inline (sem ter de sair deste contacto).
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [saveToDb, setSaveToDb] = useState(true)
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds])

  useEffect(() => {
    if (!open) {
      setMode('search'); setSearch(''); setHits([]); setPicked(null); setRelType('conjuge')
      setNewName(''); setNewPhone(''); setNewEmail(''); setSaveToDb(true); setSaving(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || picked || mode !== 'search') return
    let cancelled = false
    setSearching(true)
    const params = new URLSearchParams({ limit: '12' })
    if (debounced.trim()) params.set('nome', debounced.trim())
    fetch(`/api/leads?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const data = json?.data || (Array.isArray(json) ? json : [])
        setHits(data.filter((l: LeadHit) => !exclude.has(l.id)))
      })
      .catch(() => !cancelled && setHits([]))
      .finally(() => !cancelled && setSearching(false))
    return () => { cancelled = true }
  }, [open, debounced, picked, mode, exclude])

  // Cria a ligação a um contacto já existente (id real de `leads`).
  const linkTo = async (relatedId: string) => {
    const res = await fetch(`/api/crm/contacts/${contactId}/relationships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ related_contact_id: relatedId, relationship_type: relType }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(typeof j?.error === 'string' ? j.error : 'Falha ao adicionar relação')
    }
  }

  const submitExisting = async () => {
    if (!picked) return
    setSaving(true)
    try {
      await linkTo(picked.id)
      toast.success('Relação adicionada')
      onOpenChange(false)
      await onAdded()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  const submitCreate = async () => {
    if (!newName.trim() || !saveToDb) return
    setSaving(true)
    try {
      // 1) Cria o contacto na base de dados (perfil próprio), atribuído a
      //    quem o está a criar — fica visível na sua lista de contactos.
      const createRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: newName.trim(),
          telemovel: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          agent_id: user?.id,
        }),
      })
      if (!createRes.ok) {
        const j = await createRes.json().catch(() => ({}))
        throw new Error(typeof j?.error === 'string' ? j.error : 'Falha ao criar contacto')
      }
      const { id: newId } = await createRes.json()
      // 2) Liga os dois contactos.
      await linkTo(newId)
      toast.success('Contacto criado e relação adicionada')
      onOpenChange(false)
      await onAdded()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  const relTypePicker = (
    <div className="space-y-1">
      <label className="text-[11px] text-muted-foreground">Tipo de relação</label>
      <Select value={relType} onValueChange={setRelType}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(REL_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Adicionar relação</DialogTitle>
          <DialogDescription>Ligue este contacto a outro (cônjuge, parceiro, familiar…).</DialogDescription>
        </DialogHeader>

        {mode === 'create' ? (
          /* ─── Criar novo contacto inline ─── */
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMode('search')}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Voltar à pesquisa
            </button>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Nome *</label>
              <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do contacto" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Telemóvel</label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+351 …" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Email</label>
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@…" />
              </div>
            </div>
            {relTypePicker}
            <label className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 cursor-pointer">
              <Checkbox checked={saveToDb} onCheckedChange={(v) => setSaveToDb(v === true)} className="mt-0.5" />
              <span className="text-xs leading-snug">
                <span className="font-medium">Adicionar à base de dados</span>
                <span className="block text-[11px] text-muted-foreground">
                  Cria um perfil próprio para este contacto. Necessário para o poder ligar.
                </span>
              </span>
            </label>
          </div>
        ) : !picked ? (
          /* ─── Pesquisa ─── */
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus placeholder="Procurar contacto por nome…" className="pl-9"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border/50 divide-y divide-border/40">
              {searching ? (
                <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
              ) : hits.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Sem contactos.</div>
              ) : (
                hits.map((l) => (
                  <button
                    key={l.id} type="button" onClick={() => setPicked(l)}
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
            {/* Criar inline — sem ter de sair deste contacto. */}
            <button
              type="button"
              onClick={() => { setNewName(search.trim()); setMode('create') }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {search.trim() ? `Criar novo contacto "${search.trim()}"` : 'Criar novo contacto'}
            </button>
          </div>
        ) : (
          /* ─── Confirmar contacto existente ─── */
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{picked.nome ?? 'Sem nome'}</div>
                {(picked.telemovel || picked.email) && (
                  <div className="text-[11px] text-muted-foreground truncate">{picked.telemovel || picked.email}</div>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPicked(null)}>Mudar</Button>
            </div>
            {relTypePicker}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {mode === 'create' ? (
            <Button onClick={submitCreate} disabled={!newName.trim() || !saveToDb || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Criar e ligar
            </Button>
          ) : (
            <Button onClick={submitExisting} disabled={!picked || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Adicionar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
