'use client'

import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Building2, Check, Loader2, Search, User as UserIcon } from 'lucide-react'
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

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export interface NegocioPickerLead {
  id: string
  nome: string | null
  full_name?: string | null
  telemovel?: string | null
  email?: string | null
}

export interface NegocioPickerItem {
  id: string
  tipo: string
  estado: string | null
  pipeline_stage_id?: string | null
  lead_id: string
  lead: NegocioPickerLead | null
  // Valores variáveis consoante o tipo
  orcamento?: number | null
  orcamento_max?: number | null
  preco_venda?: number | null
  renda_max_mensal?: number | null
  renda_pretendida?: number | null
  tipo_imovel?: string | null
  localizacao?: string | null
  property_id?: string | null
  created_at: string
}

interface NegocioPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Filtro por tipo (ILIKE no backend). */
  tipo?: 'Compra' | 'Venda' | 'Arrendatário' | 'Arrendador'
  /** Quando definido, restringe a tipos compatíveis com fecho de negócio. */
  filterTipos?: Array<'Compra' | 'Venda' | 'Arrendatário' | 'Arrendador'>
  title?: string
  description?: string
  /** Pesquisa inicial — útil quando o caller (ex.: voz) já tem um termo. */
  initialQuery?: string
  onSelect: (negocio: NegocioPickerItem) => void
}

export function NegocioPickerDialog({
  open,
  onOpenChange,
  tipo,
  filterTipos,
  title,
  description,
  initialQuery,
  onSelect,
}: NegocioPickerDialogProps) {
  const [items, setItems] = useState<NegocioPickerItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedId(null)
      return
    }
    if (initialQuery) setSearch(initialQuery)
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ limit: '100' })
        if (tipo) params.set('tipo', tipo)
        const res = await fetch(`/api/negocios?${params}`)
        if (res.ok) {
          const json = await res.json()
          let data: NegocioPickerItem[] = json.data || []
          if (filterTipos && filterTipos.length > 0) {
            data = data.filter((n) => filterTipos.includes(n.tipo as any))
          }
          if (!cancelled) setItems(data)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, tipo, filterTipos])

  // Filtragem client-side por nome do lead (a API só pesquisa
  // localizacao/observacoes, queremos por nome também).
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return items
    return items.filter((n) => {
      const name = (n.lead?.full_name || n.lead?.nome || '').toLowerCase()
      const loc = (n.localizacao || '').toLowerCase()
      const tipo = (n.tipo || '').toLowerCase()
      return name.includes(q) || loc.includes(q) || tipo.includes(q)
    })
  }, [items, debouncedSearch])

  const selected = filtered.find((n) => n.id === selectedId) || null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title || 'Escolher negócio existente'}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, localização ou tipo…"
            className="pl-9 rounded-full"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[360px] -mx-6 px-6">
          {isLoading && items.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Briefcase className="h-7 w-7 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearch.trim() ? 'Sem resultados' : 'Sem negócios disponíveis'}
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((n) => (
                <PickerRow
                  key={n.id}
                  negocio={n}
                  selected={selectedId === n.id}
                  onClick={() => setSelectedId(n.id)}
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
            Usar negócio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PickerRow({
  negocio,
  selected,
  onClick,
}: {
  negocio: NegocioPickerItem
  selected: boolean
  onClick: () => void
}) {
  const name = negocio.lead?.full_name || negocio.lead?.nome || 'Sem nome'
  const value =
    negocio.preco_venda ??
    negocio.orcamento_max ??
    negocio.orcamento ??
    negocio.renda_pretendida ??
    negocio.renda_max_mensal ??
    null
  const valueLabel = value
    ? negocio.renda_pretendida || negocio.renda_max_mensal
      ? `${eur.format(value)}/mês`
      : eur.format(value)
    : null

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
          <UserIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{name}</p>
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {negocio.tipo}
            </span>
            {negocio.estado && (
              <span className="text-[11px] text-muted-foreground">{negocio.estado}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 truncate">
            {negocio.tipo_imovel && <span>{negocio.tipo_imovel}</span>}
            {negocio.localizacao && (
              <span className="inline-flex items-center gap-1 truncate">
                <Building2 className="h-3 w-3" />
                {negocio.localizacao}
              </span>
            )}
            {valueLabel && (
              <span className="ml-auto font-medium text-foreground/80 whitespace-nowrap">
                {valueLabel}
              </span>
            )}
          </div>
        </div>
        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
      </button>
    </li>
  )
}
