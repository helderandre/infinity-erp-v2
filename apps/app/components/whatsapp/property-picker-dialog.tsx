'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Building2, Loader2, MapPin, BedDouble, Maximize2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDebounce } from '@/hooks/use-debounce'

interface PropertyResult {
  id: string
  title: string
  slug: string
  listing_price: number | null
  property_type: string | null
  business_type: string | null
  city: string | null
  zone: string | null
  status: string | null
  external_ref: string | null
  cover_url: string | null
  typology: string | null
  area_util: number | null
  bedrooms: number | null
}

interface PropertyPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSendProperties: (properties: PropertyResult[]) => void
  isSending?: boolean
}

export function PropertyPickerDialog({ open, onOpenChange, onSendProperties, isSending }: PropertyPickerDialogProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PropertyResult[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const searchProperties = useCallback(async (query: string) => {
    setIsLoading(true)
    try {
      // No minimum query length — empty search lists everything (user filters by typing)
      const params = new URLSearchParams({ limit: '50', status: 'active' })
      if (query?.trim()) params.set('search', query.trim())

      const res = await fetch(`/api/properties?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()

      const properties: PropertyResult[] = (data.data || data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        listing_price: p.listing_price,
        property_type: p.property_type,
        business_type: p.business_type,
        city: p.city,
        zone: p.zone,
        status: p.status,
        external_ref: p.external_ref,
        cover_url: p.dev_property_media?.find((m: any) => m.is_cover)?.url
          || p.dev_property_media?.[0]?.url
          || null,
        typology: p.dev_property_specifications?.typology || null,
        area_util: p.dev_property_specifications?.area_util || null,
        bedrooms: p.dev_property_specifications?.bedrooms || null,
      }))

      setResults(properties)
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    searchProperties(debouncedSearch)
  }, [debouncedSearch, searchProperties])

  // Reset on open + load the full active list immediately so the agent sees
  // everything without having to type
  useEffect(() => {
    if (open) {
      setSearch('')
      setSelected(new Set())
      searchProperties('')
    }
  }, [open, searchProperties])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSend() {
    const props = results.filter((p) => selected.has(p.id))
    if (props.length === 0) return
    onSendProperties(props)
  }

  function formatPrice(price: number | null): string {
    if (!price) return 'Preço sob consulta'
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(price)
  }

  const PROPERTY_TYPES: Record<string, string> = {
    apartment: 'Apartamento',
    house: 'Moradia',
    land: 'Terreno',
    commercial: 'Comercial',
    office: 'Escritório',
    warehouse: 'Armazém',
    garage: 'Garagem',
    building: 'Prédio',
    farm: 'Quinta',
    store: 'Loja',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Enviar imóveis
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por referência, título, cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[350px] -mx-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {debouncedSearch.trim() ? 'Nenhum imóvel encontrado' : 'Sem imóveis activos'}
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {results.map((prop) => {
                const isSelected = selected.has(prop.id)
                return (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={() => toggleSelect(prop.id)}
                    className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {prop.cover_url ? (
                        <img src={prop.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium truncate">{prop.title}</span>
                        <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">
                          {formatPrice(prop.listing_price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {prop.external_ref && (
                          <span className="font-mono">{prop.external_ref}</span>
                        )}
                        {prop.property_type && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            {PROPERTY_TYPES[prop.property_type] || prop.property_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {(prop.city || prop.zone) && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {[prop.zone, prop.city].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {prop.bedrooms && (
                          <span className="flex items-center gap-0.5">
                            <BedDouble className="h-3 w-3" />
                            T{prop.bedrooms}
                          </span>
                        )}
                        {prop.area_util && (
                          <span className="flex items-center gap-0.5">
                            <Maximize2 className="h-3 w-3" />
                            {prop.area_util}m²
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {selected.size > 0 && (
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">
                {selected.size} imóvel{selected.size > 1 ? 'is' : ''} seleccionado{selected.size > 1 ? 's' : ''}
              </span>
              <Button onClick={handleSend} disabled={isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Building2 className="h-4 w-4 mr-2" />
                )}
                Enviar
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
