'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

export type EntityKind = 'property' | 'lead' | 'process' | 'owner' | 'negocio'

interface ParsedOption {
  id: string
  primary: string
  secondary?: string
  meta?: string
}

interface Endpoints {
  list: (q: string) => string
  /** Single-record endpoint for hydrating the trigger when value is set externally. */
  byId: (id: string) => string
  parse: (item: any) => ParsedOption
  emptyText: string
  searchPlaceholder: string
}

const CONFIG: Record<EntityKind, Endpoints> = {
  property: {
    list: (q) => `/api/properties?per_page=25${q ? `&search=${encodeURIComponent(q)}` : ''}`,
    byId: (id) => `/api/properties/${id}`,
    parse: (p) => ({
      id: p.id,
      primary: p.title || p.slug || p.id,
      secondary: [p.zone, p.city].filter(Boolean).join(' · ') || undefined,
      meta: p.external_ref ? `Ref. ${p.external_ref}` : undefined,
    }),
    emptyText: 'Sem imóveis para os termos pesquisados.',
    searchPlaceholder: 'Pesquisar por título, zona, ref…',
  },
  lead: {
    list: (q) => `/api/leads?limit=25${q ? `&search=${encodeURIComponent(q)}` : ''}`,
    byId: (id) => `/api/leads/${id}`,
    parse: (l) => ({
      id: l.id,
      primary: l.nome || 'Sem nome',
      secondary: [l.email, l.telemovel].filter(Boolean).join(' · ') || undefined,
    }),
    emptyText: 'Sem leads encontrados.',
    searchPlaceholder: 'Pesquisar lead…',
  },
  process: {
    list: (q) => `/api/processes?limit=25${q ? `&search=${encodeURIComponent(q)}` : ''}`,
    byId: (id) => `/api/processes/${id}`,
    parse: (p) => ({
      id: p.id,
      primary: p.external_ref || 'Processo',
      secondary: p.property?.title || p.process_type || undefined,
    }),
    emptyText: 'Sem processos encontrados.',
    searchPlaceholder: 'Pesquisar processo…',
  },
  owner: {
    list: (q) => `/api/proprietarios?limit=25${q ? `&search=${encodeURIComponent(q)}` : ''}`,
    byId: (id) => `/api/proprietarios/${id}`,
    parse: (o) => ({
      id: o.id,
      primary: o.name || o.nome || 'Sem nome',
      secondary: [o.email, o.phone].filter(Boolean).join(' · ') || undefined,
    }),
    emptyText: 'Sem proprietários encontrados.',
    searchPlaceholder: 'Pesquisar proprietário…',
  },
  negocio: {
    list: (q) => `/api/negocios?limit=25${q ? `&search=${encodeURIComponent(q)}` : ''}`,
    byId: (id) => `/api/negocios/${id}`,
    parse: (n) => ({
      id: n.id,
      primary: n.tipo ? String(n.tipo) : 'Negócio',
      secondary: [n.localizacao, n.lead?.nome ?? n.nome_lead].filter(Boolean).join(' · ') || undefined,
      meta: n.orcamento ? `${Number(n.orcamento).toLocaleString('pt-PT')} €` : undefined,
    }),
    emptyText: 'Sem negócios encontrados.',
    searchPlaceholder: 'Pesquisar negócio…',
  },
}

interface EntityPickerProps {
  type: EntityKind
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
  placeholder?: string
  /** Optional explicit label; otherwise we fetch by id when needed. */
  initialLabel?: string
}

export function EntityPicker({
  type, value, onChange, disabled, placeholder, initialLabel,
}: EntityPickerProps) {
  const config = CONFIG[type]
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const [items, setItems] = useState<ParsedOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ParsedOption | null>(
    value && initialLabel ? { id: value, primary: initialLabel } : null,
  )

  // Fetch list when popover is open / search changes / type changes.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch(config.list(debounced))
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json) => {
        if (cancelled) return
        const arr = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
        setItems(arr.map(config.parse))
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [open, debounced, config])

  // Hydrate the trigger label when value is set but we don't have a parsed
  // selected option yet (e.g. defaultValues opened the form pre-linked).
  useEffect(() => {
    if (!value) { setSelected(null); return }
    if (selected?.id === value) return
    const fromList = items.find((it) => it.id === value)
    if (fromList) { setSelected(fromList); return }
    let cancelled = false
    fetch(config.byId(value))
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return
        setSelected(config.parse(json))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [value, items, config, selected?.id])

  // Reset cached selected option when type changes — the id won't match.
  useEffect(() => { setSelected(null); setItems([]); setSearch('') }, [type])

  const triggerLabel = selected?.primary || initialLabel || placeholder || 'Seleccionar...'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-between rounded-xl border-border/40 bg-background/40 backdrop-blur-sm font-normal h-10',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={config.searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[280px]">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
              </div>
            ) : (
              <>
                <CommandEmpty>{config.emptyText}</CommandEmpty>
                <CommandGroup>
                  {value && (
                    <CommandItem
                      value="__none__"
                      onSelect={() => { onChange(null); setSelected(null); setOpen(false) }}
                      className="text-muted-foreground"
                    >
                      Limpar selecção
                    </CommandItem>
                  )}
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        onChange(item.id)
                        setSelected(item)
                        setOpen(false)
                      }}
                      className="items-start py-2"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">{item.primary}</span>
                        {item.secondary && (
                          <span className="text-[11px] text-muted-foreground truncate">
                            {item.secondary}
                          </span>
                        )}
                      </div>
                      {item.meta && (
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 ml-2 mt-0.5">
                          {item.meta}
                        </span>
                      )}
                      {value === item.id && <Check className="ml-2 h-4 w-4 shrink-0 mt-0.5" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
