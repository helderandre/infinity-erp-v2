'use client'

import { useEffect, useState } from 'react'
import {
  Files,
  ArrowLeft,
  Building2,
  Briefcase,
  Search,
  MapPin,
  ImageIcon,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { useDebounce } from '@/hooks/use-debounce'
import { PropertyDocumentsFoldersView } from '@/components/properties/property-documents-folders-view'
import { NegocioDocumentsFoldersView } from '@/components/negocios/negocio-documents-folders-view'

type SelectedItem =
  | { kind: 'property'; id: string; label: string; subtitle: string | null }
  | { kind: 'negocio'; id: string; label: string; subtitle: string | null }
  | null

export function DocumentsQuickAccess() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'imoveis' | 'negocios'>('imoveis')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SelectedItem>(null)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Reset state after the close animation so the next open is clean.
      window.setTimeout(() => {
        setSelected(null)
        setQuery('')
        setTab('imoveis')
      }, 200)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/70 hover:bg-zinc-900/85 text-white backdrop-blur-md border border-white/10 transition-colors"
        title="Documentos"
      >
        <Files className="size-4" />
        <span className="sr-only">Documentos rápidos</span>
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            'p-0 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl flex flex-col gap-0',
            'w-full sm:max-w-3xl rounded-l-3xl sm:rounded-l-3xl',
          )}
        >
          {selected ? (
            <DetailView selected={selected} onBack={() => setSelected(null)} />
          ) : (
            <ListView
              tab={tab}
              onTabChange={setTab}
              query={query}
              onQueryChange={setQuery}
              onSelect={setSelected}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// List view — tabs + search + paginated lists
// ─────────────────────────────────────────────────────────────────────────

interface ListViewProps {
  tab: 'imoveis' | 'negocios'
  onTabChange: (v: 'imoveis' | 'negocios') => void
  query: string
  onQueryChange: (v: string) => void
  onSelect: (item: SelectedItem) => void
}

function ListView({ tab, onTabChange, query, onQueryChange, onSelect }: ListViewProps) {
  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
        <SheetTitle className="flex items-center gap-2 text-base">
          <Files className="h-5 w-5" />
          Documentos
        </SheetTitle>
        <SheetDescription>
          Aceda aos documentos dos seus imóveis e negócios
        </SheetDescription>
      </SheetHeader>

      <Tabs
        value={tab}
        onValueChange={(v) => onTabChange(v as 'imoveis' | 'negocios')}
        className="flex-1 min-h-0 flex flex-col"
      >
        <div className="px-6 pt-4 shrink-0 space-y-3">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="imoveis" className="gap-2">
              <Building2 className="h-4 w-4" />
              Imóveis
            </TabsTrigger>
            <TabsTrigger value="negocios" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Negócios
            </TabsTrigger>
          </TabsList>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={
                tab === 'imoveis' ? 'Pesquisar por título, ref. ou cidade...' : 'Pesquisar por localização ou observações...'
              }
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>

        <TabsContent
          value="imoveis"
          className="flex-1 min-h-0 overflow-y-auto px-6 py-4 mt-0 data-[state=inactive]:hidden"
          forceMount
        >
          <PropertiesList
            query={query}
            onSelect={(id, label, subtitle) =>
              onSelect({ kind: 'property', id, label, subtitle })
            }
          />
        </TabsContent>
        <TabsContent
          value="negocios"
          className="flex-1 min-h-0 overflow-y-auto px-6 py-4 mt-0 data-[state=inactive]:hidden"
          forceMount
        >
          <NegociosList
            query={query}
            onSelect={(id, label, subtitle) =>
              onSelect({ kind: 'negocio', id, label, subtitle })
            }
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Detail view — re-uses existing folders views
// ─────────────────────────────────────────────────────────────────────────

interface DetailViewProps {
  selected: NonNullable<SelectedItem>
  onBack: () => void
}

function DetailView({ selected, onBack }: DetailViewProps) {
  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base truncate">{selected.label}</SheetTitle>
            {selected.subtitle && (
              <SheetDescription className="truncate">
                {selected.subtitle}
              </SheetDescription>
            )}
          </div>
        </div>
      </SheetHeader>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        {selected.kind === 'property' ? (
          <PropertyDocumentsFoldersView propertyId={selected.id} />
        ) : (
          <NegocioDocumentsFoldersView negocioId={selected.id} />
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Properties list
// ─────────────────────────────────────────────────────────────────────────

type PropertyRow = {
  id: string
  external_ref: string | null
  title: string | null
  city: string | null
  zone: string | null
  status: string | null
  listing_price: number | null
  dev_property_media?: Array<{ url: string; is_cover: boolean; order_index: number }>
}

interface PropertiesListProps {
  query: string
  onSelect: (id: string, label: string, subtitle: string | null) => void
}

function PropertiesList({ query, onSelect }: PropertiesListProps) {
  const { user } = useUser()
  const debounced = useDebounce(query, 300)
  const [items, setItems] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({
      consultant_id: user.id,
      per_page: '50',
    })
    if (debounced.trim()) params.set('search', debounced.trim())

    fetch(`/api/properties?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setItems(Array.isArray(data?.data) ? data.data : [])
        setTotal(typeof data?.total === 'number' ? data.total : 0)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, debounced])

  if (loading) return <ListSkeleton />
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-8 w-8 text-muted-foreground" />}
        title={debounced ? 'Sem imóveis para esta pesquisa' : 'Ainda não tem imóveis associados'}
        hint={debounced ? 'Tente outro termo de pesquisa.' : 'Os imóveis em que é o consultor aparecem aqui.'}
      />
    )
  }

  return (
    <div className="space-y-2">
      {items.map((p) => {
        const cover =
          p.dev_property_media?.find((m) => m.is_cover)?.url ||
          p.dev_property_media?.[0]?.url ||
          null
        const subtitleParts = [p.zone, p.city].filter(Boolean) as string[]
        const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : null
        const label = p.title || p.external_ref || 'Imóvel sem título'
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id, label, subtitle)}
            className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card hover:bg-muted/60 transition-colors p-3 text-left"
          >
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {p.external_ref && (
                  <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                    {p.external_ref}
                  </Badge>
                )}
                <span className="truncate text-sm font-medium">{label}</span>
              </div>
              {subtitle && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{subtitle}</span>
                </div>
              )}
            </div>
          </button>
        )
      })}
      {total > items.length && (
        <p className="px-2 pt-1 text-xs text-muted-foreground">
          A mostrar {items.length} de {total}. Refine a pesquisa para encontrar outros.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Negocios list
// ─────────────────────────────────────────────────────────────────────────

type NegocioRow = {
  id: string
  tipo: string | null
  estado: string | null
  localizacao: string | null
  orcamento: number | null
  preco_venda: number | null
  lead?: { id: string; nome: string | null; full_name: string | null } | null
}

interface NegociosListProps {
  query: string
  onSelect: (id: string, label: string, subtitle: string | null) => void
}

function NegociosList({ query, onSelect }: NegociosListProps) {
  const { user } = useUser()
  const debounced = useDebounce(query, 300)
  const [items, setItems] = useState<NegocioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ limit: '50' })
    if (debounced.trim()) params.set('search', debounced.trim())

    fetch(`/api/negocios?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setItems(Array.isArray(data?.data) ? data.data : [])
        setTotal(typeof data?.total === 'number' ? data.total : 0)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, debounced])

  if (loading) return <ListSkeleton />
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="h-8 w-8 text-muted-foreground" />}
        title={debounced ? 'Sem negócios para esta pesquisa' : 'Ainda não tem negócios atribuídos'}
        hint={debounced ? 'Tente outro termo de pesquisa.' : 'Os negócios atribuídos a si aparecem aqui.'}
      />
    )
  }

  return (
    <div className="space-y-2">
      {items.map((n) => {
        const leadName = n.lead?.nome || n.lead?.full_name || 'Sem contacto'
        const subtitleParts = [n.localizacao, n.tipo].filter(Boolean) as string[]
        const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : null
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => onSelect(n.id, leadName, subtitle)}
            className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card hover:bg-muted/60 transition-colors p-3 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {n.tipo && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {n.tipo}
                  </Badge>
                )}
                <span className="truncate text-sm font-medium">{leadName}</span>
              </div>
              {subtitle && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{subtitle}</span>
                </div>
              )}
            </div>
          </button>
        )
      })}
      {total > items.length && (
        <p className="px-2 pt-1 text-xs text-muted-foreground">
          A mostrar {items.length} de {total}. Refine a pesquisa para encontrar outros.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Shared atoms
// ─────────────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
          <Skeleton className="h-12 w-16 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
