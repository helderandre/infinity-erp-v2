'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ImageCompareSlider } from '@/components/shared/image-compare-slider'
import { GeneratePresentationDialog } from '@/components/apresentacao/generate-presentation-dialog'
import { BookingLinkDialog } from '@/components/booking/booking-link-dialog'
import { FileDown } from 'lucide-react'
import {
  BedDouble,
  Bath,
  Maximize,
  Car,
  MapPin,
  Phone,
  Mail,
  Share2,
  Heart,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  Euro,
  ImageIcon,
  Sofa,
  Layers,
} from 'lucide-react'
import {
  formatCurrency,
  formatArea,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
} from '@/lib/constants'
import type { PropertyDetail, PropertyMedia } from '@/types/property'

type ApresentacaoSection = 'visao-geral' | 'descricao' | 'localizacao'
type ViewerMode = 'image' | 'planta' | 'staging'

interface PropertyApresentacaoTabProps {
  property: PropertyDetail
  onOpenMedia?: () => void
}

type PlantaLike = PropertyMedia & { source_media_id?: string | null }

export function PropertyApresentacaoTab({ property, onOpenMedia }: PropertyApresentacaoTabProps) {
  const [section, setSection] = useState<ApresentacaoSection>('descricao')

  // On mobile, default the active sub-tab to "Visão Geral" so the right-side
  // cards render inline at the top instead of at the bottom of the page.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setSection((prev) => (prev === 'descricao' ? 'visao-geral' : prev))
    }
  }, [])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [viewerMode, setViewerMode] = useState<ViewerMode>('image')
  const [plantaIndex, setPlantaIndex] = useState(0)

  const specs = property.dev_property_specifications
  const internal = property.dev_property_internal

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (section !== 'localizacao') return
    if (!property.latitude || !property.longitude || !mapContainerRef.current) return
    if (mapRef.current) return

    let disposed = false
    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (disposed) return
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!
      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [property.longitude!, property.latitude!],
        zoom: 15,
        interactive: false,
      })
      new mapboxgl.Marker()
        .setLngLat([property.longitude!, property.latitude!])
        .addTo(map)
      map.on('load', () => map.resize())
      mapRef.current = map
    })()
    return () => {
      disposed = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [section, property.latitude, property.longitude])

  const allMedia = (property.dev_property_media || []) as unknown as PlantaLike[]

  const images: PropertyMedia[] = allMedia
    .filter((m) => m.media_type !== 'planta' && m.media_type !== 'planta_3d')
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))

  const plantas = allMedia.filter((m) => m.media_type === 'planta')
  const renders3d = allMedia.filter((m) => m.media_type === 'planta_3d')
  const rendersByPlanta = useMemo(() => {
    const map = new Map<string, PlantaLike[]>()
    for (const r of renders3d) {
      if (!r.source_media_id) continue
      const list = map.get(r.source_media_id) || []
      list.push(r)
      map.set(r.source_media_id, list)
    }
    return map
  }, [renders3d])

  const cover = images.find((m) => m.is_cover) ?? images[0]
  const others = images.filter((m) => m.id !== cover?.id).slice(0, 4)
  const remaining = Math.max(0, images.length - (cover ? 1 : 0) - others.length)

  const locationStr =
    [property.zone, property.city].filter(Boolean).join(', ') || property.address_street || '—'

  const currentImage = lightboxIndex !== null ? images[lightboxIndex] : null
  const currentPlanta = plantas[plantaIndex] || null
  const currentPlantaRender = currentPlanta ? rendersByPlanta.get(currentPlanta.id)?.[0] : null

  const stagedImages = useMemo(() => images.filter((m) => m.ai_staged_url), [images])
  const currentStagedIdx = useMemo(() => {
    if (!currentImage?.ai_staged_url) return -1
    return stagedImages.findIndex((m) => m.id === currentImage.id)
  }, [stagedImages, currentImage])

  const goStaged = (step: number) => {
    if (currentStagedIdx < 0 || stagedImages.length === 0) return
    const nextIdx = Math.min(
      stagedImages.length - 1,
      Math.max(0, currentStagedIdx + step),
    )
    const nextMedia = stagedImages[nextIdx]
    if (!nextMedia) return
    const lightboxIdx = images.findIndex((m) => m.id === nextMedia.id)
    if (lightboxIdx !== -1) setLightboxIndex(lightboxIdx)
  }

  const openLightbox = (mediaId: string) => {
    const idx = images.findIndex((m) => m.id === mediaId)
    if (idx !== -1) {
      setLightboxIndex(idx)
      setViewerMode('image')
    }
  }

  const closeLightbox = () => {
    setLightboxIndex(null)
    setViewerMode('image')
  }

  const goImage = (step: number) => {
    setLightboxIndex((i) => {
      if (i === null) return i
      return Math.min(images.length - 1, Math.max(0, i + step))
    })
    setViewerMode('image')
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ── Top toolbar ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Apresentação</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" title="Partilhar">
            <Share2 className="h-4 w-4" />
          </Button>
          <ViewOnlinePopover property={property} />
          <BookingLinkDialog
            propertyId={property.id}
            propertySlug={property.slug ?? null}
            consultantId={property.consultant_id ?? null}
          />
          <GeneratePresentationDialog
            propertyId={property.id}
            trigger={
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                title="Gerar apresentação (PDF)"
              >
                <FileDown className="h-4 w-4" />
              </Button>
            }
          />
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" title="Favorito">
            <Heart className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Gallery: mobile = cover + 4 thumbs in single row; sm+ = big left + 2x2 right */}
          {images.length === 0 ? (
            <div className="aspect-[16/10] rounded-2xl border border-dashed bg-muted/30 flex flex-col items-center justify-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Sem imagens disponíveis</p>
            </div>
          ) : (
            <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-3">
              {cover && (
                <button
                  type="button"
                  onClick={() => openLightbox(cover.id)}
                  className="relative sm:col-span-2 aspect-[16/11] rounded-2xl overflow-hidden bg-muted group"
                >
                  <Image
                    src={cover.url}
                    alt={property.title || 'Imagem principal'}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    priority
                  />
                </button>
              )}
              {others.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-2 gap-2 sm:gap-3">
                  {others.map((m, idx) => {
                    const isLast = idx === others.length - 1 && remaining > 0
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => (isLast && onOpenMedia ? onOpenMedia() : openLightbox(m.id))}
                        className="relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-muted group"
                      >
                        <Image
                          src={m.url}
                          alt={property.title ? `${property.title} — imagem` : 'Imagem'}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                          sizes="(max-width: 640px) 25vw, (max-width: 1024px) 25vw, 20vw"
                        />
                        {isLast && (
                          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                            <span className="text-white text-lg sm:text-2xl font-bold">
                              {remaining}+
                            </span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Title + stats */}
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {property.title || 'Sem título'}
            </h2>
            <div className="flex items-center gap-x-5 gap-y-2 flex-wrap text-sm text-muted-foreground">
              {specs?.bedrooms != null && (
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4" /> {specs.bedrooms} quarto
                  {specs.bedrooms === 1 ? '' : 's'}
                </span>
              )}
              {specs?.bathrooms != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Bath className="h-4 w-4" /> {specs.bathrooms} WC
                </span>
              )}
              {specs?.area_util != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Maximize className="h-4 w-4" /> {formatArea(specs.area_util)}
                </span>
              )}
              {(specs?.parking_spaces || specs?.garage_spaces) && (
                <span className="inline-flex items-center gap-1.5">
                  <Car className="h-4 w-4" />{' '}
                  {(specs?.parking_spaces || 0) + (specs?.garage_spaces || 0)} lug.
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                <MapPin className="h-4 w-4" /> {locationStr}
              </span>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-2 border-b">
            {(
              [
                ['visao-geral', 'Visão Geral', true],
                ['descricao', 'Descrição', false],
                ['localizacao', 'Localização', false],
              ] as const
            ).map(([key, label, mobileOnly]) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={cn(
                  'relative px-4 py-2 text-sm font-medium transition-colors',
                  mobileOnly && 'lg:hidden',
                  section === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {section === key && (
                  <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="pt-1">
            {section === 'visao-geral' && (
              <div className="lg:hidden space-y-4 animate-in fade-in duration-200">
                <SidebarCards
                  property={property}
                  specs={specs}
                  internal={internal}
                />
              </div>
            )}
            {section === 'descricao' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <h3 className="text-base font-semibold">Sobre este imóvel</h3>
                {property.description ? (
                  <RichDescription text={property.description} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Sem descrição disponível para este imóvel.
                  </p>
                )}
              </div>
            )}
            {section === 'localizacao' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="Morada" value={property.address_street || '—'} />
                  <StatTile label="Código Postal" value={property.postal_code || '—'} />
                  <StatTile label="Cidade" value={property.city || '—'} />
                  <StatTile label="Zona" value={property.zone || '—'} />
                </div>
                {property.latitude && property.longitude ? (
                  <>
                    <div
                      ref={mapContainerRef}
                      style={{ height: '200px' }}
                      className="w-full max-w-md rounded-xl overflow-hidden border"
                    />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [property.address_street, property.city].filter(Boolean).join(', '),
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 bg-primary/10 rounded-full px-3 py-1.5"
                    >
                      <MapPin className="h-3 w-3" /> Ver no Google Maps
                    </a>
                  </>
                ) : (
                  <div
                    style={{ height: '200px' }}
                    className="w-full max-w-md rounded-xl border border-dashed bg-muted/30 flex items-center justify-center text-muted-foreground text-sm"
                  >
                    Sem coordenadas disponíveis
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar (desktop only; mobile shows these in "Visão Geral" sub-tab) ── */}
        <div className="hidden lg:block lg:col-span-1 space-y-4">
          <SidebarCards property={property} specs={specs} internal={internal} />
        </div>
      </div>

      {/* ── Popup viewer (blurred backdrop, not full-screen) ── */}
      <Dialog open={lightboxIndex !== null} onOpenChange={(o) => !o && closeLightbox()}>
        <DialogContent
          className="max-w-4xl p-0 rounded-2xl overflow-hidden border gap-0"
          overlayClassName="bg-black/50 supports-backdrop-filter:backdrop-blur-md"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{property.title || 'Imagem'}</DialogTitle>
            <DialogDescription>Visualização de imagem do imóvel</DialogDescription>
          </DialogHeader>

          {currentImage && (
            <div className="relative w-full aspect-[16/10] bg-muted">
              {viewerMode === 'image' && (
                <Image
                  src={currentImage.url}
                  alt={`Imagem ${(lightboxIndex ?? 0) + 1}`}
                  fill
                  className="object-contain"
                  sizes="1000px"
                  priority
                />
              )}
              {viewerMode === 'staging' && currentImage.ai_staged_url && (
                <ImageCompareSlider
                  originalUrl={currentImage.url}
                  modifiedUrl={currentImage.ai_staged_url}
                  originalLabel="Original"
                  modifiedLabel="Virtual Staging"
                  className="!aspect-auto !rounded-none w-full h-full"
                  showLabels={false}
                />
              )}
              {viewerMode === 'planta' && currentPlanta && (
                currentPlantaRender ? (
                  <ImageCompareSlider
                    originalUrl={currentPlanta.url}
                    modifiedUrl={currentPlantaRender.url}
                    originalLabel="Planta"
                    modifiedLabel="Render 3D"
                    className="!aspect-auto !rounded-none w-full h-full"
                    showLabels={false}
                  />
                ) : (
                  <Image
                    src={currentPlanta.url}
                    alt="Planta"
                    fill
                    className="object-contain"
                    sizes="1000px"
                  />
                )
              )}

              {/* Top overlay: counter + close */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                {viewerMode === 'image' && (
                  <span className="rounded-full bg-black/45 backdrop-blur-md text-white px-3 py-1 text-xs font-medium tabular-nums">
                    {(lightboxIndex ?? 0) + 1} / {images.length}
                  </span>
                )}
                {viewerMode === 'planta' && plantas.length > 0 && (
                  <span className="rounded-full bg-black/45 backdrop-blur-md text-white px-3 py-1 text-xs font-medium tabular-nums">
                    Planta {plantaIndex + 1} / {plantas.length}
                  </span>
                )}
                {viewerMode === 'staging' && stagedImages.length > 0 && currentStagedIdx >= 0 && (
                  <span className="rounded-full bg-black/45 backdrop-blur-md text-white px-3 py-1 text-xs font-medium tabular-nums">
                    Staging {currentStagedIdx + 1} / {stagedImages.length}
                  </span>
                )}
                <button
                  className="h-8 w-8 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-colors"
                  onClick={closeLightbox}
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Navigation arrows — contextual */}
              {viewerMode === 'image' && (lightboxIndex ?? 0) > 0 && (
                <button
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-colors"
                  onClick={() => goImage(-1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {viewerMode === 'image' && (lightboxIndex ?? 0) < images.length - 1 && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-colors"
                  onClick={() => goImage(1)}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
              {viewerMode === 'planta' && plantas.length > 1 && (
                <>
                  {plantaIndex > 0 && (
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-colors"
                      onClick={() => setPlantaIndex((i) => Math.max(0, i - 1))}
                      title="Planta anterior"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}
                  {plantaIndex < plantas.length - 1 && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-colors"
                      onClick={() => setPlantaIndex((i) => Math.min(plantas.length - 1, i + 1))}
                      title="Próxima planta"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}
                </>
              )}
              {viewerMode === 'staging' && stagedImages.length > 1 && currentStagedIdx >= 0 && (
                <>
                  {currentStagedIdx > 0 && (
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-colors"
                      onClick={() => goStaged(-1)}
                      title="Anterior com staging"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}
                  {currentStagedIdx < stagedImages.length - 1 && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-colors"
                      onClick={() => goStaged(1)}
                      title="Próximo com staging"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Bottom row: mode switcher */}
          <div className="flex items-center justify-center gap-2 p-3 border-t bg-muted/40">
            <Button
              variant={viewerMode === 'image' ? 'default' : 'outline'}
              size="sm"
              className="rounded-full text-xs gap-1.5"
              onClick={() => setViewerMode('image')}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Imagem
            </Button>
            {plantas.length > 0 && (
              <Button
                variant={viewerMode === 'planta' ? 'default' : 'outline'}
                size="sm"
                className="rounded-full text-xs gap-1.5"
                onClick={() => {
                  setPlantaIndex(0)
                  setViewerMode('planta')
                }}
              >
                <Layers className="h-3.5 w-3.5" />
                Planta
                {currentImage && currentPlanta && rendersByPlanta.has(currentPlanta.id) && (
                  <span className="ml-0.5 text-[10px] opacity-75">3D</span>
                )}
              </Button>
            )}
            {currentImage?.ai_staged_url && (
              <Button
                variant={viewerMode === 'staging' ? 'default' : 'outline'}
                size="sm"
                className="rounded-full text-xs gap-1.5"
                onClick={() => setViewerMode('staging')}
              >
                <Sofa className="h-3.5 w-3.5" />
                Virtual Staging
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ViewOnlinePopover({ property }: { property: PropertyDetail }) {
  const portals: Array<{
    key: string
    label: string
    url: string | null
    bg: string
    hover: string
    icon: React.ReactNode
  }> = [
    {
      key: 'infinity',
      label: 'Infinity',
      url:
        (property as any).link_portal_infinity ||
        `https://infinitygroup.pt/property/${property.slug || property.id}`,
      bg: 'bg-black',
      hover: 'hover:bg-neutral-800',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
          <path d="M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L7.8 14.39c-.64.64-1.49.99-2.4.99-1.87 0-3.39-1.51-3.39-3.38S3.53 8.62 5.4 8.62c.91 0 1.76.35 2.44 1.03l1.13 1 1.51-1.34L9.22 8.2C8.2 7.18 6.84 6.62 5.4 6.62 2.42 6.62 0 9.04 0 12s2.42 5.38 5.4 5.38c1.44 0 2.8-.56 3.77-1.53l7.03-6.24c.64-.64 1.49-.99 2.4-.99 1.87 0 3.39 1.51 3.39 3.38s-1.52 3.38-3.39 3.38c-.9 0-1.76-.35-2.44-1.03l-1.14-1.01-1.51 1.34 1.27 1.12c1.02 1.01 2.37 1.57 3.82 1.57 2.98 0 5.4-2.41 5.4-5.38s-2.42-5.37-5.4-5.37z" />
        </svg>
      ),
    },
    {
      key: 'remax',
      label: 'Remax',
      url:
        (property as any).link_portal_remax ||
        (property.external_ref ? `https://www.remax.pt/${property.external_ref}` : null),
      bg: 'bg-blue-600',
      hover: 'hover:bg-blue-700',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path d="M12 2L3 9v12h6v-7h6v7h6V9L12 2z" fill="#EF4444" />
        </svg>
      ),
    },
    {
      key: 'idealista',
      label: 'Idealista',
      url: (property as any).link_portal_idealista || null,
      bg: 'bg-yellow-400',
      hover: 'hover:bg-yellow-300',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path d="M12 2L3 9v12h6v-7h6v7h6V9L12 2z" fill="#000" />
        </svg>
      ),
    },
    {
      key: 'imovirtual',
      label: 'Imovirtual',
      url: (property as any).link_portal_imovirtual || null,
      bg: 'bg-red-500',
      hover: 'hover:bg-red-600',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path d="M12 2L3 9v12h6v-7h6v7h6V9L12 2z" fill="#fff" />
        </svg>
      ),
    },
  ]

  const availablePortals = portals.filter((p) => !!p.url)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          title="Ver online"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide px-2 pt-1 pb-1.5">
          Ver online em
        </div>
        {availablePortals.length === 0 ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Sem portais disponíveis para este imóvel.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {availablePortals.map((p) => (
              <a
                key={p.key}
                href={p.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
              >
                <span
                  className={cn(
                    'inline-flex items-center justify-center h-6 w-6 rounded-full shrink-0 shadow-sm',
                    p.bg,
                    p.hover,
                  )}
                >
                  {p.icon}
                </span>
                <span className="flex-1 font-medium">{p.label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function SidebarCards({
  property,
  specs,
  internal,
}: {
  property: PropertyDetail
  specs: PropertyDetail['dev_property_specifications']
  internal: PropertyDetail['dev_property_internal']
}) {
  const hasAmenities =
    (specs?.features?.length ||
      specs?.equipment?.length ||
      specs?.solar_orientation?.length ||
      specs?.views?.length) ?? 0

  return (
    <>
      {/* Price card */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <div className="text-xs text-muted-foreground">
          {property.business_type === 'arrendamento' ? 'Arrendamento por' : 'Comprar pelo preço'}
        </div>
        <div className="flex items-baseline gap-1">
          <Euro className="h-5 w-5 text-foreground" />
          <span className="text-3xl font-bold text-foreground tracking-tight">
            {property.listing_price != null
              ? new Intl.NumberFormat('de-DE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(Number(property.listing_price))
              : '—'}
          </span>
        </div>
        {property.business_type && (
          <div className="text-xs text-muted-foreground">
            {BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] ||
              property.business_type}
            {property.property_type &&
              ` · ${PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] || property.property_type}`}
          </div>
        )}
        {internal?.commission_agreed != null && (
          <div className="pt-3 border-t">
            <div className="text-xs text-muted-foreground">Comissão acordada</div>
            <div className="text-sm font-semibold mt-0.5">
              {internal.commission_type === 'percentage'
                ? `${internal.commission_agreed}%`
                : formatCurrency(Number(internal.commission_agreed))}
            </div>
          </div>
        )}
        {(internal?.imi_value != null || internal?.condominium_fee != null) && (
          <div className="pt-3 border-t space-y-1.5">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Encargos
            </div>
            {internal?.imi_value != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">IMI Anual</span>
                <span className="font-medium">
                  {formatCurrency(Number(internal.imi_value))}
                </span>
              </div>
            )}
            {internal?.condominium_fee != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Condomínio / mês</span>
                <span className="font-medium">
                  {formatCurrency(Number(internal.condominium_fee))}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Consultant card */}
      {property.consultant && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0">
              {(property.consultant.commercial_name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {property.consultant.commercial_name || 'Consultor'}
              </div>
              <div className="text-xs text-muted-foreground">Consultor responsável</div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" title="Telefone">
                <Phone className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" title="Mensagem">
                <Mail className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Informações Gerais */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-2">Informações Gerais</h3>
        <div className="divide-y">
          <InfoRow
            label="Tipo"
            value={
              (property.property_type &&
                PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES]) ||
              property.property_type
            }
          />
          <InfoRow
            label="Negócio"
            value={
              (property.business_type &&
                BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES]) ||
              property.business_type
            }
          />
          <InfoRow
            label="Condição"
            value={
              (property.property_condition &&
                PROPERTY_CONDITIONS[
                  property.property_condition as keyof typeof PROPERTY_CONDITIONS
                ]) ||
              property.property_condition
            }
          />
          <InfoRow
            label="Certificado"
            value={
              (property.energy_certificate &&
                ENERGY_CERTIFICATES[
                  property.energy_certificate as keyof typeof ENERGY_CERTIFICATES
                ]) ||
              property.energy_certificate
            }
          />
          <InfoRow label="Referência" value={property.external_ref} />
          <InfoRow label="Consultor" value={property.consultant?.commercial_name} />
        </div>
      </div>

      {/* Especificações */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-2">Especificações</h3>
        <div className="divide-y">
          <InfoRow label="Tipologia" value={specs?.typology} />
          <InfoRow label="Quartos" value={specs?.bedrooms} />
          <InfoRow label="WC" value={specs?.bathrooms} />
          <InfoRow
            label="Área bruta"
            value={specs?.area_gross ? formatArea(specs.area_gross) : null}
          />
          <InfoRow
            label="Área útil"
            value={specs?.area_util ? formatArea(specs.area_util) : null}
          />
          <InfoRow label="Ano" value={specs?.construction_year} />
          <InfoRow label="Estacionamento" value={specs?.parking_spaces} />
          <InfoRow label="Garagens" value={specs?.garage_spaces} />
          {specs?.has_elevator && <InfoRow label="Elevador" value="Sim" />}
          {specs?.fronts_count != null && <InfoRow label="Frentes" value={specs.fronts_count} />}
        </div>
        {hasAmenities ? (
          <div className="mt-3 pt-3 border-t space-y-2.5">
            <BadgeList label="Características" items={specs?.features} />
            <BadgeList label="Equipamento" items={specs?.equipment} />
            <BadgeList label="Orientação Solar" items={specs?.solar_orientation} />
            <BadgeList label="Vistas" items={specs?.views} />
          </div>
        ) : null}
      </div>
    </>
  )
}

function RichDescription({ text }: { text: string }) {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const hasHtml = /<(strong|br|p|ul|ol|li|em|b|i|h[1-6])[\s>/]/i.test(text)
  let html = hasHtml ? text : escape(text)
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/(?<!\n)\n(?!\n)/g, '<br/>')
  return (
    <div
      className="text-sm text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_strong]:font-semibold [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_em]:italic [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  const display =
    value === null || value === undefined || value === '' ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      value
    )
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right truncate">{display}</span>
    </div>
  )
}

function BadgeList({ label, items }: { label: string; items?: string[] | null }) {
  if (!items || items.length === 0) return null
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
