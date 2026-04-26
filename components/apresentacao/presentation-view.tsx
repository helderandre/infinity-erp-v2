'use client'

import { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
  BedDouble,
  Bath,
  Maximize,
  Car,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Sparkles,
  Building2,
  Instagram,
  MessageCircle,
} from 'lucide-react'
import {
  formatArea,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  ENERGY_CERTIFICATES,
  PROPERTY_CONDITIONS,
  AGENCY_FOOTER_LINE,
  AGENCY_INDEPENDENCE_NOTICE,
  REMAX_LOGO_PATH,
  REMAX_COLLECTION_CONVICTUS_LOGO_PATH,
} from '@/lib/constants'

interface PresentationViewProps {
  property: any
  sections: string[]
  isPrint: boolean
}

/**
 * Measures the first .slide-wrap's actual rendered width and writes the scale
 * factor (width/1280) onto the .presentation-root as the CSS variable
 * `--slide-scale`. Runs on mount + on every resize / orientation change. This
 * sidesteps cross-browser quirks with length/length math inside transforms.
 */
function useSlideScale(isPrint: boolean) {
  useEffect(() => {
    if (isPrint) return
    if (typeof window === 'undefined') return

    const update = () => {
      const root = document.querySelector('.presentation-root') as HTMLElement | null
      const wrap = document.querySelector('.slide-wrap') as HTMLElement | null
      if (!root || !wrap) return
      const w = wrap.getBoundingClientRect().width
      if (w > 0) {
        const scale = Math.min(1, w / 1280)
        root.style.setProperty('--slide-scale', String(scale))
      }
    }

    update()
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [isPrint])
}

export function PresentationView({ property, sections, isPrint }: PresentationViewProps) {
  useSlideScale(isPrint)
  const specs = property.dev_property_specifications
  const internal = property.dev_property_internal
  const consultant = property.consultant
  const consultantProfile = consultant?.dev_consultant_profiles?.[0] || consultant?.dev_consultant_profiles

  const allMedia: any[] = property.dev_property_media || []
  const images = useMemo(
    () =>
      allMedia
        .filter((m) => m.media_type !== 'planta' && m.media_type !== 'planta_3d')
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [allMedia],
  )
  const showStaging = property.presentation_show_staging !== false
  const showAiPlantas = property.presentation_show_ai_plantas !== false

  const plantas = allMedia.filter((m) => m.media_type === 'planta')
  const renders3d = showAiPlantas
    ? allMedia.filter((m) => m.media_type === 'planta_3d')
    : []
  const rendersByPlanta = new Map<string, any[]>()
  for (const r of renders3d) {
    if (!r.source_media_id) continue
    const list = rendersByPlanta.get(r.source_media_id) || []
    list.push(r)
    rendersByPlanta.set(r.source_media_id, list)
  }
  const stagedImages = showStaging ? images.filter((m) => m.ai_staged_url) : []

  const cover = images.find((m) => m.is_cover) ?? images[0]

  const has = (key: string) => sections.includes(key)
  const activeSlides: { key: string; label: string }[] = []

  // Split long descriptions across multiple slides so nothing gets clipped.
  const descriptionChunks = useMemo(
    () => (property.description ? chunkDescription(property.description, 1200) : []),
    [property.description],
  )

  if (has('cover')) activeSlides.push({ key: 'cover', label: 'Capa' })
  if (has('resumo')) activeSlides.push({ key: 'resumo', label: 'Resumo' })
  if (has('descricao') && descriptionChunks.length > 0) {
    descriptionChunks.forEach((_, i) =>
      activeSlides.push({
        key: `descricao-${i}`,
        label: descriptionChunks.length > 1 ? `Descrição ${i + 1}` : 'Descrição',
      }),
    )
  }
  // Cap gallery to at most 2 slides of 6 images (12 images total)
  const galleryImages = images.slice(0, 12)
  const galleryChunks = Math.ceil(galleryImages.length / 6)
  if (has('galeria') && galleryImages.length > 0) {
    for (let i = 0; i < galleryChunks; i++) {
      activeSlides.push({ key: `galeria-${i}`, label: `Galeria ${i + 1}` })
    }
  }
  if (has('plantas') && plantas.length > 0) {
    for (let i = 0; i < plantas.length; i++) {
      activeSlides.push({ key: `planta-${i}`, label: `Planta ${i + 1}` })
    }
  }
  if (has('staging') && stagedImages.length > 0) {
    for (let i = 0; i < stagedImages.length; i++) {
      activeSlides.push({ key: `staging-${i}`, label: `Staging ${i + 1}` })
    }
  }
  if (has('localizacao') && property.latitude && property.longitude)
    activeSlides.push({ key: 'localizacao', label: 'Localização' })
  if (has('consultor') && consultant) activeSlides.push({ key: 'consultor', label: 'Consultor' })
  if (has('closing')) activeSlides.push({ key: 'closing', label: 'Obrigado' })

  const price =
    property.listing_price != null
      ? new Intl.NumberFormat('de-DE', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Number(property.listing_price))
      : null

  return (
    <div className={cn('presentation-root bg-neutral-100 min-h-screen', isPrint && 'print-mode')}>
      <style>{`
        /* Re-enable pinch-zoom on the public presentation route. The global
           html { touch-action: manipulation } in globals.css is for the ERP
           dashboard; here viewers should be free to zoom into a slide. */
        .presentation-root, .presentation-root * { touch-action: auto; }

        .slide {
          width: 1280px;
          height: 720px;
          position: relative;
          background: white;
          color: #0a0a0a;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
          overflow: hidden;
        }
        /* Each slide is laid out at its native 1280x720, then scaled down to
           fit the viewport via the legacy padding-bottom + transform technique.
           A wrapper with padding-bottom: 56.25% reserves a 16:9 box; the slide
           inside is positioned absolutely at native size and uses
           transform: scale() to fit. This pattern works reliably across iOS
           Safari, Chromium and Firefox without aspect-ratio quirks. */
        .slide-wrap {
          position: relative;
          width: 100%;
          max-width: 1280px;
          margin: 12px auto;
          overflow: hidden;
          border-radius: 12px;
          box-shadow: 0 20px 40px -20px rgba(0,0,0,0.25);
          background: white;
        }
        .slide-wrap::before {
          content: '';
          display: block;
          padding-bottom: 56.25%;
        }
        .slide-wrap > .slide {
          position: absolute;
          top: 0;
          left: 0;
          width: 1280px;
          height: 720px;
          transform-origin: top left;
          border-radius: 0;
          box-shadow: none;
          margin: 0;
          /* --slide-scale is set by JS on the .presentation-root for accurate
             scaling on every viewport (incl. iOS Safari where length/length
             calc inside transform has historically been unreliable). The
             CSS fallback covers the moments before JS hydrates. */
          transform: scale(var(--slide-scale, min(1, calc((100vw - 16px) / 1280px))));
        }
        .print-mode .slide-wrap {
          --slide-scale: 1 !important;
          max-width: 1280px;
          width: 1280px;
          margin: 0;
          border-radius: 0;
          box-shadow: none;
          page-break-after: always;
          break-after: page;
        }
        .print-mode .slide-wrap::before { padding-bottom: 0; height: 720px; }
        .print-mode .slide-wrap:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        @page {
          size: 1280px 720px;
          margin: 0;
        }
        .print-mode .presentation-nav { display: none; }
        .presentation-nav { padding-left: max(16px, env(safe-area-inset-left)); padding-right: max(16px, env(safe-area-inset-right)); }
        .serif { font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; }
      `}</style>

      {!isPrint && activeSlides.length > 1 && (
        <nav className="presentation-nav sticky top-0 z-50 bg-neutral-900 text-white py-2 px-4 flex items-center gap-2 overflow-x-auto shadow-md">
          <span className="text-xs opacity-70 uppercase tracking-wider mr-2">Apresentação</span>
          {activeSlides.map((s, i) => (
            <a
              key={s.key}
              href={`#slide-${s.key}`}
              className="text-xs px-2 py-1 rounded-full hover:bg-white/10 whitespace-nowrap"
            >
              {i + 1}. {s.label}
            </a>
          ))}
        </nav>
      )}

      {/* Slide 1: Cover */}
      {has('cover') && (
        <div className="slide-wrap">
        <section id="slide-cover" className="slide">
          <div className="absolute inset-0 bg-neutral-900">
            {cover && (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-70"
                style={{ backgroundImage: `url('${cover.url}')` }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/50 via-neutral-900/20 to-neutral-900/95" />
          </div>

          <div className="relative z-10 h-full flex flex-col px-20 py-14 text-white">
            {/* Top bar */}
            <div className="flex items-start justify-between">
              <div className="text-sm tracking-[0.3em] uppercase opacity-80">Infinity Group</div>
              <div className="text-sm tracking-[0.2em] uppercase opacity-80">
                {property.business_type === 'arrendamento' ? 'Arrendamento' : 'Venda'}
              </div>
            </div>

            {/* Center/bottom: title block */}
            <div className="mt-auto">
              <div className="h-0.5 w-20 bg-white/50 mb-8" />
              <p className="text-xs tracking-[0.3em] uppercase opacity-70 mb-3">
                {(property.property_type &&
                  PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES]) ||
                  'Imóvel'}
              </p>
              <h1 className="serif text-7xl leading-[1.05] font-medium tracking-tight max-w-4xl">
                {property.title || 'Sem título'}
              </h1>
              <div className="flex items-end justify-between mt-10">
                <div className="flex items-center gap-2 opacity-80 text-base">
                  <MapPin className="h-4 w-4" />
                  {[property.zone, property.city].filter(Boolean).join(', ') || '—'}
                </div>
                {price && (
                  <div className="text-right">
                    <div className="text-xs tracking-[0.2em] uppercase opacity-70 mb-1">
                      Preço
                    </div>
                    <div className="serif text-5xl font-medium">€ {price}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        </div>
      )}

      {/* Slide 2: Resumo */}
      {has('resumo') && (
        <div className="slide-wrap">
        <section id="slide-resumo" className="slide flex">
          <div className="w-1/2 relative bg-neutral-200">
            {cover && (
              <Image
                src={cover.url}
                alt="Capa"
                fill
                className="object-cover"
                unoptimized
                sizes="640px"
              />
            )}
          </div>
          <div className="w-1/2 flex flex-col px-14 py-14">
            <div className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-3">Resumo</div>
            <h2 className="serif text-5xl leading-[1.1] font-medium text-neutral-900 mb-8 line-clamp-3">
              {property.title}
            </h2>

            {price && (
              <div className="mb-8 pb-6 border-b border-neutral-200">
                <div className="text-xs tracking-[0.2em] uppercase text-neutral-500 mb-1">
                  {property.business_type === 'arrendamento' ? 'Renda mensal' : 'Preço'}
                </div>
                <div className="serif text-6xl font-medium text-neutral-900">€ {price}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              {specs?.typology && (
                <StatBlock icon={Building2} label="Tipologia" value={specs.typology} />
              )}
              {specs?.bedrooms != null && (
                <StatBlock icon={BedDouble} label="Quartos" value={String(specs.bedrooms)} />
              )}
              {specs?.bathrooms != null && (
                <StatBlock icon={Bath} label="WC" value={String(specs.bathrooms)} />
              )}
              {specs?.area_util != null && (
                <StatBlock icon={Maximize} label="Área útil" value={formatArea(specs.area_util)} />
              )}
              {specs?.area_gross != null && (
                <StatBlock icon={Maximize} label="Área bruta" value={formatArea(specs.area_gross)} />
              )}
              {(specs?.parking_spaces || specs?.garage_spaces) && (
                <StatBlock
                  icon={Car}
                  label="Lugares"
                  value={String((specs?.parking_spaces || 0) + (specs?.garage_spaces || 0))}
                />
              )}
              {property.energy_certificate && (
                <StatBlock
                  icon={Sparkles}
                  label="Certificado"
                  value={
                    ENERGY_CERTIFICATES[
                      property.energy_certificate as keyof typeof ENERGY_CERTIFICATES
                    ] || property.energy_certificate
                  }
                />
              )}
              {specs?.construction_year && (
                <StatBlock
                  icon={Calendar}
                  label="Ano"
                  value={String(specs.construction_year)}
                />
              )}
              {property.property_condition && (
                <StatBlock
                  icon={Sparkles}
                  label="Condição"
                  value={
                    PROPERTY_CONDITIONS[
                      property.property_condition as keyof typeof PROPERTY_CONDITIONS
                    ] || property.property_condition
                  }
                />
              )}
            </div>

            <div className="mt-auto pt-6 border-t border-neutral-200 text-xs text-neutral-500 tracking-wider uppercase">
              {property.external_ref && <span>Ref. {property.external_ref}</span>}
            </div>
          </div>
        </section>
        </div>
      )}

      {/* Descrição — split into multiple slides if too long */}
      {has('descricao') &&
        descriptionChunks.map((chunk, idx) => (
          <div key={`descricao-${idx}`} className="slide-wrap">
            <section
              id={`slide-descricao-${idx}`}
              className="slide flex flex-col px-24 py-16"
            >
              <div className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-3">
                Descrição
                {descriptionChunks.length > 1 &&
                  ` · ${idx + 1} / ${descriptionChunks.length}`}
              </div>
              <h2 className="serif text-5xl font-medium text-neutral-900 mb-8 leading-[1.1]">
                {idx === 0 ? 'Sobre este imóvel' : 'Sobre este imóvel (cont.)'}
              </h2>
              <div className="flex-1 overflow-hidden">
                <RichDescription text={chunk} />
              </div>
              <div className="pt-6 text-xs text-neutral-500 tracking-wider uppercase">
                Infinity Group · {property.external_ref || ''}
              </div>
            </section>
          </div>
        ))}

      {/* Galeria — up to 2 slides of 6 */}
      {has('galeria') &&
        Array.from({ length: galleryChunks }).map((_, chunkIdx) => {
          const chunk = galleryImages.slice(chunkIdx * 6, chunkIdx * 6 + 6)
          return (
            <div key={`galeria-${chunkIdx}`} className="slide-wrap">
            <section
              id={`slide-galeria-${chunkIdx}`}
              className="slide flex flex-col bg-neutral-50 px-14 py-12"
            >
              <div className="flex items-start justify-between gap-6 mb-6">
                <div className="flex-1 min-w-0">
                  <div className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-2">
                    Galeria
                  </div>
                  <h2 className="serif text-3xl font-medium text-neutral-900 leading-tight line-clamp-2">
                    {property.title}
                  </h2>
                </div>
                <div className="text-xs tracking-[0.2em] uppercase text-neutral-500 shrink-0 whitespace-nowrap pt-2">
                  {chunkIdx + 1} / {galleryChunks}
                </div>
              </div>

              <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1 min-h-0">
                {chunk.map((img) => (
                  <div
                    key={img.id}
                    className="relative bg-neutral-200 rounded-lg overflow-hidden"
                  >
                    <Image
                      src={img.url}
                      alt={img.ai_room_label || ''}
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="400px"
                    />
                    {img.ai_room_label && (
                      <div className="absolute bottom-2 left-2 bg-neutral-900/80 text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-wider backdrop-blur-sm">
                        {img.ai_room_label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
            </div>
          )
        })}

      {/* Plantas */}
      {has('plantas') &&
        plantas.map((planta, idx) => {
          const render = rendersByPlanta.get(planta.id)?.[0]
          return (
            <div key={`planta-${idx}`} className="slide-wrap">
            <section
              id={`slide-planta-${idx}`}
              className="slide flex flex-col px-14 py-12 bg-white"
            >
              <div className="flex items-end justify-between mb-6">
                <div>
                  <div className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-2">
                    Planta
                  </div>
                  <h2 className="serif text-4xl font-medium text-neutral-900">
                    Planta {idx + 1}
                    {plantas.length > 1 && ` de ${plantas.length}`}
                  </h2>
                </div>
              </div>

              <div className={cn('flex-1 min-h-0 grid gap-4', render ? 'grid-cols-2' : 'grid-cols-1')}>
                <div className="relative bg-neutral-100 rounded-lg overflow-hidden border">
                  {!planta.url.toLowerCase().endsWith('.pdf') && (
                    <Image
                      src={planta.url}
                      alt="Planta"
                      fill
                      className="object-contain p-4"
                      unoptimized
                      sizes="600px"
                    />
                  )}
                  <div className="absolute top-2 left-2 bg-neutral-900/85 text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                    Planta
                  </div>
                </div>
                {render && (
                  <div className="relative bg-neutral-200 rounded-lg overflow-hidden">
                    <Image
                      src={render.url}
                      alt="Render 3D"
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="600px"
                    />
                    <div className="absolute top-2 left-2 bg-neutral-900/85 text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                      Render 3D
                    </div>
                  </div>
                )}
              </div>
            </section>
            </div>
          )
        })}

      {/* Virtual Staging */}
      {has('staging') &&
        stagedImages.map((img, idx) => (
          <div key={`staging-${idx}`} className="slide-wrap">
          <section
            id={`slide-staging-${idx}`}
            className="slide flex flex-col px-14 py-12 bg-white"
          >
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-2">
                  Virtual Staging
                </div>
                <h2 className="serif text-4xl font-medium text-neutral-900">
                  {img.ai_room_label ? img.ai_room_label : `Ambiente ${idx + 1}`}
                </h2>
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
              <div className="relative bg-neutral-100 rounded-lg overflow-hidden">
                <Image
                  src={img.url}
                  alt="Original"
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="600px"
                />
                <div className="absolute top-3 left-3 bg-neutral-900/85 text-white px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-medium">
                  Antes
                </div>
              </div>
              <div className="relative bg-neutral-100 rounded-lg overflow-hidden">
                <Image
                  src={img.ai_staged_url!}
                  alt="Virtual Staging"
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="600px"
                />
                <div className="absolute top-3 left-3 bg-neutral-900/85 text-white px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-medium">
                  Depois
                </div>
              </div>
            </div>
          </section>
          </div>
        ))}

      {/* Localização */}
      {has('localizacao') && property.latitude && property.longitude && (
        <div className="slide-wrap">
        <section id="slide-localizacao" className="slide flex">
          <div className="w-1/2 flex flex-col px-14 py-14">
            <div className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-3">
              Localização
            </div>
            <h2 className="serif text-5xl font-medium text-neutral-900 mb-8 leading-[1.1]">
              {property.zone || property.city || 'Localização'}
            </h2>
            <div className="space-y-4">
              {property.address_street && (
                <div>
                  <div className="text-[10px] tracking-wider uppercase text-neutral-500 mb-1">
                    Morada
                  </div>
                  <div className="text-lg text-neutral-900">{property.address_street}</div>
                </div>
              )}
              {property.postal_code && (
                <div>
                  <div className="text-[10px] tracking-wider uppercase text-neutral-500 mb-1">
                    Código Postal
                  </div>
                  <div className="text-lg text-neutral-900">{property.postal_code}</div>
                </div>
              )}
              {property.city && (
                <div>
                  <div className="text-[10px] tracking-wider uppercase text-neutral-500 mb-1">
                    Cidade
                  </div>
                  <div className="text-lg text-neutral-900">{property.city}</div>
                </div>
              )}
              {property.zone && (
                <div>
                  <div className="text-[10px] tracking-wider uppercase text-neutral-500 mb-1">
                    Zona
                  </div>
                  <div className="text-lg text-neutral-900">{property.zone}</div>
                </div>
              )}
            </div>
          </div>
          <div className="w-1/2 relative bg-neutral-200">
            <StaticMap lat={property.latitude} lng={property.longitude} />
          </div>
        </section>
        </div>
      )}

      {/* Consultor */}
      {has('consultor') && consultant && (() => {
        const phoneRaw: string | undefined = consultantProfile?.phone_commercial
        const phoneDigits = phoneRaw ? phoneRaw.replace(/[^\d+]/g, '') : ''
        const phoneIntl = phoneDigits.startsWith('+')
          ? phoneDigits.slice(1)
          : phoneDigits.startsWith('00')
            ? phoneDigits.slice(2)
            : phoneDigits.length === 9
              ? `351${phoneDigits}`
              : phoneDigits
        const igRaw: string | undefined = consultantProfile?.instagram_handle
        const igHandle = igRaw ? igRaw.replace(/^@/, '').trim() : ''
        const igUrl = igHandle ? `https://instagram.com/${igHandle}` : null
        const waUrl = phoneIntl ? `https://wa.me/${phoneIntl}` : null
        const emailUrl = consultant.professional_email
          ? `mailto:${consultant.professional_email}`
          : null

        return (
          <div className="slide-wrap">
            <section
              id="slide-consultor"
              className="slide flex bg-neutral-950 text-white"
            >
              {/* LEFT: info + CTAs */}
              <div className="w-1/2 flex flex-col justify-center px-16 py-14">
                <div className="text-xs tracking-[0.3em] uppercase opacity-60 mb-4">
                  O seu consultor
                </div>
                <h2 className="serif text-6xl font-medium leading-[1.05] mb-2">
                  {consultant.commercial_name}
                </h2>
                <div className="text-sm tracking-[0.2em] uppercase opacity-70 mb-10">
                  Consultor Imobiliário · Infinity Group
                </div>

                <div className="flex flex-col gap-3 max-w-md">
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-white text-neutral-900 px-6 py-3.5 rounded-full hover:bg-white/90 transition-colors"
                    >
                      <MessageCircle className="h-5 w-5" />
                      <span className="font-medium">WhatsApp</span>
                      <span className="ml-auto opacity-60 text-sm tabular-nums">
                        {phoneRaw}
                      </span>
                    </a>
                  )}
                  {emailUrl && (
                    <a
                      href={emailUrl}
                      className="flex items-center gap-3 bg-white text-neutral-900 px-6 py-3.5 rounded-full hover:bg-white/90 transition-colors"
                    >
                      <Mail className="h-5 w-5" />
                      <span className="font-medium">Enviar Email</span>
                      <span className="ml-auto opacity-60 text-sm truncate max-w-[220px]">
                        {consultant.professional_email}
                      </span>
                    </a>
                  )}
                  {igUrl && (
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 border border-white/20 px-6 py-3.5 rounded-full hover:bg-white/5 transition-colors"
                    >
                      <Instagram className="h-5 w-5" />
                      <span className="font-medium">Instagram</span>
                      <span className="ml-auto opacity-60 text-sm">@{igHandle}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* RIGHT: photo fills the panel — anchored just below the top so
                   the face stays visible without showing only forehead. */}
              <div className="w-1/2 relative bg-neutral-800 overflow-hidden">
                {consultantProfile?.profile_photo_url ? (
                  <Image
                    src={consultantProfile.profile_photo_url}
                    alt={consultant.commercial_name || 'Consultor'}
                    fill
                    className="object-cover object-[50%_18%]"
                    unoptimized
                    sizes="640px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-9xl font-medium serif text-white/10">
                    {(consultant.commercial_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </section>
          </div>
        )
      })()}

      {/* Closing */}
      {has('closing') && (
        <div className="slide-wrap">
        <section id="slide-closing" className="slide bg-neutral-900 text-white">
          {/* HERO — absolutely positioned so the message centres relative to
              the FULL slide, not the area above the compliance strip. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-20">
            <div className="text-xs tracking-[0.3em] uppercase opacity-70 mb-6">Obrigado</div>
            <h2 className="serif text-7xl font-medium leading-tight text-center">
              Vamos
              <br />
              conversar?
            </h2>
            <div className="h-0.5 w-20 bg-white/40 mx-auto my-8" />
            <div className="text-sm tracking-[0.3em] uppercase opacity-80">Infinity Group</div>
            <div className="text-sm opacity-60 mt-1">infinitygroup.pt</div>
          </div>

          {/* COMPLIANCE STRIP — overlays the bottom of the slide. Kept light
              so the AMI text stays legible (the slide is white). */}
          <div className="absolute bottom-0 inset-x-0 border-t border-neutral-200 px-16 py-6 flex items-center gap-8 bg-white">
            {/* Logos */}
            <div className="flex items-center gap-4 shrink-0">
              <Image
                src={REMAX_LOGO_PATH}
                alt="RE/MAX"
                width={56}
                height={56}
                className="h-12 w-auto"
                unoptimized
              />
              <Image
                src={REMAX_COLLECTION_CONVICTUS_LOGO_PATH}
                alt="RE/MAX Collection Convictus"
                width={100}
                height={56}
                className="h-12 w-auto"
                unoptimized
              />
            </div>
            {/* Agency text — clearly separated lines */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-700 leading-snug">
                {AGENCY_INDEPENDENCE_NOTICE}
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 leading-snug mt-1">
                Convictus Mediação Imobiliária, Lda · AMI 4719
              </div>
            </div>
          </div>
        </section>
        </div>
      )}
    </div>
  )
}

/**
 * Splits a description into chunks small enough to fit one 720px slide. Keeps
 * paragraph boundaries intact; if a single paragraph exceeds the limit it
 * falls back to splitting at sentence ends.
 */
function chunkDescription(text: string, maxLen: number = 1200): string[] {
  if (!text || text.length <= maxLen) return text ? [text] : []
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0)
  const chunks: string[] = []
  let current = ''

  const flush = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  for (const p of paragraphs) {
    if (p.length > maxLen) {
      flush()
      // Split paragraph at sentence boundaries
      const sentences = p.split(/(?<=[.!?])\s+/).filter((s) => s.trim())
      let sub = ''
      for (const s of sentences) {
        if ((sub + ' ' + s).trim().length > maxLen && sub) {
          chunks.push(sub.trim())
          sub = s
        } else {
          sub = sub ? `${sub} ${s}` : s
        }
      }
      if (sub) current = sub
      continue
    }
    if ((current + '\n\n' + p).length > maxLen && current) {
      flush()
      current = p
    } else {
      current = current ? `${current}\n\n${p}` : p
    }
  }
  flush()
  return chunks
}

function renderRichHtml(text: string) {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const hasHtml = /<(strong|br|p|ul|li|em|b|i)[\s>/]/i.test(text)
  let html = hasHtml ? text : escape(text)
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/(?<!\n)\n(?!\n)/g, '<br/>')
  return html
}

function RichDescription({ text }: { text: string }) {
  const len = text.length
  // Auto-size based on length so it fits a single 720px slide without overflow.
  const sizeClass =
    len < 400
      ? 'text-[22px] leading-[1.55]'
      : len < 900
        ? 'text-[18px] leading-[1.55]'
        : len < 1500
          ? 'text-[15px] leading-[1.5]'
          : 'text-[13px] leading-[1.5]'
  return (
    <div
      className={`text-neutral-700 ${sizeClass} [&_strong]:text-neutral-900 [&_strong]:font-semibold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1`}
      dangerouslySetInnerHTML={{ __html: renderRichHtml(text) }}
    />
  )
}

function StatBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-neutral-700" />
      </div>
      <div>
        <div className="text-[10px] tracking-wider uppercase text-neutral-500">{label}</div>
        <div className="text-lg font-medium text-neutral-900 leading-tight">{value}</div>
      </div>
    </div>
  )
}

function StaticMap({ lat, lng }: { lat: number; lng: number }) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => setLoaded(true), [])
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  if (!token) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
        Mapa indisponível
      </div>
    )
  }
  const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+111111(${lng},${lat})/${lng},${lat},14/800x720@2x?access_token=${token}`
  return (
    <div className="absolute inset-0">
      <Image
        src={url}
        alt="Mapa"
        fill
        className={cn('object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
        unoptimized
        sizes="640px"
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
