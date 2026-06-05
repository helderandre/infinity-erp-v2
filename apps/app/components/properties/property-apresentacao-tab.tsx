'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/shared/whatsapp-icon'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ImageCompareSlider } from '@/components/shared/image-compare-slider'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
  type CarouselApi,
} from '@/components/ui/carousel'
import {
  BedDouble,
  Bath,
  Maximize,
  Car,
  MapPin,
  Phone,
  Mail,
  MessageSquare,
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
  PROPERTY_STATUS,
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
      const maplibregl = (await import('maplibre-gl')).default
      if (disposed) return
      // CARTO Voyager — free vector style, modern look (POIs, parks, building
      // shapes). No API key needed. Same family as Positron used in zonas/*.
      const map = new maplibregl.Map({
        container: mapContainerRef.current!,
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [property.longitude!, property.latitude!],
        zoom: 15,
        attributionControl: { compact: true },
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      new maplibregl.Marker({ color: '#3b82f6' })
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

  // Embla carousel API — drag/swipe nativo + animação de slide. Só usado no
  // modo `image`; staging e planta+3D continuam com `ImageCompareSlider`.
  const [emblaApi, setEmblaApi] = useState<CarouselApi | null>(null)

  // Embla → state: quando o utilizador desliza, sincroniza `lightboxIndex`.
  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      setLightboxIndex(emblaApi.selectedScrollSnap())
    }
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  // State → Embla: navegação por código (mode switch staging/planta) salta
  // para a slide correcta sem animação.
  useEffect(() => {
    if (!emblaApi || lightboxIndex === null) return
    if (emblaApi.selectedScrollSnap() !== lightboxIndex) {
      emblaApi.scrollTo(lightboxIndex, true)
    }
  }, [lightboxIndex, emblaApi])

  // Setas do teclado em modo image → delegam ao Embla (que faz a animação).
  // Esc é tratado pelo Dialog.
  useEffect(() => {
    if (lightboxIndex === null || viewerMode !== 'image' || !emblaApi) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        emblaApi.scrollPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        emblaApi.scrollNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIndex, viewerMode, emblaApi])

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
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
                      className="w-full h-[320px] sm:h-[400px] rounded-xl overflow-hidden border"
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
                    className="w-full h-[320px] sm:h-[400px] rounded-xl border border-dashed bg-muted/30 flex items-center justify-center text-muted-foreground text-sm"
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
            <div className="relative w-full">
              {viewerMode === 'image' && (
                <Carousel
                  opts={{ startIndex: lightboxIndex ?? 0, loop: false }}
                  setApi={setEmblaApi}
                  className="w-full"
                >
                  <CarouselContent className="ml-0">
                    {images.map((m, idx) => {
                      // Lazy render: só monta `<Image>` para a imagem actual e
                      // ±2 vizinhos. Reduz pedidos de rede em galerias grandes
                      // (ex.: 49 fotos) sem perder a animação suave do Embla.
                      const distance = Math.abs(idx - (lightboxIndex ?? 0))
                      const shouldRender = distance <= 2
                      return (
                        <CarouselItem key={m.id} className="pl-0 basis-full">
                          <div className="relative w-full aspect-[16/10] bg-muted">
                            {shouldRender && (
                              <Image
                                src={m.url}
                                alt={`Imagem ${idx + 1}`}
                                fill
                                className="object-contain"
                                sizes="(min-width: 1024px) 1000px, 100vw"
                                priority={idx === lightboxIndex}
                                draggable={false}
                              />
                            )}
                          </div>
                        </CarouselItem>
                      )
                    })}
                  </CarouselContent>
                  <CarouselNavButtons />
                </Carousel>
              )}
              {viewerMode === 'staging' && currentImage.ai_staged_url && (
                <div className="relative w-full aspect-[16/10] bg-muted">
                  <ImageCompareSlider
                    originalUrl={currentImage.url}
                    modifiedUrl={currentImage.ai_staged_url}
                    originalLabel="Original"
                    modifiedLabel="Virtual Staging"
                    className="!aspect-auto !rounded-none w-full h-full"
                    showLabels={false}
                  />
                </div>
              )}
              {viewerMode === 'planta' && currentPlanta && (
                <div className="relative w-full aspect-[16/10] bg-muted">
                  {currentPlantaRender ? (
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
                  )}
                </div>
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

              {/* Navigation arrows — contextual (modo image usa CarouselNavButtons) */}
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
        {(property.business_type || internal?.commission_agreed != null) && (
          <div className="text-sm text-muted-foreground">
            {property.business_type &&
              (BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] ||
                property.business_type)}
            {property.business_type && internal?.commission_agreed != null && ' · '}
            {internal?.commission_agreed != null && (
              <span className="font-semibold text-foreground">
                {internal.commission_type === 'percentage'
                  ? `${internal.commission_agreed}%`
                  : formatCurrency(Number(internal.commission_agreed))}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Consultant card */}
      {property.consultant && <ConsultantCard consultant={property.consultant} />}

      {/* Informações Gerais */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-2">Informações Gerais</h3>
        <div className="divide-y">
          <InfoRow label="Estado" value={<StatusValue status={property.status ?? null} />} />
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
            label="Área bruta privativa"
            value={
              (specs as { area_gross_private?: number | null } | null)?.area_gross_private
                ? formatArea(
                    (specs as { area_gross_private?: number | null }).area_gross_private as number,
                  )
                : null
            }
          />
          <InfoRow
            label="Área bruta"
            value={specs?.area_gross ? formatArea(specs.area_gross) : null}
          />
          <InfoRow
            label="Área útil"
            value={specs?.area_util ? formatArea(specs.area_util) : null}
          />
          <InfoRow
            label="Área total do lote"
            value={
              (specs as { area_total_lot?: number | null } | null)?.area_total_lot
                ? formatArea(
                    (specs as { area_total_lot?: number | null }).area_total_lot as number,
                  )
                : null
            }
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
        {(internal?.imi_value != null || internal?.condominium_fee != null) && (
          <div className="mt-3 pt-3 border-t space-y-1.5">
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
    </>
  )
}

function RichDescription({ text }: { text: string }) {
  const html = renderRichDescription(text)
  return (
    <div
      className="text-sm text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_strong]:font-semibold [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_em]:italic [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mb-2 [&_h1]:mt-3 [&_h1:first-child]:mt-0 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2:first-child]:mt-0 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mb-1 [&_h3]:mt-2 [&_h3:first-child]:mt-0 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:break-all"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatInlineMd(s: string): string {
  let out = s
  out = out.replace(
    /(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  )
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s)\.,;:!?]|$)/g, '$1<em>$2</em>')
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s)\.,;:!?]|$)/g, '$1<em>$2</em>')
  return out
}

function renderRichDescription(text: string): string {
  const hasHtml = /<(strong|em|br|p|ul|ol|li|b|i|h[1-6]|a)[\s>/]/i.test(text)
  if (hasHtml) {
    let html = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\n\n+/g, '<br/><br/>').replace(/(?<!\n)\n(?!\n)/g, '<br/>')
    return html
  }

  const lines = text.split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.map((l) => formatInlineMd(escapeHtml(l))).join('<br/>')}</p>`)
      paragraph = []
    }
  }
  const flushList = () => {
    if (listItems.length && listType) {
      blocks.push(
        `<${listType}>${listItems
          .map((li) => `<li>${formatInlineMd(escapeHtml(li))}</li>`)
          .join('')}</${listType}>`,
      )
      listItems = []
      listType = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const level = Math.min(heading[1].length, 3)
      blocks.push(`<h${level}>${formatInlineMd(escapeHtml(heading[2]))}</h${level}>`)
      continue
    }
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/)
    if (bullet) {
      flushParagraph()
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(bullet[1])
      continue
    }
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (numbered) {
      flushParagraph()
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(numbered[1])
      continue
    }
    flushList()
    paragraph.push(line)
  }
  flushParagraph()
  flushList()

  return blocks.join('')
}

function ConsultantCard({
  consultant,
}: {
  consultant: NonNullable<PropertyDetail['consultant']>
}) {
  const router = useRouter()
  const name = consultant.commercial_name || 'Consultor'
  const photo = consultant.dev_consultant_profiles?.profile_photo_url || null
  const phone = consultant.dev_consultant_profiles?.phone_commercial || null
  const email = consultant.professional_email || null
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  const phoneDigits = phone ? phone.replace(/[^\d+]/g, '') : ''
  const waNumber = phone ? phone.replace(/[^\d]/g, '') : ''

  const openInternalChat = () => {
    router.push(`/dashboard/comunicacao/chat?dm=${consultant.id}`)
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0 overflow-hidden">
          {photo ? (
            <Image
              src={photo}
              alt={name}
              width={44}
              height={44}
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight break-words">{name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Consultor responsável</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-full rounded-full"
          title={phone ? `Ligar ${phone}` : 'Sem telefone disponível'}
          disabled={!phoneDigits}
          asChild={!!phoneDigits}
        >
          {phoneDigits ? (
            <a href={`tel:${phoneDigits}`} aria-label="Telefonar">
              <Phone className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Phone className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-full rounded-full"
          title="Mensagem interna"
          onClick={openInternalChat}
          aria-label="Abrir chat interno"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-full rounded-full"
          title={email ? `Enviar email para ${email}` : 'Sem email disponível'}
          disabled={!email}
          asChild={!!email}
        >
          {email ? (
            <a href={`mailto:${email}`} aria-label="Enviar email">
              <Mail className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-full rounded-full"
          title={phone ? 'Abrir no WhatsApp' : 'Sem telefone disponível'}
          disabled={!waNumber}
          asChild={!!waNumber}
        >
          {waNumber ? (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir no WhatsApp"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
            </a>
          ) : (
            <WhatsAppIcon className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
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

/** Read-only estado pill — same visual language as the management strip in
 *  the edit sheet, but non-interactive. Lives inside the InfoRow on the right. */
function StatusValue({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  const meta = PROPERTY_STATUS[status as keyof typeof PROPERTY_STATUS]
  if (!meta) return <>{status}</>
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
      meta.bg, meta.text,
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
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

/**
 * Setas de navegação do Carousel do lightbox — usa o contexto do Embla via
 * `useCarousel()` para chamar scrollPrev/scrollNext, mantendo o visual dos
 * botões anteriores (rounded-full + bg-black/45 + backdrop-blur).
 */
function CarouselNavButtons() {
  const { scrollPrev, scrollNext, canScrollPrev, canScrollNext } = useCarousel()
  return (
    <>
      {canScrollPrev && (
        <button
          type="button"
          onClick={scrollPrev}
          aria-label="Imagem anterior"
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canScrollNext && (
        <button
          type="button"
          onClick={scrollNext}
          aria-label="Próxima imagem"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </>
  )
}
