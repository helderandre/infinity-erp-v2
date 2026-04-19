'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
  BedDouble, Bath, Maximize, Car, MapPin, Phone, Mail, Calendar, Layers, Sparkles, Building2,
} from 'lucide-react'
import {
  formatArea, PROPERTY_TYPES, BUSINESS_TYPES, ENERGY_CERTIFICATES, PROPERTY_CONDITIONS,
} from '@/lib/constants'

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
  const plantas = allMedia.filter((m) => m.media_type === 'planta')
  const cover = images.find((m) => m.is_cover) ?? images[0]

  const has = (key: string) => sections.includes(key)

  const price =
    property.listing_price != null
      ? new Intl.NumberFormat('de-DE', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Number(property.listing_price))
      : null

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const mapUrl =
    property.latitude && property.longitude && token
      ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+111111(${property.longitude},${property.latitude})/${property.longitude},${property.latitude},14/800x400@2x?access_token=${token}`
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

      {/* ── PAGE 1: Cover + key info ── */}
      <section className="page flex flex-col">
        {/* Header brand bar */}
        <div className="px-10 pt-8 pb-4 flex items-center justify-between border-b border-neutral-200">
          <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-600">
            Infinity Group
          </div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500">
            {property.external_ref ? `Ref. ${property.external_ref}` : ''}
          </div>
        </div>

        {/* Cover image */}
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

        {/* Title + price block */}
        <div className="px-10 pt-5 pb-3">
          <div className="text-[9px] tracking-[0.3em] uppercase text-neutral-500 mb-1">
            {(property.business_type &&
              BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES]) ||
              'Imóvel'}
            {property.property_type &&
              ` · ${PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] || property.property_type}`}
          </div>
          <div className="flex items-end justify-between gap-4">
            <h1 className="serif text-3xl leading-tight font-medium text-neutral-900 flex-1">
              {property.title || 'Sem título'}
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

        {/* Stats grid */}
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

        {/* Description */}
        {has('descricao') && property.description && (
          <div className="px-10 py-4 border-t border-neutral-200 flex-1 overflow-hidden">
            <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-2">
              Sobre este imóvel
            </div>
            <RichDescriptionFicha text={property.description} />
          </div>
        )}

        {/* Footer: consultant */}
        {has('consultor') && consultant && (
          <div className="px-10 py-4 border-t border-neutral-200 mt-auto">
            <div className="flex items-center gap-3">
              {consultantProfile?.profile_photo_url ? (
                <div className="relative h-12 w-12 rounded-full overflow-hidden shrink-0 border">
                  <Image
                    src={consultantProfile.profile_photo_url}
                    alt={consultant.commercial_name || 'Consultor'}
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="48px"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-full bg-neutral-900 text-white flex items-center justify-center font-medium shrink-0">
                  {(consultant.commercial_name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-neutral-900">
                  {consultant.commercial_name}
                </div>
                <div className="text-[10px] tracking-wider uppercase text-neutral-500">
                  Consultor Infinity Group
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-[11px] text-neutral-700">
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

      {/* ── PAGE 2: Gallery + plantas + map ── */}
      <section className="page flex flex-col">
        <div className="px-10 pt-8 pb-3 flex items-center justify-between border-b border-neutral-200">
          <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-600">
            Infinity Group
          </div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500">
            {property.external_ref ? `Ref. ${property.external_ref}` : ''}
          </div>
        </div>

        {/* Gallery grid — up to 6 images */}
        {has('galeria') && images.length > 0 && (
          <div className="px-10 pt-5 pb-3">
            <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-3">
              Galeria
            </div>
            <div className="grid grid-cols-3 gap-2">
              {images.slice(0, 6).map((img) => (
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

        {/* Plantas */}
        {has('plantas') && plantas.length > 0 && (
          <div className="px-10 pt-3 pb-3">
            <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-2">
              Planta{plantas.length > 1 ? 's' : ''}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {plantas.slice(0, 2).map((planta, i) => (
                <div
                  key={i}
                  className="relative aspect-[4/3] bg-neutral-50 rounded-md overflow-hidden border"
                >
                  {!planta.url.toLowerCase().endsWith('.pdf') && (
                    <Image
                      src={planta.url}
                      alt="Planta"
                      fill
                      className="object-contain p-2"
                      unoptimized
                      sizes="360px"
                    />
                  )}
                  <div className="absolute top-1 left-1 bg-neutral-900/85 text-white px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">
                    Planta {plantas.length > 1 ? i + 1 : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map */}
        {has('localizacao') && mapUrl && (
          <div className="px-10 pt-3 pb-3">
            <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-2">
              Localização
            </div>
            <div className="relative h-[200px] bg-neutral-100 rounded-md overflow-hidden border">
              <Image src={mapUrl} alt="Mapa" fill className="object-cover" unoptimized sizes="720px" />
            </div>
            {(property.address_street || property.city) && (
              <div className="mt-2 text-[11px] text-neutral-700 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-neutral-500" />
                {[property.address_street, property.zone, property.city].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Footer brand */}
        <div className="px-10 py-3 mt-auto border-t border-neutral-200 flex items-center justify-between">
          <div className="text-[10px] tracking-[0.3em] uppercase text-neutral-500">
            Infinity Group · infinitygroup.pt
          </div>
          <div className="text-[10px] tracking-wider text-neutral-400">
            {property.external_ref || ''}
          </div>
        </div>
      </section>
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
