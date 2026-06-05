'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { buildPublicPropertyUrl } from '@/lib/constants'
import type { PropertyGridItem } from './nodes/property-grid-node'

interface PropertyRow {
  id: string
  title: string
  external_ref: string | null
  city: string | null
  zone: string | null
  slug: string | null
  listing_price: number | null
  dev_property_specifications?: {
    typology?: string | null
    bedrooms?: number | null
    area_util?: number | null
  } | null
  dev_property_media?: Array<{
    url: string
    is_cover: boolean | null
    order_index: number | null
  }> | null
}

function priceLabel(listing: number | null | undefined): string {
  if (!listing || listing <= 0) return 'Sob consulta'
  return `${new Intl.NumberFormat('pt-PT').format(listing)} €`
}

function specsLabel(row: PropertyRow): string {
  const spec = row.dev_property_specifications
  if (!spec) return ''
  const parts: string[] = []
  if (spec.typology) parts.push(spec.typology)
  if (spec.bedrooms && spec.bedrooms > 0) {
    parts.push(`${spec.bedrooms} quarto${spec.bedrooms === 1 ? '' : 's'}`)
  }
  if (spec.area_util && spec.area_util > 0) parts.push(`${spec.area_util}m²`)
  return parts.join(' · ')
}

function locationLabel(row: PropertyRow): string {
  return [row.zone, row.city].filter(Boolean).join(' · ')
}

function coverImage(row: PropertyRow): string | null {
  const media = row.dev_property_media ?? []
  if (media.length === 0) return null
  const cover =
    media.find((m) => m.is_cover) ??
    [...media].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]
  return cover?.url ?? null
}

function toGridItem(row: PropertyRow): PropertyGridItem {
  return {
    title: row.title,
    priceLabel: priceLabel(row.listing_price),
    location: locationLabel(row),
    specs: specsLabel(row),
    imageUrl: coverImage(row),
    href: row.slug
      ? buildPublicPropertyUrl(row.slug)
      : `https://infinitygroup.pt/property/${row.id}`,
    reference: row.external_ref,
  }
}

// Stable identity for a selected item — we use external_ref when present,
// otherwise fall back to href.
function itemKey(item: PropertyGridItem): string {
  return item.reference?.trim() || item.href
}

interface PropertySelectorProps {
  value: PropertyGridItem[]
  onChange: (value: PropertyGridItem[]) => void
}

export function PropertySelector({ value, onChange }: PropertySelectorProps) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedKeys = useMemo(
    () => new Set(value.map((v) => itemKey(v))),
    [value]
  )

  const fetchRows = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        per_page: '20',
        sort_by: 'created_at',
        sort_dir: 'desc',
      })
      if (q) params.set('search', q)
      const res = await fetch(`/api/properties?${params}`)
      if (!res.ok) throw new Error('Erro ao pesquisar imóveis')
      const data = await res.json()
      setRows((data.data ?? []) as PropertyRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao pesquisar')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchRows(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, fetchRows])

  const toggleRow = (row: PropertyRow) => {
    const item = toGridItem(row)
    const key = itemKey(item)
    if (selectedKeys.has(key)) {
      onChange(value.filter((v) => itemKey(v) !== key))
    } else {
      onChange([...value, item])
    }
  }

  const removeItem = (key: string) => {
    onChange(value.filter((v) => itemKey(v) !== key))
  }

  return (
    <div className="space-y-3 w-full min-w-0">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => {
            const key = itemKey(item)
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs max-w-full"
              >
                <span className="truncate max-w-[140px]">
                  {item.reference ? `${item.reference} · ` : ''}
                  {item.title}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => removeItem(key)}
                  aria-label={`Remover ${item.title}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por título, referência, cidade..."
          className="h-9 pl-8 text-xs"
        />
      </div>

      <div className="rounded-md border overflow-hidden">
        <Command shouldFilter={false} className="w-full">
          <CommandList className="max-h-[280px] w-full">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                A pesquisar...
              </div>
            ) : error ? (
              <div className="py-6 text-center text-xs text-destructive">
                {error}
              </div>
            ) : rows.length === 0 ? (
              <CommandEmpty className="text-xs">
                Nenhum imóvel encontrado.
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {rows.map((row) => {
                  const item = toGridItem(row)
                  const key = itemKey(item)
                  const isSelected = selectedKeys.has(key)
                  return (
                    <CommandItem
                      key={row.id}
                      value={row.id}
                      onSelect={() => toggleRow(row)}
                      className="gap-2.5 w-full max-w-full"
                    >
                      <div
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-input'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="text-xs font-medium truncate">
                          {row.external_ref ? `${row.external_ref} · ` : ''}
                          {row.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {[locationLabel(row), priceLabel(row.listing_price)]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </div>

      {value.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {value.length} imóve{value.length === 1 ? 'l' : 'is'} seleccionado
            {value.length === 1 ? '' : 's'}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
            className="h-6 text-xs"
          >
            Limpar selecção
          </Button>
        </div>
      )}
    </div>
  )
}
