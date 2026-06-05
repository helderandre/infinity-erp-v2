'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
  BedDouble, Bath, Maximize, Car, MapPin, Phone, Mail, Calendar, Layers, Sparkles, Building2,
} from 'lucide-react'
import {
  formatArea, PROPERTY_TYPES, BUSINESS_TYPES, ENERGY_CERTIFICATES,
  AGENCY_FOOTER_LINE,
  AGENCY_INDEPENDENCE_NOTICE,
  REMAX_LOGO_PATH,
  REMAX_COLLECTION_CONVICTUS_LOGO_PATH,
} from '@/lib/constants'
import type { PresentationOverrides } from '@/types/presentation-overrides'

interface FichaViewProps {
  property: any
  sections: string[]
  isPrint: boolean
}

export function FichaView({ property, sections, isPrint }: FichaViewProps) {
  const specs = property.dev_property_specifications
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
  const plantas = useMemo(
    () => allMedia.filter((m) => m.media_type === 'planta'),
    [allMedia],
  )
  const renders3d = useMemo(
    () => allMedia.filter((m) => m.media_type === 'planta_3d'),
    [allMedia],
  )
  const rendersByPlanta = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const r of renders3d) {
      if (!r.source_media_id) continue
      const list = map.get(r.source_media_id) || []
      list.push(r)
      map.set(r.source_media_id, list)
    }
    return map
  }, [renders3d])
  const stagedImages = useMemo(() => images.filter((m) => m.ai_staged_url), [images])

  const overrides: PresentationOverrides = property.presentation_overrides || {}
  const text = (v: unknown, fallback: string | null | undefined): string | null => {
    if (typeof v === 'string') {
      const t = v.trim()
      if (t.length > 0) return t
    }
    return fallback ?? null
  }

  const overrideCover = overrides.cover?.cover_media_id
    ? images.find((m) => m.id === overrides.cover?.cover_media_id)
    : null
  const cover = overrideCover ?? images.find((m) => m.is_cover) ?? images[0]

  const descriptionBody = text(overrides.descricao?.body, property.description)

  const overrideGalleryIds = overrides.galeria?.media_ids ?? null
  const galleryImages = useMemo(() => {
    if (overrideGalleryIds && overrideGalleryIds.length > 0) {
      const byId = new Map(images.map((m) => [m.id, m] as const))
      const picked = overrideGalleryIds
        .map((id) => byId.get(id))
        .filter(Boolean) as typeof images
      if (picked.length > 0) return picked
    }
    return images
  }, [overrideGalleryIds, images])

  const has = (key: string) => sections.includes(key)

  const price =
    property.listing_price != null
      ? new Intl.NumberFormat('de-DE', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Number(property.listing_price))
      : null

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  // Mapbox Static Images API — encode lng/lat commas/parens are fine; use a
  // simple dark marker. Size chosen to match the printed box (~720x220 at 2x).
  const mapUrl =
    property.latitude && property.longitude && token
      ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+111111(${property.longitude},${property.latitude})/${property.longitude},${property.latitude},14/720x220@2x?access_token=${token}`
      : null

  return (
    <div className={cn('ficha-root bg-neutral-200 min-h-screen', isPrint && 'print-mode')}>
      <style>{`
        .page {
          width: 794px;      /* A4 @ 96dpi */
          min-height: 1123px;
          background: white;
          color: #0a0a0a;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
          position: relative;
          overflow: hidden;
        }
        .ficha-root:not(.print-mode) .page {
          margin: 24px auto;
          box-shadow: 0 20px 40px -20px rgba(0,0,0,0.25);
          border-radius: 4px;
        }
        .print-mode .page {
          page-break-after: always;
          break-after: page;
          box-shadow: none;
          border-radius: 0;
          margin: 0;
        }
        .print-mode .page:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        .serif { font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; }
      `}</style>

      {/* ── PAGE 1: Cover + key info + description + consultor ── */}
      <PageHeader externalRef={property.external_ref} />
      <section className="page flex flex-col">
        <PageBrand externalRef={property.external_ref} />

        {has('cover') && cover && (
          <div className="relative h-[340px] bg-neutral-200 mx-10 mt-4">
            <Image
              src={cover.url}
              alt="Capa"
              fill
              className="object-cover"
              unoptimized
              sizes="720px"
            />
          </div>
        )}

        <div className="px-10 pt-5 pb-3">
          <div className="text-[9px] tracking-[0.3em] uppercase text-neutral-500 mb-1">
            {text(
              overrides.cover?.eyebrow,
              [
                (property.business_type &&
                  BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES]) ||
                  'Imóvel',
                property.property_type &&
                  (PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] ||
                    property.property_type),
              ]
                .filter(Boolean)
                .join(' · '),
            )}
          </div>
          <div className="flex items-end justify-between gap-4">
            <h1 className="serif text-3xl leading-tight font-medium text-neutral-900 flex-1 line-clamp-2">
              {text(overrides.cover?.title, property.title) || 'Sem título'}
            </h1>
            {price && (
              <div className="text-right shrink-0">
                <div className="text-[9px] tracking-[0.2em] uppercase text-neutral-500">
                  {property.business_type === 'arrendamento' ? 'Renda' : 'Preço'}
                </div>
                <div className="serif text-2xl font-medium text-neutral-900">€ {price}</div>
              </div>
            )}
          </div>
          {(property.zone || property.city || property.address_street) && (
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-600">
              <MapPin className="h-3 w-3" />
              {[property.address_street, property.zone, property.city].filter(Boolean).join(', ')}
            </div>
          )}
        </div>

        {has('resumo') && (
          <div className="px-10 py-3 border-t border-neutral-200">
            <div className="grid grid-cols-4 gap-3">
              {specs?.typology && <MiniStat icon={Building2} label="Tipologia" value={specs.typology} />}
              {specs?.bedrooms != null && (
                <MiniStat icon={BedDouble} label="Quartos" value={String(specs.bedrooms)} />
              )}
              {specs?.bathrooms != null && (
                <MiniStat icon={Bath} label="WC" value={String(specs.bathrooms)} />
              )}
              {specs?.area_util != null && (
                <MiniStat icon={Maximize} label="Área útil" value={formatArea(specs.area_util)} />
              )}
              {specs?.area_gross != null && (
                <MiniStat icon={Maximize} label="Área bruta" value={formatArea(specs.area_gross)} />
              )}
              {(specs?.parking_spaces || specs?.garage_spaces) && (
                <MiniStat
                  icon={Car}
                  label="Lugares"
                  value={String((specs?.parking_spaces || 0) + (specs?.garage_spaces || 0))}
                />
              )}
              {specs?.construction_year && (
                <MiniStat icon={Calendar} label="Ano" value={String(specs.construction_year)} />
              )}
              {property.energy_certificate && (
                <MiniStat
                  icon={Sparkles}
                  label="Certificado"
                  value={
                    ENERGY_CERTIFICATES[
                      property.energy_certificate as keyof typeof ENERGY_CERTIFICATES
                    ] || property.energy_certificate
                  }
                />
              )}
            </div>
          </div>
        )}

        {has('descricao') && descriptionBody && (
          <div className="px-10 py-4 border-t border-neutral-200 flex-1 overflow-hidden">
            <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-2">
              {text(overrides.descricao?.heading, 'Sobre este imóvel')}
            </div>
            <RichDescriptionFicha text={descriptionBody} />
          </div>
        )}

        {has('consultor') && consultant && (
          <div className="px-10 py-5 border-t border-neutral-200 mt-auto">
            <div className="flex items-center gap-4">
              {/* Square photo, anchored just below the top so the face shows
                   without giving up too much of the body. */}
              {consultantProfile?.profile_photo_url ? (
                <div className="relative h-20 w-20 rounded-md overflow-hidden shrink-0 border">
                  <Image
                    src={consultantProfile.profile_photo_url}
                    alt={consultant.commercial_name || 'Consultor'}
                    fill
                    className="object-cover object-[50%_18%]"
                    unoptimized
                    sizes="80px"
                  />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-md bg-neutral-900 text-white flex items-center justify-center font-medium text-2xl shrink-0">
                  {(consultant.commercial_name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base text-neutral-900">
                  {consultant.commercial_name}
                </div>
                <div className="text-[10px] tracking-wider uppercase text-neutral-500">
                  {text(overrides.consultor?.tagline, 'Consultor Imobiliário · Infinity Group')}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-[11px] text-neutral-700 shrink-0">
                {consultantProfile?.phone_commercial && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-neutral-500" />
                    {consultantProfile.phone_commercial}
                  </div>
                )}
                {consultant.professional_email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-neutral-500" />
                    {consultant.professional_email}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── PAGE 2: Gallery + map ── */}
      {(has('galeria') && galleryImages.length > 0) || (has('localizacao') && mapUrl) ? (
        <section className="page flex flex-col">
          <PageBrand externalRef={property.external_ref} />

          {has('galeria') && galleryImages.length > 0 && (
            <div className="px-10 pt-5 pb-3">
              <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-3">
                {text(overrides.galeria?.heading, 'Galeria')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {galleryImages.slice(0, 6).map((img) => (
                  <div
                    key={img.id}
                    className="relative aspect-[4/3] bg-neutral-100 rounded-md overflow-hidden"
                  >
                    <Image
                      src={img.url}
                      alt={img.ai_room_label || ''}
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="240px"
                    />
                    {img.ai_room_label && (
                      <div className="absolute bottom-1 left-1 bg-neutral-900/80 text-white px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider backdrop-blur-sm">
                        {img.ai_room_label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {has('localizacao') && mapUrl && (
            <div className="px-10 pt-3 pb-3">
              <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-2">
                {text(overrides.localizacao?.heading, 'Localização')}
              </div>
              {/* Plain <img> to bypass Next/Image caching and ensure it renders in puppeteer */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapUrl}
                alt="Mapa"
                className="w-full h-[220px] object-cover rounded-md border"
              />
              {(property.address_street || property.city) && (
                <div className="mt-2 text-[11px] text-neutral-700 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-neutral-500" />
                  {[property.address_street, property.zone, property.city].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          )}

          <PageFooter externalRef={property.external_ref} />
        </section>
      ) : null}

      {/* ── Extra PAGES: one per planta (with 3D render if present) ── */}
      {has('plantas') &&
        plantas.map((planta: any, idx: number) => {
          const render = rendersByPlanta.get(planta.id)?.[0]
          const isPdf = planta.url?.toLowerCase?.().endsWith('.pdf')
          return (
            <section
              key={`planta-${planta.id}`}
              className="page flex flex-col"
            >
              <PageBrand externalRef={property.external_ref} />

              <div className="px-10 pt-6 pb-2">
                <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-1.5">
                  Planta
                </div>
                <h2 className="serif text-2xl font-medium text-neutral-900">
                  Planta {plantas.length > 1 ? `${idx + 1} de ${plantas.length}` : ''}
                </h2>
              </div>

              <div className={cn(
                'flex-1 min-h-0 px-10 pb-4 grid grid-cols-1 gap-3',
                render ? 'grid-rows-2' : 'grid-rows-1',
              )}>
                <div className="relative rounded-md overflow-hidden border bg-neutral-50">
                  {isPdf ? (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-xs">
                      Planta em PDF — consultar anexo
                    </div>
                  ) : (
                    <Image
                      src={planta.url}
                      alt="Planta"
                      fill
                      className="object-contain p-3"
                      unoptimized
                      sizes="720px"
                    />
                  )}
                  <div className="absolute top-2 left-2 bg-neutral-900/85 text-white px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                    Planta
                  </div>
                </div>
                {render && (
                  <div className="relative rounded-md overflow-hidden border bg-neutral-100">
                    <Image
                      src={render.url}
                      alt="Render 3D"
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="720px"
                    />
                    <div className="absolute top-2 left-2 bg-neutral-900/85 text-white px-2 py-0.5 rounded text-[9px] uppercase tracking-wider flex items-center gap-1">
                      <Layers className="h-2.5 w-2.5" /> Render 3D
                    </div>
                  </div>
                )}
              </div>

              <PageFooter externalRef={property.external_ref} />
            </section>
          )
        })}

      {/* ── Extra PAGES: one per staged image (before / after) ── */}
      {has('staging') &&
        stagedImages.map((img: any, idx: number) => (
          <section
            key={`staging-${img.id}`}
            className="page flex flex-col"
          >
            <PageBrand externalRef={property.external_ref} />

            <div className="px-10 pt-6 pb-2">
              <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Virtual Staging
              </div>
              <h2 className="serif text-2xl font-medium text-neutral-900 capitalize">
                {img.ai_room_label || `Ambiente ${idx + 1}`}
              </h2>
            </div>

            <div className="flex-1 min-h-0 px-10 pb-4 grid grid-cols-1 grid-rows-2 gap-3">
              <div className="relative rounded-md overflow-hidden border bg-neutral-100">
                <Image
                  src={img.url}
                  alt="Original"
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="720px"
                />
                <div className="absolute top-2 left-2 bg-neutral-900/85 text-white px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                  Antes
                </div>
              </div>
              <div className="relative rounded-md overflow-hidden border bg-neutral-100">
                <Image
                  src={img.ai_staged_url}
                  alt="Virtual Staging"
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="720px"
                />
                <div className="absolute top-2 left-2 bg-neutral-900/85 text-white px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                  Depois
                </div>
              </div>
            </div>

            <PageFooter externalRef={property.external_ref} />
          </section>
        ))}
    </div>
  )
}

function PageHeader({ externalRef }: { externalRef?: string | null }) {
  // No-op kept for parity with other layouts; page brand is rendered per-page.
  return null
}

function PageBrand({ externalRef }: { externalRef?: string | null }) {
  return (
    <div className="px-10 pt-8 pb-4 flex items-center justify-between border-b border-neutral-200">
      <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-600">
        Infinity Group
      </div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500">
        {externalRef ? `Ref. ${externalRef}` : ''}
      </div>
    </div>
  )
}

function PageFooter({ externalRef }: { externalRef?: string | null }) {
  return (
    <div className="px-10 py-3 mt-auto border-t border-neutral-200">
      <div className="flex items-center justify-between gap-4">
        {/* Franchise logos */}
        <div className="flex items-center gap-3 shrink-0">
          <Image
            src={REMAX_LOGO_PATH}
            alt="RE/MAX"
            width={28}
            height={28}
            className="h-6 w-auto object-contain"
            unoptimized
          />
          <Image
            src={REMAX_COLLECTION_CONVICTUS_LOGO_PATH}
            alt="RE/MAX Collection Convictus"
            width={56}
            height={28}
            className="h-6 w-auto object-contain"
            unoptimized
          />
        </div>
        {/* Two clean lines: brand on top, legal/AMI below */}
        <div className="flex-1 text-center">
          <div className="text-[9px] tracking-[0.2em] uppercase text-neutral-700 leading-tight">
            Infinity Group · infinitygroup.pt
          </div>
          <div className="text-[9px] tracking-[0.18em] uppercase text-neutral-400 leading-tight mt-0.5">
            {AGENCY_INDEPENDENCE_NOTICE} · {AGENCY_FOOTER_LINE}
          </div>
        </div>
        <div className="text-[10px] tracking-wider text-neutral-400 shrink-0">{externalRef || ''}</div>
      </div>
    </div>
  )
}

function RichDescriptionFicha({ text }: { text: string }) {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const hasHtml = /<(strong|br|p|ul|li|em|b|i)[\s>/]/i.test(text)
  let html = hasHtml ? text : escape(text)
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/(?<!\n)\n(?!\n)/g, '<br/>')
  const len = text.length
  const sizeClass =
    len < 400
      ? 'text-[13px] leading-[1.55]'
      : len < 900
        ? 'text-[12px] leading-[1.5]'
        : len < 1500
          ? 'text-[11px] leading-[1.45]'
          : 'text-[10px] leading-[1.4]'
  return (
    <div
      className={`text-neutral-700 ${sizeClass} [&_strong]:text-neutral-900 [&_strong]:font-semibold [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-0.5`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-neutral-700" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] tracking-wider uppercase text-neutral-500">{label}</div>
        <div className="text-[13px] font-medium text-neutral-900 leading-tight truncate">{value}</div>
      </div>
    </div>
  )
}
