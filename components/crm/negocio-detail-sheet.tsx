// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  Copy,
  Euro,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Home,
  Info,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Ruler,
  Sparkles,
  StickyNote,
  Thermometer,
  Trash2,
  User as UserIcon,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import { NEGOCIO_PROPERTY_STATUS, VISIT_STATUS_COLORS } from '@/lib/constants'

import {
  TemperaturaSelector,
  temperaturaEmoji,
  type Temperatura,
} from '@/components/negocios/temperatura-selector'
import { EstadoPipelineSelector } from '@/components/negocios/estado-pipeline-selector'
import { ObservationsButton } from '@/components/crm/observations-dialog'
import { AiFillDialog } from '@/components/negocios/ai-fill-dialog'
import { VisitForm } from '@/components/visits/visit-form'
import { NegocioDocumentsFoldersView } from '@/components/negocios/negocio-documents-folders-view'
import { SendPropertiesDialog } from '@/components/negocios/send-properties-dialog'
import { PropertyDetailSheet } from '@/components/properties/property-detail-sheet'

interface NegocioDetailSheetProps {
  negocioId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TabKey = 'detalhes' | 'matching' | 'imoveis' | 'visitas' | 'interessados' | 'documentos'

const TEMP_COLORS: Record<string, string> = {
  Frio: '#3b82f6',
  Morno: '#f59e0b',
  Quente: '#ef4444',
}

const TIPO_COLORS: Record<string, string> = {
  Compra: '#2563eb',
  Venda: '#16a34a',
  'Compra e Venda': '#7c3aed',
  Arrendatário: '#f59e0b',
  Arrendador: '#0891b2',
  Outro: '#64748b',
}

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copiado')
  } catch {
    toast.error('Não foi possível copiar')
  }
}

function formatRange(min: number | null, max: number | null, suffix = ''): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) {
    if (min === max) return `${eur.format(min)}${suffix}`
    return `${eur.format(min)} – ${eur.format(max)}${suffix}`
  }
  if (min != null) return `desde ${eur.format(min)}${suffix}`
  return `até ${eur.format(max!)}${suffix}`
}

export function NegocioDetailSheet({ negocioId, open, onOpenChange }: NegocioDetailSheetProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()

  const [negocio, setNegocio] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('detalhes')
  const [aiFillOpen, setAiFillOpen] = useState(false)
  // Property preview: when set, the shared PropertyDetailSheet opens on top
  // (rendered as a sibling outside this Sheet so its clicks don't bubble back
  // through the negócio sheet).
  const [previewPropertyId, setPreviewPropertyId] = useState<string | null>(null)

  const loadNegocio = useCallback(async () => {
    if (!negocioId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNegocio(data)
      setForm(data)
    } catch {
      toast.error('Erro ao carregar negócio')
      setNegocio(null)
    } finally {
      setLoading(false)
    }
  }, [negocioId])

  useEffect(() => {
    if (!open || !negocioId) {
      setNegocio(null)
      setForm({})
      setActiveTab('detalhes')
      return
    }
    loadNegocio()
  }, [open, negocioId, loadNegocio])

  const updateField = useCallback((field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const saveFields = useCallback(
    async (patch: Record<string, unknown>, successMessage?: string) => {
      if (!negocioId) return
      try {
        const res = await fetch(`/api/negocios/${negocioId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error()
        setForm((prev) => ({ ...prev, ...patch }))
        if (successMessage) toast.success(successMessage)
      } catch {
        toast.error('Erro ao guardar')
      }
    },
    [negocioId],
  )

  const handleTemperaturaChange = useCallback(
    async (next: Temperatura) => {
      updateField('temperatura', next)
      await saveFields({ temperatura: next })
    },
    [saveFields, updateField],
  )

  const handlePipelineStageChange = useCallback(
    async (stage: { id: string; name: string }) => {
      updateField('pipeline_stage_id', stage.id)
      updateField('estado', stage.name)
      await saveFields({ pipeline_stage_id: stage.id }, 'Fase actualizada')
    },
    [saveFields, updateField],
  )

  const handleSaveObservations = useCallback(
    async (next: string | null) => {
      if (!negocioId) return
      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacoes: next }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setForm((prev) => ({ ...prev, observacoes: next }))
    },
    [negocioId],
  )

  const handleQuickFillApply = useCallback(
    async (fields: Record<string, unknown>) => {
      await saveFields(fields, 'Dados preenchidos')
    },
    [saveFields],
  )

  const tipo = (form.tipo as string) || negocio?.tipo || ''
  const isBuyerType = ['Compra', 'Compra e Venda', 'Arrendatário'].includes(tipo)
  const isSellerType = ['Venda', 'Compra e Venda', 'Arrendador'].includes(tipo)

  const tabs = useMemo<{ key: TabKey; label: string; icon: React.ElementType }[]>(() => {
    const list: { key: TabKey; label: string; icon: React.ElementType }[] = [
      { key: 'detalhes', label: 'Detalhes', icon: Info },
    ]
    if (isBuyerType) list.push({ key: 'matching', label: 'Matching', icon: Sparkles })
    list.push({ key: 'imoveis', label: 'Imóveis', icon: Home })
    list.push({ key: 'visitas', label: 'Visitas', icon: CalendarIcon })
    if (isSellerType) list.push({ key: 'interessados', label: 'Interessados', icon: Users })
    list.push({ key: 'documentos', label: 'Documentos', icon: FileText })
    return list
  }, [isBuyerType, isSellerType])

  const leadId = negocio?.lead_id ?? null
  const fullPageHref =
    leadId && negocio?.id ? `/dashboard/leads/${leadId}/negocios/${negocio.id}` : null

  const lead = negocio?.lead
  const clientName = lead?.full_name || lead?.nome || 'Negócio'

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[820px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 sm:pt-10 gap-0 flex-row items-start justify-between">
          <div className="min-w-0">
            <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight truncate">
              {clientName}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Detalhes do negócio.
            </SheetDescription>
          </div>
          {fullPageHref && (
            <div className="flex items-center gap-2 mr-10 shrink-0">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full h-8 text-xs gap-1.5"
              >
                <Link href={fullPageHref} onClick={() => onOpenChange(false)}>
                  Ver tudo
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </SheetHeader>

        {loading || !negocio ? (
          <DetailSkeleton />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="px-6 space-y-4 pb-10">
              {/* Tab selector — centered pills */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-background border border-border/50 w-fit max-w-full mx-auto overflow-x-auto">
                {tabs.map((t) => {
                  const Icon = t.icon
                  const isActive = activeTab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0',
                        isActive ? 'bg-foreground text-background px-3.5' : 'text-muted-foreground hover:text-foreground h-8 w-8',
                      )}
                      title={t.label}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {isActive && <span>{t.label}</span>}
                    </button>
                  )
                })}
              </div>

              {activeTab === 'detalhes' && (
                <DetalhesTab
                  negocio={negocio}
                  form={form}
                  tipo={tipo}
                  isBuyerType={isBuyerType}
                  onPipelineStageChange={handlePipelineStageChange}
                  onTemperaturaChange={handleTemperaturaChange}
                  onSaveObservations={handleSaveObservations}
                  onOpenAiFill={() => setAiFillOpen(true)}
                />
              )}
              {activeTab === 'matching' && negocio.id && (
                <MatchingTab
                  negocioId={negocio.id}
                  onDossierChanged={loadNegocio}
                  onPreviewProperty={setPreviewPropertyId}
                />
              )}
              {activeTab === 'imoveis' && negocio.id && (
                <ImoveisTab
                  negocioId={negocio.id}
                  leadId={leadId}
                  userId={user?.id}
                  onPreviewProperty={setPreviewPropertyId}
                />
              )}
              {activeTab === 'visitas' && leadId && (
                <VisitasTab leadId={leadId} userId={user?.id} />
              )}
              {activeTab === 'interessados' && negocio.id && (
                <InteressadosTab negocioId={negocio.id} />
              )}
              {activeTab === 'documentos' && negocio.id && (
                <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-4">
                  <NegocioDocumentsFoldersView negocioId={negocio.id} />
                </div>
              )}
            </div>
          </div>
        )}

        {negocio?.id && (
          <AiFillDialog
            open={aiFillOpen}
            onOpenChange={setAiFillOpen}
            negocioId={negocio.id}
            onApply={handleQuickFillApply}
          />
        )}
      </SheetContent>
    </Sheet>
    <PropertyDetailSheet
      propertyId={previewPropertyId}
      open={!!previewPropertyId}
      onOpenChange={(o) => { if (!o) setPreviewPropertyId(null) }}
    />
    </>
  )
}

// ─── Detalhes Tab ──────────────────────────────────────────────────────

// Amenities (matches the page + matching API label table, emojis from negocio-data-card)
const AMENITY_ITEMS: { field: string; emoji: string; label: string }[] = [
  { field: 'tem_elevador', emoji: '🏗️', label: 'Elevador' },
  { field: 'tem_estacionamento', emoji: '🅿️', label: 'Estacionamento' },
  { field: 'tem_garagem', emoji: '🚗', label: 'Garagem' },
  { field: 'tem_exterior', emoji: '🌿', label: 'Exterior' },
  { field: 'tem_varanda', emoji: '🌸', label: 'Varanda' },
  { field: 'tem_piscina', emoji: '🏊', label: 'Piscina' },
  { field: 'tem_porteiro', emoji: '🔒', label: 'Porteiro' },
  { field: 'tem_arrumos', emoji: '📦', label: 'Arrumos' },
  { field: 'tem_carregamento_ev', emoji: '🔌', label: 'Carregamento EV' },
  { field: 'tem_praia', emoji: '🏖️', label: 'Praia' },
  { field: 'tem_quintal', emoji: '🌳', label: 'Quintal' },
  { field: 'tem_terraco', emoji: '☀️', label: 'Terraço' },
  { field: 'tem_jardim', emoji: '🌻', label: 'Jardim' },
  { field: 'tem_mobilado', emoji: '🛋️', label: 'Mobilado' },
  { field: 'tem_arrecadacao', emoji: '🗄️', label: 'Arrecadação' },
  { field: 'tem_aquecimento', emoji: '🔥', label: 'Aquecimento' },
  { field: 'tem_cozinha_equipada', emoji: '🍳', label: 'Cozinha Eq.' },
  { field: 'tem_campo', emoji: '🌾', label: 'Campo' },
  { field: 'tem_urbano', emoji: '🏙️', label: 'Urbano' },
  { field: 'tem_ar_condicionado', emoji: '❄️', label: 'AC' },
  { field: 'tem_energias_renovaveis', emoji: '♻️', label: 'Renováveis' },
  { field: 'tem_gas', emoji: '🔵', label: 'Gás' },
  { field: 'tem_seguranca', emoji: '🛡️', label: 'Segurança' },
  { field: 'tem_transportes', emoji: '🚇', label: 'Transportes' },
  { field: 'tem_vistas', emoji: '🏔️', label: 'Vistas' },
]

function DetalhesTab({
  negocio,
  form,
  tipo,
  isBuyerType,
  onPipelineStageChange,
  onTemperaturaChange,
  onSaveObservations,
  onOpenAiFill,
}: {
  negocio: any
  form: Record<string, unknown>
  tipo: string
  isBuyerType: boolean
  onPipelineStageChange: (stage: { id: string; name: string }) => void
  onTemperaturaChange: (t: Temperatura) => void
  onSaveObservations: (next: string | null) => Promise<void>
  onOpenAiFill: () => void
}) {
  const lead = negocio.lead
  const clientName = lead?.full_name || lead?.nome || 'Cliente'
  const phone = lead?.telemovel || lead?.telefone || null
  const email = lead?.email || null
  const estado = (form.estado as string) || negocio.estado || 'Aberto'
  const pipelineStageId =
    (form.pipeline_stage_id as string) || (negocio.pipeline_stage_id as string | undefined) || null
  const temperatura = (form.temperatura as Temperatura) || null
  const observacoes = (form.observacoes as string | null) ?? null

  const isArrendatario = tipo === 'Arrendatário'
  const isArrendador = tipo === 'Arrendador'

  const priceLabel = isArrendatario
    ? 'Renda máxima'
    : isArrendador
      ? 'Renda pretendida'
      : isBuyerType
        ? 'Orçamento'
        : 'Preço pretendido'

  const price = (() => {
    if (isArrendatario) return formatRange(null, (form.renda_max_mensal as number) ?? null, '/mês')
    if (isArrendador) return formatRange(null, (form.renda_pretendida as number) ?? null, '/mês')
    if (isBuyerType) return formatRange((form.orcamento as number) ?? null, (form.orcamento_max as number) ?? null)
    return formatRange((form.preco_venda as number) ?? null, (form.preco_venda_max as number) ?? null)
  })()

  const quartosLabel = (() => {
    const min = (form.quartos_min as number | null) ?? null
    const max = (form.quartos_max as number | null) ?? null
    const exact = (form.quartos as number | null) ?? null
    if (exact != null && min == null && max == null) return `T${exact}`
    if (min == null && max == null) return null
    if (min != null && max != null) {
      if (min === max) return `T${min}`
      return `T${min} – T${max}`
    }
    if (min != null) return `T${min}+`
    return `até T${max}`
  })()

  const wc = (form.wc_min as number | null) ?? (form.num_wc as number | null) ?? (form.casas_banho as number | null) ?? null
  const areaMin = (form.area_min_m2 as number | null) ?? null
  const areaExact = (form.area_m2 as number | null) ?? null
  const areaLabel = areaMin != null ? `≥ ${areaMin} m²` : areaExact != null ? `${areaExact} m²` : null

  // Zonas chip list (also supports distrito/concelho/freguesia fallbacks)
  const zones: string[] = (() => {
    const raw = (form.localizacao as string | null) ?? ''
    const split = raw.split(',').map((z) => z.trim()).filter(Boolean)
    if (split.length > 0) return split
    const fallback = [form.distrito, form.concelho, form.freguesia]
      .filter(Boolean)
      .map((v) => String(v))
    return fallback
  })()

  const isVendaCompra = tipo === 'Compra e Venda'

  const motivacao = (form.motivacao_compra as string | null) ?? null
  const prazo = (form.prazo_compra as string | null) ?? null
  const financiamento = (form.financiamento_necessario as boolean | null) ?? null
  const situacaoProfissional = (form.situacao_profissional as string | null) ?? null
  const rendimento = (form.rendimento_mensal as number | null) ?? null
  const fiador = (form.tem_fiador as boolean | null) ?? null
  const animais = (form.aceita_animais as boolean | null) ?? null

  const estadoImovel = (form.estado_imovel as string | null) ?? null
  const classeImovel = (form.classe_imovel as string | null) ?? null

  const tipoColor = (tipo && TIPO_COLORS[tipo]) || '#64748b'
  const tempEmoji = temperaturaEmoji(temperatura ?? undefined)

  return (
    <div className="space-y-3">
      {/* Editable status strip — same controls as the page hero */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <EstadoPipelineSelector
          tipo={tipo}
          pipelineStageId={pipelineStageId}
          fallbackLabel={estado}
          onChange={onPipelineStageChange}
        />
        {tipo && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ backgroundColor: `${tipoColor}22`, color: tipoColor }}
          >
            <Briefcase className="h-3 w-3" />
            {tipo}
          </span>
        )}
        <TemperaturaSelector value={temperatura} onChange={onTemperaturaChange} />
        <ObservationsButton observacoes={observacoes} onSave={onSaveObservations} />
        <Button
          variant="outline"
          size="sm"
          className="rounded-full h-7 text-xs gap-1"
          onClick={onOpenAiFill}
        >
          <Sparkles className="h-3 w-3" />
          IA
        </Button>
        {temperatura && tempEmoji && (
          <span className="text-base ml-auto" aria-hidden>
            {tempEmoji}
          </span>
        )}
      </div>

      {/* Price + Client — side-by-side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {price && (
          <MiniCard>
            <SectionLabel icon={Euro}>{priceLabel}</SectionLabel>
            <p className="text-xl font-bold tabular-nums leading-tight">{price}</p>
          </MiniCard>
        )}
        {lead && (
          <MiniCard>
            <SectionLabel icon={UserIcon}>Cliente</SectionLabel>
            <p className="text-sm font-semibold truncate">{clientName}</p>
            {lead.empresa && (
              <p className="text-[11px] text-muted-foreground truncate">
                {lead.empresa}
                {lead.nipc ? ` · ${lead.nipc}` : ''}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {phone && (
                <a
                  href={`tel:${phone}`}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  title={phone}
                  className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
              )}
              {phone && (
                <button
                  type="button"
                  onClick={() => void copyToClipboard(phone)}
                  className="h-7 rounded-full bg-muted/60 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors truncate max-w-[140px]"
                  title="Copiar telemóvel"
                >
                  {phone}
                </button>
              )}
              {email && (
                <button
                  type="button"
                  onClick={() => void copyToClipboard(email)}
                  className="h-7 rounded-full bg-muted/60 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors truncate max-w-[160px]"
                  title="Copiar email"
                >
                  {email}
                </button>
              )}
            </div>
          </MiniCard>
        )}
      </div>

      {/* Resumo (procura + contexto) — only renders fields that are set */}
      {(() => {
        const procuraItems: { label: string; value: string }[] = []
        if (form.tipo_imovel) procuraItems.push({ label: 'Tipo', value: String(form.tipo_imovel) })
        if (quartosLabel) procuraItems.push({ label: 'Tipologia', value: quartosLabel })
        if (wc != null) procuraItems.push({ label: 'WCs', value: `≥ ${wc}` })
        if (areaLabel) procuraItems.push({ label: 'Área', value: areaLabel })
        if (estadoImovel) procuraItems.push({ label: 'Estado', value: estadoImovel })
        if (classeImovel) procuraItems.push({ label: 'Classe', value: classeImovel })

        const contextoItems: { label: string; value: string }[] = []
        if (motivacao) contextoItems.push({ label: 'Motivação', value: motivacao })
        if (prazo) contextoItems.push({ label: 'Prazo', value: prazo })
        if (financiamento !== null) {
          contextoItems.push({ label: 'Financiamento', value: financiamento ? 'Necessário' : 'Não necessário' })
        }
        if (isArrendatario) {
          if (situacaoProfissional) contextoItems.push({ label: 'Situação', value: situacaoProfissional })
          if (rendimento != null) contextoItems.push({ label: 'Rendimento', value: `${eur.format(rendimento)}/mês` })
          if (fiador !== null) contextoItems.push({ label: 'Fiador', value: fiador ? 'Sim' : 'Não' })
          if (animais !== null) contextoItems.push({ label: 'Aceita animais', value: animais ? 'Sim' : 'Não' })
        }

        const hasZones = zones.length > 0
        const hasProcura = procuraItems.length > 0
        const hasContexto = contextoItems.length > 0
        if (!hasZones && !hasProcura && !hasContexto) return null

        return (
          <MiniCard>
            <SectionLabel icon={Home}>
              {isArrendador || tipo === 'Venda' ? 'Imóvel' : 'O que procura'}
            </SectionLabel>
            {hasZones && (
              <div className="flex flex-wrap gap-1 mb-2.5">
                {zones.map((z) => (
                  <span
                    key={z}
                    className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-foreground/80"
                  >
                    <MapPin className="h-2.5 w-2.5" />
                    {z}
                  </span>
                ))}
              </div>
            )}
            {hasProcura && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {procuraItems.map((it) => (
                  <SpecItem key={it.label} label={it.label} value={it.value} />
                ))}
              </div>
            )}
            {hasContexto && (
              <>
                <div className="my-3 h-px bg-border/40" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {contextoItems.map((it) => (
                    <SpecItem key={it.label} label={it.label} value={it.value} />
                  ))}
                </div>
              </>
            )}
          </MiniCard>
        )
      })()}

      {/* Características — only enabled */}
      {(() => {
        const enabled = AMENITY_ITEMS.filter((a) => !!form[a.field])
        const enabledVenda = isVendaCompra
          ? AMENITY_ITEMS.filter((a) => !!form[`${a.field}_venda`])
          : []
        if (enabled.length === 0 && enabledVenda.length === 0) return null
        return (
          <MiniCard>
            {enabled.length > 0 && (
              <>
                <SectionLabel>Características</SectionLabel>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {enabled.map((a) => (
                    <AmenityChip key={a.field} emoji={a.emoji} label={a.label} />
                  ))}
                </div>
              </>
            )}
            {enabledVenda.length > 0 && (
              <>
                {enabled.length > 0 && <div className="my-3 h-px bg-border/40" />}
                <SectionLabel>Características (venda)</SectionLabel>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {enabledVenda.map((a) => (
                    <AmenityChip key={a.field} emoji={a.emoji} label={a.label} />
                  ))}
                </div>
              </>
            )}
          </MiniCard>
        )
      })()}

      {observacoes && (
        <MiniCard>
          <SectionLabel icon={StickyNote}>Observações</SectionLabel>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {observacoes}
          </p>
        </MiniCard>
      )}
    </div>
  )
}

// ─── Compact design primitives ────────────────────────────────────────

function MiniCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-background/90 border border-border/50 shadow-sm p-3.5', className)}>
      {children}
    </div>
  )
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </p>
  )
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  )
}

function AmenityChip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-foreground/80">
      <span aria-hidden>{emoji}</span>
      {label}
    </span>
  )
}

// ─── Matching Tab ──────────────────────────────────────────────────────

function MatchingTab({
  negocioId,
  onDossierChanged,
  onPreviewProperty,
}: {
  negocioId: string
  onDossierChanged: () => void
  onPreviewProperty: (id: string) => void
}) {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())

  const fetchMatches = useCallback(
    async (withScore = false) => {
      if (withScore) setScoring(true)
      else setLoading(true)
      try {
        const res = await fetch(
          `/api/negocios/${negocioId}/property-matches${withScore ? '?score=true' : ''}`,
        )
        if (res.ok) {
          const json = await res.json()
          setMatches(json.data || [])
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false)
        setScoring(false)
      }
    },
    [negocioId],
  )

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleAdd = async (match: any) => {
    setAddingIds((s) => {
      const n = new Set(s)
      n.add(match.id)
      return n
    })
    try {
      const res = await fetch(`/api/negocios/${negocioId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: match.id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Imóvel adicionado ao dossier')
      setMatches((prev) => prev.filter((m) => m.id !== match.id))
      onDossierChanged()
    } catch {
      toast.error('Erro ao adicionar imóvel')
    } finally {
      setAddingIds((s) => {
        const n = new Set(s)
        n.delete(match.id)
        return n
      })
    }
  }

  if (loading) return <ListSkeleton />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {matches.length > 0
            ? `${matches.length} ${matches.length === 1 ? 'compatível' : 'compatíveis'}`
            : 'Baseado no orçamento, localização e tipo'}
        </p>
        <div className="flex items-center gap-1.5">
          {matches.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-7 text-xs"
              disabled={scoring}
              onClick={() => fetchMatches(true)}
            >
              {scoring ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              Classificar IA
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-7 text-xs"
            onClick={() => fetchMatches()}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {matches.length === 0 ? (
        <EmptyHint icon={Sparkles} message="Sem imóveis compatíveis com este perfil." />
      ) : (
        <div className="space-y-2">
          {matches.map((p) => {
            const cover =
              p.dev_property_media?.find((m: any) => m.is_cover)?.url ||
              p.dev_property_media?.[0]?.url
            const specs = p.dev_property_specifications
            const score = p.match_score as number | null
            const scoreColor =
              score != null
                ? score >= 80
                  ? 'bg-emerald-500 text-white'
                  : score >= 60
                    ? 'bg-amber-500 text-white'
                    : score >= 40
                      ? 'bg-orange-500 text-white'
                      : 'bg-red-500 text-white'
                : ''
            const isAdding = addingIds.has(p.id)
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-border/40 bg-background shadow-sm overflow-hidden"
              >
                <div className="flex">
                  <div className="w-28 shrink-0 relative bg-muted">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                    {p.off_market && (
                      <div className="absolute top-2 left-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/90 text-white backdrop-blur-sm">
                          Off-market
                        </span>
                      </div>
                    )}
                    {score != null && (
                      <div className="absolute top-2 right-2">
                        <span className={cn('inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full', scoreColor)}>
                          {score}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold truncate leading-tight">{p.title}</p>
                      <button
                        type="button"
                        onClick={() => onPreviewProperty(p.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title="Pré-visualizar imóvel"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {[p.external_ref, p.city, p.zone].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                      {specs?.bedrooms != null && <span>T{specs.bedrooms}</span>}
                      {specs?.area_util != null && <span>{specs.area_util} m²</span>}
                      {p.listing_price != null && (
                        <span className="ml-auto text-sm font-semibold text-foreground tabular-nums">
                          {eur.format(p.listing_price)}
                        </span>
                      )}
                    </div>
                    {p.match_reason && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1 italic truncate">
                        {p.match_reason}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 rounded-full text-xs w-full"
                      disabled={isAdding}
                      onClick={() => handleAdd(p)}
                    >
                      {isAdding ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-3 w-3 mr-1" />
                      )}
                      Adicionar ao dossier
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Imóveis Tab ───────────────────────────────────────────────────────

function ImoveisTab({
  negocioId,
  leadId,
  userId,
  onPreviewProperty,
}: {
  negocioId: string
  leadId: string | null
  userId: string | undefined
  onPreviewProperty: (id: string) => void
}) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showExternal, setShowExternal] = useState(false)
  const [extUrl, setExtUrl] = useState('')
  const [extTitle, setExtTitle] = useState('')
  const [extPrice, setExtPrice] = useState('')
  const [extSource, setExtSource] = useState('')
  const [addingExternal, setAddingExternal] = useState(false)
  const [showVisit, setShowVisit] = useState(false)
  const [visitPropertyId, setVisitPropertyId] = useState<string | null>(null)
  const [showSend, setShowSend] = useState(false)

  const fetchProperties = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/properties`)
      if (res.ok) {
        const json = await res.json()
        setItems(json.data || [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [negocioId])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  const handleUpdateStatus = async (propId: string, status: string) => {
    const res = await fetch(`/api/negocios/${negocioId}/properties/${propId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success('Estado actualizado')
      fetchProperties()
    } else {
      toast.error('Erro ao actualizar')
    }
  }

  const handleRemove = async (propId: string) => {
    const res = await fetch(`/api/negocios/${negocioId}/properties/${propId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      toast.success('Imóvel removido')
      setSelectedIds((prev) => {
        if (!prev.has(propId)) return prev
        const n = new Set(prev)
        n.delete(propId)
        return n
      })
      fetchProperties()
    } else {
      toast.error('Erro ao remover')
    }
  }

  const handleAddExternal = async () => {
    if (!extUrl.trim()) return
    setAddingExternal(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_url: extUrl.trim(),
          external_title: extTitle.trim() || null,
          external_price: extPrice ? Number(extPrice) : null,
          external_source: extSource || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Link adicionado')
      setShowExternal(false)
      setExtUrl('')
      setExtTitle('')
      setExtPrice('')
      setExtSource('')
      fetchProperties()
    } catch {
      toast.error('Erro ao adicionar link externo')
    } finally {
      setAddingExternal(false)
    }
  }

  const handleCreateVisit = async (data: any) => {
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success('Visita agendada')
      setShowVisit(false)
      setVisitPropertyId(null)
      return true
    } catch {
      toast.error('Erro ao agendar visita')
      return null
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const selectedSendItems = items
    .filter((ap) => selectedIds.has(ap.id))
    .map((ap) => {
      const isExternal = !ap.property_id && ap.external_url
      const p: any = ap.property
      const price = isExternal ? ap.external_price : p?.listing_price
      const priceLabel =
        typeof price === 'number' && !Number.isNaN(price)
          ? `${Math.round(price / 1000)}k €`
          : ''
      const title = isExternal ? ap.external_title || 'Imóvel externo' : p?.title || 'Imóvel'
      const href =
        !isExternal && p?.slug
          ? `https://infinitygroup.pt/property/${p.slug}`
          : ap.external_url || '#'
      const cover = !isExternal
        ? p?.dev_property_media?.find((m: any) => m.is_cover)?.url ||
          p?.dev_property_media?.[0]?.url ||
          null
        : null
      const specsObj: any = !isExternal
        ? Array.isArray(p?.dev_property_specifications)
          ? p.dev_property_specifications[0]
          : p?.dev_property_specifications
        : null
      const specParts: string[] = []
      if (specsObj?.bedrooms) specParts.push(`${specsObj.bedrooms} quartos`)
      if (specsObj?.area_util) specParts.push(`${specsObj.area_util} m²`)
      const location = !isExternal
        ? [p?.city, p?.zone].filter(Boolean).join(' · ')
        : ap.external_source || ''
      return {
        id: ap.id,
        title,
        priceLabel,
        href,
        location,
        specs: specParts.join(' · '),
        imageUrl: cover,
        reference: !isExternal ? p?.external_ref || null : null,
      }
    })

  if (loading) return <ListSkeleton />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {items.length === 0
            ? 'Sem imóveis no dossier'
            : `${items.length} imó${items.length === 1 ? 'vel' : 'veis'}`}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-7 text-xs"
            onClick={() => setShowExternal(true)}
          >
            <Link2 className="mr-1 h-3 w-3" />
            Link externo
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyHint icon={Home} message="Nenhum imóvel no dossier deste negócio." />
      ) : (
        <div className="space-y-2">
          {items.map((ap) => {
            const isExternal = !ap.property_id && ap.external_url
            const p = ap.property
            const cover = p?.dev_property_media?.find((m: any) => m.is_cover)?.url || p?.dev_property_media?.[0]?.url
            const price = isExternal ? ap.external_price : p?.listing_price
            const title = isExternal ? ap.external_title || 'Link externo' : p?.title || 'Imóvel'
            const ref = p?.external_ref || null
            const href = p?.id ? `/dashboard/imoveis/${p.slug || p.id}` : ap.external_url
            const propStatus = NEGOCIO_PROPERTY_STATUS[ap.status as keyof typeof NEGOCIO_PROPERTY_STATUS]
            const isSelected = selectedIds.has(ap.id)
            return (
              <div
                key={ap.id}
                className={cn(
                  'rounded-2xl border shadow-sm bg-background overflow-hidden transition-colors',
                  isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border/40',
                )}
              >
                <div className="flex">
                  <div className="w-28 shrink-0 relative bg-muted">
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(ap.id)}
                        className="bg-background/80 border-foreground/40"
                      />
                    </div>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {isExternal ? <Globe className="h-6 w-6 text-muted-foreground/30" /> : <Building2 className="h-6 w-6 text-muted-foreground/30" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold truncate leading-tight">{title}</p>
                      {p?.id ? (
                        <button
                          type="button"
                          onClick={() => onPreviewProperty(p.id)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="Pré-visualizar imóvel"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : href ? (
                        <Link
                          href={href}
                          target="_blank"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="Abrir link externo"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {isExternal ? ap.external_source || 'Portal externo' : [ref, p?.city, p?.zone].filter(Boolean).join(' · ')}
                    </p>
                    {price != null && (
                      <p className="text-xs font-semibold tabular-nums mt-0.5">{eur.format(Number(price))}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Select value={ap.status} onValueChange={(v) => handleUpdateStatus(ap.id, v)}>
                        <SelectTrigger className="h-7 rounded-full text-[11px] px-3 w-auto min-w-[120px]">
                          <SelectValue placeholder="Estado">
                            <Badge className={cn('rounded-full text-[10px] px-2 border-0', propStatus?.bg, propStatus?.text)}>
                              {propStatus?.label || ap.status}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(NEGOCIO_PROPERTY_STATUS).map(([key, val]: any) => (
                            <SelectItem key={key} value={key}>
                              {val.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        title="Agendar visita"
                        onClick={() => {
                          setVisitPropertyId(p?.id || null)
                          setShowVisit(true)
                        }}
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-muted-foreground/60 hover:text-destructive"
                        title="Remover"
                        onClick={() => handleRemove(ap.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating send bar (in-sheet) */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-2 z-10 flex items-center justify-between gap-2 rounded-full border bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur-sm">
          <span className="text-xs">
            <span className="font-semibold">{selectedIds.size}</span> seleccionados
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-xs h-7"
              onClick={() => setSelectedIds(new Set())}
            >
              Limpar
            </Button>
            <Button size="sm" className="rounded-full text-xs h-7" onClick={() => setShowSend(true)}>
              Enviar
            </Button>
          </div>
        </div>
      )}

      {/* Add external link dialog */}
      <Dialog open={showExternal} onOpenChange={setShowExternal}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Link Externo</DialogTitle>
            <DialogDescription>Imóvel de um portal externo (Idealista, Imovirtual, etc.)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">URL do imóvel *</Label>
              <Input className="rounded-xl" placeholder="https://..." value={extUrl} onChange={(e) => setExtUrl(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input className="rounded-xl" value={extTitle} onChange={(e) => setExtTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Preço (€)</Label>
                <Input className="rounded-xl" type="number" value={extPrice} onChange={(e) => setExtPrice(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Portal</Label>
                <Select value={extSource} onValueChange={setExtSource}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idealista">Idealista</SelectItem>
                    <SelectItem value="imovirtual">Imovirtual</SelectItem>
                    <SelectItem value="casa_sapo">Casa Sapo</SelectItem>
                    <SelectItem value="supercasa">Supercasa</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setShowExternal(false)}>
              Cancelar
            </Button>
            <Button className="rounded-full" disabled={!extUrl.trim() || addingExternal} onClick={handleAddExternal}>
              {addingExternal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule visit dialog */}
      <Dialog
        open={showVisit}
        onOpenChange={(o) => {
          if (!o) {
            setShowVisit(false)
            setVisitPropertyId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Agendar visita</DialogTitle>
          </DialogHeader>
          {leadId && (
            <VisitForm
              defaultPropertyId={visitPropertyId || undefined}
              defaultLeadId={leadId}
              defaultConsultantId={userId}
              onSubmit={handleCreateVisit}
              onCancel={() => {
                setShowVisit(false)
                setVisitPropertyId(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Send properties dialog */}
      <SendPropertiesDialog
        open={showSend}
        onOpenChange={setShowSend}
        negocioId={negocioId}
        items={selectedSendItems}
        onSuccess={() => {
          setShowSend(false)
          setSelectedIds(new Set())
          fetchProperties()
        }}
      />
    </div>
  )
}

// ─── Visitas Tab ───────────────────────────────────────────────────────

function VisitasTab({ leadId, userId }: { leadId: string; userId: string | undefined }) {
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showVisit, setShowVisit] = useState(false)

  const fetchVisits = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/visits?lead_id=${leadId}&limit=50`)
      if (res.ok) {
        const json = await res.json()
        setVisits(json.data || [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchVisits()
  }, [fetchVisits])

  const handleCreateVisit = async (data: any) => {
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success('Visita agendada')
      setShowVisit(false)
      fetchVisits()
      return true
    } catch {
      toast.error('Erro ao agendar visita')
      return null
    }
  }

  if (loading) return <ListSkeleton />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {visits.length === 0 ? 'Sem visitas agendadas' : `${visits.length} ${visits.length === 1 ? 'visita' : 'visitas'}`}
        </p>
        <Button variant="outline" size="sm" className="rounded-full h-7 text-xs" onClick={() => setShowVisit(true)}>
          <Plus className="mr-1 h-3 w-3" />
          Nova visita
        </Button>
      </div>

      {visits.length === 0 ? (
        <EmptyHint icon={CalendarIcon} message="Sem visitas agendadas." />
      ) : (
        <div className="space-y-2">
          {visits.map((v) => {
            const vStatus = VISIT_STATUS_COLORS[v.status as keyof typeof VISIT_STATUS_COLORS]
            const visitDate = v.visit_date ? new Date(`${v.visit_date}T${v.visit_time || '00:00'}`) : null
            const propHref = v.property?.slug || v.property?.id ? `/dashboard/imoveis/${v.property.slug || v.property.id}` : null
            return (
              <div
                key={v.id}
                className="rounded-2xl border border-border/40 bg-background shadow-sm p-3 flex items-start gap-3"
              >
                {visitDate && (
                  <div className="flex flex-col items-center justify-center w-12 shrink-0 rounded-lg bg-muted/50 py-1">
                    <span className="text-sm font-bold tabular-nums leading-none">{format(visitDate, 'd', { locale: pt })}</span>
                    <span className="text-[9px] text-muted-foreground uppercase">{format(visitDate, 'MMM', { locale: pt })}</span>
                    <span className="text-[10px] font-medium mt-0.5">{v.visit_time?.slice(0, 5)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{v.property?.title || 'Visita'}</p>
                    {vStatus && (
                      <Badge className={cn('shrink-0 rounded-full text-[9px] px-2 border-0', vStatus.bg, vStatus.text)}>
                        {vStatus.label}
                      </Badge>
                    )}
                  </div>
                  {v.property?.city && (
                    <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {[v.property.address_street, v.property.zone, v.property.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    {v.duration_minutes != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {v.duration_minutes} min
                      </span>
                    )}
                    {v.consultant?.commercial_name && <span>· {v.consultant.commercial_name}</span>}
                    {propHref && (
                      <Link href={propHref} target="_blank" className="ml-auto text-primary hover:underline inline-flex items-center gap-1">
                        Ver imóvel
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showVisit} onOpenChange={setShowVisit}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Agendar visita</DialogTitle>
          </DialogHeader>
          <VisitForm
            defaultLeadId={leadId}
            defaultConsultantId={userId}
            onSubmit={handleCreateVisit}
            onCancel={() => setShowVisit(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Interessados Tab ──────────────────────────────────────────────────

function InteressadosTab({ negocioId }: { negocioId: string }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showHidden, setShowHidden] = useState(false)

  const fetchInteressados = useCallback(
    async (withScore = false) => {
      if (withScore) setScoring(true)
      else setLoading(true)
      try {
        const res = await fetch(`/api/negocios/${negocioId}/interessados${withScore ? '?score=true' : ''}`)
        if (res.ok) {
          const json = await res.json()
          setItems(json.data || [])
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false)
        setScoring(false)
      }
    },
    [negocioId],
  )

  useEffect(() => {
    fetchInteressados()
  }, [fetchInteressados])

  if (loading) return <ListSkeleton />

  const visible = showHidden ? items : items.filter((i) => !hidden.has(i.negocioId))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {items.length === 0 ? 'Sem compradores compatíveis' : `${items.length} ${items.length === 1 ? 'comprador' : 'compradores'}`}
        </p>
        <div className="flex items-center gap-1.5">
          {hidden.size > 0 && (
            <Button variant="ghost" size="sm" className="rounded-full h-7 text-xs" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
              {showHidden ? 'Esconder ocultos' : `${hidden.size} ocult${hidden.size === 1 ? 'o' : 'os'}`}
            </Button>
          )}
          {items.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-full h-7 text-xs" disabled={scoring} onClick={() => fetchInteressados(true)}>
              {scoring ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              Classificar IA
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyHint icon={Users} message="Nenhum comprador compatível." />
      ) : (
        <div className="space-y-2">
          {visible.map((i) => {
            const isHidden = hidden.has(i.negocioId)
            const score = i.match_score as number | null
            const scoreColor =
              score != null
                ? score >= 80
                  ? 'bg-emerald-500 text-white'
                  : score >= 60
                    ? 'bg-amber-500 text-white'
                    : score >= 40
                      ? 'bg-orange-500 text-white'
                      : 'bg-red-500 text-white'
                : ''
            return (
              <div
                key={i.negocioId}
                className={cn(
                  'rounded-2xl border border-border/40 bg-background shadow-sm p-3 flex items-center gap-3 transition-opacity',
                  isHidden && 'opacity-50',
                )}
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{i.firstName || '—'}</p>
                    {score != null && (
                      <span className={cn('inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full', scoreColor)}>
                        {score}%
                      </span>
                    )}
                  </div>
                  {!i.isMine && i.colleague && (
                    <p className="text-[11px] text-muted-foreground truncate">Consultor: {i.colleague}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    {i.phone && (
                      <a href={`tel:${i.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Phone className="h-2.5 w-2.5" />
                        {i.phone}
                      </a>
                    )}
                    {i.email && (
                      <a href={`mailto:${i.email}`} className="inline-flex items-center gap-1 hover:text-foreground truncate">
                        <Mail className="h-2.5 w-2.5" />
                        {i.email}
                      </a>
                    )}
                  </div>
                </div>
                {!i.isMine && (
                  <button
                    type="button"
                    onClick={() => {
                      setHidden((prev) => {
                        const n = new Set(prev)
                        if (n.has(i.negocioId)) n.delete(i.negocioId)
                        else n.add(i.negocioId)
                        return n
                      })
                    }}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/60"
                    title={isHidden ? 'Mostrar' : 'Ocultar'}
                  >
                    {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Shared small UI helpers ───────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string
  subtitle?: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  )
}

function CopyableRow({
  icon: Icon,
  label,
  value,
  onCopy,
  href,
}: {
  icon: React.ElementType
  label: string
  value: string
  onCopy: () => void
  href?: string
}) {
  return (
    <div className="flex items-center gap-3 py-1 -mx-1 px-1 rounded-lg hover:bg-muted/40 transition-colors group/row">
      <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        {href ? (
          <a href={href} className="text-sm font-medium truncate block hover:text-primary transition-colors">
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium truncate">{value}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onCopy}
        title="Copiar"
        className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 transition-colors opacity-0 group-hover/row:opacity-100"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
      <Skeleton className="h-10 w-64 mx-auto rounded-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  )
}

function EmptyHint({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-8 flex flex-col items-center text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
