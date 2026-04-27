'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ChevronLeft,
  ChevronRight,
  X,
  Camera,
  Phone,
  Mail,
  MapPin,
  Euro,
  Briefcase,
  Share2,
  ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { toast } from 'sonner'

const TIPO_LABELS: Record<string, string> = {
  comprador: 'Comprador',
  vendedor: 'Vendedor',
  arrendatario: 'Arrendatário',
  arrendador: 'Arrendador',
}

interface Photo {
  url: string
  momentType: string
  caption: string | null
}

export interface NegocioApresentacaoData {
  id: string
  tipo: string | null
  pipelineStageName: string | null
  pipelineStageColor: string | null
  temperatura: string | null
  isExternalProperty: boolean
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  propertyAddress: string | null
  externalPropertyTypology: string | null
  externalPropertyZone: string | null
  expectedValue: number | null
  expectedCloseDate: string | null
  origem: string | null
  classeImovel: string | null
  quartos: number | null
  areaM2: number | null
  observacoes: string | null
  consultantId: string | null
  consultantName: string | null
  consultantPhotoUrl: string | null
  consultantEmail: string | null
  consultantPhone: string | null
  dealValue: number | null
  dealCommissionPct: number | null
  dealCommissionTotal: number | null
  dealStatus: string | null
}

interface Props {
  data: NegocioApresentacaoData
  photos: Photo[]
  onOpenMomentos: () => void
}

const fmtMoney = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), "d 'de' MMM yyyy", { locale: pt })
  } catch {
    return '—'
  }
}

export function NegocioApresentacaoView({ data, photos, onOpenMomentos }: Props) {
  const [section, setSection] = useState<'descricao' | 'detalhes'>('descricao')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const cover = photos[0] ?? null
  const others = photos.slice(1, 5)
  const remaining = Math.max(0, photos.length - 5)

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar')
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top toolbar — title + action buttons */}
      <div className="flex items-center justify-center lg:justify-between">
        <h1 className="hidden lg:block text-xl sm:text-2xl font-bold tracking-tight">Apresentação</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={handleShare}
            title="Copiar link"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ── Main column (gallery + below) ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Gallery */}
          {photos.length === 0 ? (
            <div className="aspect-[16/10] rounded-2xl border border-dashed bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex flex-col items-center justify-center gap-3">
              <div className="relative h-20 w-20 opacity-50">
                <Image src="/icon-512.png" alt="Infinity Group" fill className="object-contain" />
              </div>
              <p className="text-xs text-muted-foreground tracking-wide uppercase">
                Sem momentos ainda
              </p>
              <Button size="sm" variant="outline" onClick={onOpenMomentos} className="gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                Adicionar momento
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-3">
              {cover && (
                <button
                  type="button"
                  onClick={() => setLightboxIdx(0)}
                  className="relative sm:col-span-2 aspect-[16/11] rounded-2xl overflow-hidden bg-muted group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover.url}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </button>
              )}
              {others.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {others.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxIdx(i + 1)}
                      className="relative aspect-square rounded-xl overflow-hidden bg-muted group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                      {i === others.length - 1 && remaining > 0 && (
                        <div className="absolute inset-0 bg-black/60 text-white flex items-center justify-center font-semibold text-lg">
                          +{remaining}
                        </div>
                      )}
                    </button>
                  ))}
                  {/* Empty slots for visual balance */}
                  {Array.from({ length: Math.max(0, 4 - others.length) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="aspect-square rounded-xl border border-dashed bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center"
                    >
                      <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Title + meta */}
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{data.leadName}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {data.tipo && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {TIPO_LABELS[data.tipo] ?? data.tipo}
                </span>
              )}
              {(data.classeImovel || data.quartos != null || data.areaM2 != null) && (
                <span className="inline-flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  {[
                    data.classeImovel,
                    data.quartos != null ? `${data.quartos} quartos` : null,
                    data.areaM2 != null ? `${data.areaM2} m²` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
              {(data.propertyAddress || data.externalPropertyZone) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {data.propertyAddress ?? data.externalPropertyZone}
                </span>
              )}
            </div>
          </div>

          {/* Sub-tabs (Descrição / Detalhes) */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30 w-fit">
            {([['descricao', 'Descrição'], ['detalhes', 'Detalhes']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className={cn(
                  'px-3.5 py-1 rounded-full text-[11px] font-medium transition-all',
                  section === key
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sub-tab content */}
          {section === 'descricao' && (
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Sobre este negócio</h3>
              {photos[0]?.caption ? (
                <p className="text-sm leading-relaxed whitespace-pre-line">{photos[0].caption}</p>
              ) : data.observacoes ? (
                <p className="text-sm leading-relaxed whitespace-pre-line">{data.observacoes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sem descrição. Adiciona observações no resumo, ou captura um momento de marketing
                  para gerar uma legenda automática.
                </p>
              )}
            </div>
          )}

          {section === 'detalhes' && (
            <div className="rounded-2xl border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">Detalhes do negócio</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Tipo</dt>
                  <dd>{data.tipo ? TIPO_LABELS[data.tipo] ?? data.tipo : '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Estado</dt>
                  <dd>{data.pipelineStageName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Origem</dt>
                  <dd>{data.origem ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Temperatura</dt>
                  <dd>{data.temperatura ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Previsão de fecho</dt>
                  <dd>{fmtDate(data.expectedCloseDate)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">Tipologia</dt>
                  <dd>{data.externalPropertyTypology ?? data.classeImovel ?? '—'}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Big value box */}
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {data.tipo === 'comprador' || data.tipo === 'arrendatario' ? 'Comprar pelo preço' :
               data.tipo === 'vendedor' ? 'Vender pelo preço' :
               data.tipo === 'arrendador' ? 'Renda mensal' : 'Valor'}
            </p>
            <p className="text-3xl font-bold tracking-tight">
              {fmtMoney(data.expectedValue ?? data.dealValue)}
            </p>

            {data.tipo && (
              <div className="text-xs text-muted-foreground border-t pt-3">
                {TIPO_LABELS[data.tipo] ?? data.tipo}
                {data.classeImovel && ` · ${data.classeImovel}`}
              </div>
            )}

            {data.dealCommissionPct != null && (
              <div className="space-y-1 border-t pt-3">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Comissão acordada</p>
                <p className="text-sm font-semibold">{data.dealCommissionPct}%</p>
                {data.dealCommissionTotal != null && (
                  <p className="text-[10px] text-muted-foreground">{fmtMoney(data.dealCommissionTotal)}</p>
                )}
              </div>
            )}
          </div>

          {/* Consultor card */}
          {data.consultantName && (
            <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
              <Avatar className="h-11 w-11 border">
                {data.consultantPhotoUrl && (
                  <AvatarImage src={data.consultantPhotoUrl} alt={data.consultantName} />
                )}
                <AvatarFallback className="text-xs">
                  {data.consultantName.split(' ').slice(0, 2).map((p) => p[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{data.consultantName}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Consultor responsável</p>
              </div>
              <div className="flex items-center gap-1">
                {data.consultantPhone && (
                  <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded-full">
                    <a href={`tel:${data.consultantPhone}`} title="Telefone">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                {data.consultantEmail && (
                  <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded-full">
                    <a href={`mailto:${data.consultantEmail}`} title="Email">
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Lead contact (mini-card) */}
          {(data.leadEmail || data.leadPhone) && (
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Lead</p>
              <p className="text-sm font-medium">{data.leadName}</p>
              <div className="flex flex-col gap-1.5 text-xs">
                {data.leadPhone && (
                  <a href={`tel:${data.leadPhone}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {data.leadPhone}
                  </a>
                )}
                {data.leadEmail && (
                  <a href={`mailto:${data.leadEmail}`} className="inline-flex items-center gap-1.5 hover:underline truncate">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {data.leadEmail}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Informações Gerais */}
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Informações Gerais</p>
            <dl className="space-y-2.5 text-sm">
              <KV label="Estado">
                {data.pipelineStageName ? (
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={data.pipelineStageColor ? { borderColor: data.pipelineStageColor, color: data.pipelineStageColor } : undefined}
                  >
                    {data.pipelineStageName}
                  </Badge>
                ) : '—'}
              </KV>
              <KV label="Tipo">{data.tipo ? TIPO_LABELS[data.tipo] ?? data.tipo : '—'}</KV>
              <KV label="Origem">{data.origem ?? '—'}</KV>
              <KV label="Temperatura">{data.temperatura ?? '—'}</KV>
              <KV label="Imóvel">
                {data.isExternalProperty ? (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <Briefcase className="h-3 w-3" /> Externo
                  </span>
                ) : data.propertyAddress ? 'Interno' : '—'}
              </KV>
              {data.dealStatus && <KV label="Deal">{data.dealStatus}</KV>}
            </dl>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && photos[lightboxIdx] && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur z-50 flex items-center justify-center p-6"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null) }}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxIdx > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i ?? 0) - 1) }}
              className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {lightboxIdx < photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i ?? 0) + 1) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightboxIdx].url}
            alt=""
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium text-right">{children}</dd>
    </div>
  )
}

// Suppress unused import warnings for future-proof imports
void Link
void Euro
