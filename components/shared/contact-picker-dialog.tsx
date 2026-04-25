'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Check,
  Loader2,
  Mail,
  Phone,
  Search,
  User as UserIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDebounce } from '@/hooks/use-debounce'

export interface PickedContact {
  id?: string
  person_type: 'singular' | 'coletiva'
  name: string
  email: string | null
  phone: string | null
  nif: string | null
  /** Original source (para o caller saber se é um lead já existente). */
  source: 'lead' | 'owner'
}

interface ContactPickerDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Que repositório procurar — 'lead' ou 'owner'. */
  kind: 'lead' | 'owner'
  title?: string
  description?: string
  onSelect: (contact: PickedContact) => void
}

export function ContactPickerDialog({
  open,
  onOpenChange,
  kind,
  title,
  description,
  onSelect,
}: ContactPickerDialogProps) {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const [results, setResults] = useState<PickedContact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedId(null)
      setResults([])
      return
    }
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ limit: '25' })
        if (debounced.trim()) params.set('search', debounced.trim())
        const url = kind === 'lead' ? '/api/leads' : '/api/owners'
        const res = await fetch(`${url}?${params}`)
        if (!res.ok) return
        const json = await res.json()
        const rows: any[] = Array.isArray(json) ? json : json.data || []
        const mapped: PickedContact[] = rows.map((r: any) => {
          if (kind === 'lead') {
            return {
              id: r.id,
              person_type: 'singular' as const,
              name: r.full_name || r.nome || '—',
              email: r.email || null,
              phone: r.telemovel || r.telefone || null,
              nif: r.nif || null,
              source: 'lead' as const,
            }
          }
          return {
            id: r.id,
            person_type: (r.person_type === 'coletiva' ? 'coletiva' : 'singular') as 'singular' | 'coletiva',
            name: r.name || '—',
            email: r.email || null,
            phone: r.phone || null,
            nif: r.nif || null,
            source: 'owner' as const,
          }
        })
        if (!cancelled) setResults(mapped)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [open, kind, debounced])

  const filtered = useMemo(() => results, [results])
  const selected = filtered.find((r) => r.id === selectedId) || null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {title || (kind === 'lead' ? 'Escolher contacto' : 'Escolher proprietário')}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, email ou NIF…"
            className="pl-9 rounded-full"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[340px] -mx-6 px-6">
          {isLoading && results.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <UserIcon className="h-7 w-7 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {debounced.trim() ? 'Sem resultados' : 'Sem contactos'}
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((c) => (
                <Row
                  key={c.id || c.name}
                  contact={c}
                  selected={selectedId === c.id}
                  onClick={() => setSelectedId(c.id || null)}
                />
              ))}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onSelect(selected)
                onOpenChange(false)
              }
            }}
          >
            {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Usar contacto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  contact,
  selected,
  onClick,
}: {
  contact: PickedContact
  selected: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
          selected
            ? 'bg-primary/10 ring-1 ring-primary/30'
            : 'hover:bg-muted/40 border border-transparent',
        )}
      >
        <div className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
          {contact.person_type === 'coletiva' ? (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{contact.name}</p>
            {contact.nif && (
              <span className="text-[10px] text-muted-foreground font-mono">{contact.nif}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
            {contact.phone && (
              <span className="inline-flex items-center gap-1 truncate">
                <Phone className="h-2.5 w-2.5" />
                {contact.phone}
              </span>
            )}
            {contact.email && (
              <span className="inline-flex items-center gap-1 truncate">
                <Mail className="h-2.5 w-2.5" />
                {contact.email}
              </span>
            )}
          </div>
        </div>
        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
      </button>
    </li>
  )
}
