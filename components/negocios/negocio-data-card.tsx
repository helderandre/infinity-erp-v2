'use client'

import { useState } from 'react'
import { Pencil, Check, Landmark, Sparkles, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  NEGOCIO_TIPOS_IMOVEL,
  NEGOCIO_ESTADOS_IMOVEL,
  NEGOCIO_MOTIVACOES,
  NEGOCIO_PRAZOS,
  NEGOCIO_CLASSES_IMOVEL,
  NEGOCIO_SITUACOES_PROFISSIONAIS,
  NEGOCIO_DURACOES_CONTRATO,
  LOCALIZACOES_PT,
} from '@/lib/constants'
import { TagsInput, TagsDisplay } from '@/components/ui/tags-input'
import { NegocioZonasField } from '@/components/negocios/zonas/negocio-zonas-field'
import type { NegocioZone } from '@/lib/matching'
import { MapPin, Pencil as PencilIcon, Building2, Map as MapIcon } from 'lucide-react'

/* ─── Zonas (read-only display) ─── */
function ZonasDisplay({ zonas, legacyValue }: { zonas: NegocioZone[]; legacyValue?: string }) {
  const hasText = !!legacyValue && legacyValue.trim() !== ''
  const hasZonas = zonas && zonas.length > 0
  if (!hasText && !hasZonas) return null
  return (
    <div className="col-span-full rounded-xl border px-4 py-3 space-y-3">
      {hasText && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Localização (texto)</p>
          <TagsDisplay value={legacyValue!} />
        </div>
      )}
      {hasZonas && (
        <div className={hasText ? 'border-t pt-3' : ''}>
          <p className="text-xs text-muted-foreground mb-2">Zonas de interesse</p>
          <div className="flex flex-wrap gap-1.5">
            {zonas.map((zone, i) => {
              const Icon =
                zone.kind === 'polygon'
                  ? PencilIcon
                  : zone.label.includes('Distrito')
                    ? MapIcon
                    : zone.label.includes('Concelho')
                      ? Building2
                      : MapPin
              return (
                <span
                  key={zone.kind === 'polygon' ? zone.id : `admin-${zone.area_id}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 border border-border/40 px-2.5 py-1 text-xs"
                >
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{zone.label}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Display Field ─── */
function DisplayField({
  label,
  value,
  fullWidth,
  suffix,
}: {
  label: string
  value?: string | number | null
  fullWidth?: boolean
  suffix?: string
}) {
  const display = value != null && value !== '' ? `${value}${suffix ? ` ${suffix}` : ''}` : '—'
  return (
    <div className={`rounded-xl border px-4 py-3 ${fullWidth ? 'col-span-full' : ''}`}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">{display}</p>
    </div>
  )
}

/* ─── Edit Field ─── */
function EditField({
  label,
  value,
  fullWidth,
  type = 'text',
  placeholder,
  suffix,
  onChange,
}: {
  label: string
  value?: string | number | null
  fullWidth?: boolean
  type?: string
  placeholder?: string
  suffix?: string
  onChange: (v: string) => void
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${fullWidth ? 'col-span-full' : ''}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="relative">
        <Input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '—'}
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium"
        />
        {suffix && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Select Field ─── */
function SelectDisplayField({
  label,
  value,
  options,
  placeholder,
  onChange,
  isEditing,
  fullWidth,
}: {
  label: string
  value?: string | null
  options: readonly string[]
  placeholder?: string
  onChange: (v: string) => void
  isEditing: boolean
  fullWidth?: boolean
}) {
  if (!isEditing) return <DisplayField label={label} value={value} fullWidth={fullWidth} />
  return (
    <div className={`rounded-xl border px-4 py-3 ${fullWidth ? 'col-span-full' : ''}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 border-0 p-0 shadow-none focus:ring-0 text-sm font-medium">
          <SelectValue placeholder={placeholder || 'Selecionar...'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/* ─── Toggle Field (full-width, styled like reference) ─── */
function ToggleRow({
  label,
  checked,
  onChange,
  isEditing,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  isEditing: boolean
}) {
  return (
    <div className={`col-span-full rounded-xl border px-4 py-3 flex items-center justify-between ${checked ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950' : ''}`}>
      <span className="text-sm font-medium">{label}</span>
      {isEditing ? (
        <Switch checked={checked} onCheckedChange={onChange} />
      ) : (
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${checked ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'}`}>
          {checked ? 'Sim' : 'Não'}
        </span>
      )}
    </div>
  )
}

/* ─── Section Header ─── */
function SectionHeader({ title }: { title: string }) {
  return (
    <p className="col-span-full text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3">
      {title}
    </p>
  )
}

/* ─── Amenity Card ─── */
const AMENITY_EMOJIS: Record<string, { emoji: string; label: string }> = {
  tem_elevador: { emoji: '🏗️', label: 'Elevador' },
  tem_estacionamento: { emoji: '🅿️', label: 'Estacionamento' },
  tem_garagem: { emoji: '🚗', label: 'Garagem' },
  tem_exterior: { emoji: '🌿', label: 'Exterior' },
  tem_varanda: { emoji: '🌸', label: 'Varanda' },
  tem_piscina: { emoji: '🏊', label: 'Piscina' },
  tem_porteiro: { emoji: '🔒', label: 'Porteiro' },
  tem_arrumos: { emoji: '📦', label: 'Arrumos' },
  tem_carregamento_ev: { emoji: '🔌', label: 'Carregamento EV' },
  tem_praia: { emoji: '🏖️', label: 'Praia' },
  tem_quintal: { emoji: '🌳', label: 'Quintal' },
  tem_terraco: { emoji: '☀️', label: 'Terraço' },
  tem_jardim: { emoji: '🌻', label: 'Jardim' },
  tem_mobilado: { emoji: '🛋️', label: 'Mobilado' },
  tem_arrecadacao: { emoji: '🗄️', label: 'Arrecadação' },
  tem_aquecimento: { emoji: '🔥', label: 'Aquecimento' },
  tem_cozinha_equipada: { emoji: '🍳', label: 'Cozinha Equipada' },
  tem_campo: { emoji: '🌾', label: 'Campo' },
  tem_urbano: { emoji: '🏙️', label: 'Urbano' },
  tem_ar_condicionado: { emoji: '❄️', label: 'Ar Condicionado' },
  tem_energias_renovaveis: { emoji: '♻️', label: 'Energias Renováveis' },
  tem_gas: { emoji: '🔵', label: 'Gás' },
  tem_seguranca: { emoji: '🛡️', label: 'Segurança' },
  tem_transportes: { emoji: '🚇', label: 'Transportes' },
  tem_vistas: { emoji: '🏔️', label: 'Vistas Exteriores' },
}

function AmenityGrid({
  form,
  isEditing,
  onToggle,
  fieldPrefix,
}: {
  form: Record<string, unknown>
  isEditing: boolean
  onToggle: (field: string, value: boolean) => void
  fieldPrefix?: string
}) {
  const prefix = fieldPrefix || ''
  const fields = Object.keys(AMENITY_EMOJIS)

  return (
    <div className="col-span-full grid grid-cols-10 gap-1">
      {fields.map((baseField) => {
        const field = prefix ? `${baseField}${prefix}` : baseField
        const active = !!form[field]
        const info = AMENITY_EMOJIS[baseField]
        return (
          <button
            key={field}
            type="button"
            disabled={!isEditing}
            onClick={() => isEditing && onToggle(field, !active)}
            className={`
              rounded-md border px-1 py-2 flex flex-col items-center justify-center gap-0.5 text-center transition-all
              ${active
                ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300'
                : 'border-border hover:bg-muted/50'
              }
              ${isEditing ? 'cursor-pointer' : 'cursor-default'}
            `}
          >
            <span className="text-sm">{info.emoji}</span>
            <span className={`text-[8px] font-medium leading-tight px-0.5 ${active ? 'text-orange-700 dark:text-orange-300' : ''}`}>
              {info.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ─── Main Component ─── */
interface ExtraTab {
  value: string
  label: string
  content: React.ReactNode
  onActivate?: () => void
}

interface NegocioDataCardProps {
  tipo: string
  negocioId: string
  form: Record<string, unknown>
  onFieldChange: (field: string, value: unknown) => void
  onSave: () => Promise<void>
  isSaving: boolean
  refreshKey?: number
  extraTabs?: ExtraTab[]
  onAiFillClick?: () => void
}

export function NegocioDataCard({
  tipo,
  negocioId,
  form,
  onFieldChange,
  onSave,
  isSaving,
  refreshKey,
  extraTabs = [],
  onAiFillClick,
}: NegocioDataCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('dados')
  const showEditButton = activeTab === 'dados'

  const val = (field: string) => (form[field] as string) ?? ''
  const numVal = (field: string) => form[field] as number | null
  const boolVal = (field: string) => !!form[field]

  const isCompraEVenda = tipo === 'Compra e Venda'
  const isCompra = tipo === 'Compra' || isCompraEVenda
  const isVenda = tipo === 'Venda' || isCompraEVenda
  const isArrendatario = tipo === 'Arrendatário'
  const isArrendador = tipo === 'Arrendador'

  const handleSaveAndExit = async () => {
    await onSave()
    setIsEditing(false)
  }

  const formatCurrency = (v: number | null) => {
    if (v == null) return null
    return new Intl.NumberFormat('pt-PT').format(v) + ' €'
  }

  /* ─── Compra fields block ─── */
  const renderCompraFields = () => (
    <>
      <SectionHeader title="Orçamento" />
      {isEditing ? (
        <>
          <EditField label="Orçamento mínimo" value={numVal('orcamento')} type="number" suffix="€" onChange={(v) => onFieldChange('orcamento', v ? Number(v) : null)} />
          <EditField label="Orçamento máximo" value={numVal('orcamento_max')} type="number" suffix="€" onChange={(v) => onFieldChange('orcamento_max', v ? Number(v) : null)} />
        </>
      ) : (
        <>
          <DisplayField label="Orçamento mínimo" value={formatCurrency(numVal('orcamento'))} />
          <DisplayField label="Orçamento máximo" value={formatCurrency(numVal('orcamento_max'))} />
        </>
      )}

      <SectionHeader title="O que procura" />
      {isEditing ? (
        <>
          <div className="col-span-full rounded-xl border px-4 py-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Localização (texto)</p>
              <TagsInput value={val('localizacao')} onChange={(v) => onFieldChange('localizacao', v)} placeholder="Lisboa, Cascais..." suggestions={LOCALIZACOES_PT} />
            </div>
            <div className="border-t pt-3">
              <NegocioZonasField
                value={(form.zonas as NegocioZone[] | null) ?? []}
                onChange={(zonas) => onFieldChange('zonas', zonas)}
              />
            </div>
          </div>
          <SelectDisplayField label="Tipo de imóvel" value={val('tipo_imovel')} options={NEGOCIO_TIPOS_IMOVEL} onChange={(v) => onFieldChange('tipo_imovel', v)} isEditing />
          <EditField label="Quartos mínimos" value={numVal('quartos_min')} type="number" onChange={(v) => onFieldChange('quartos_min', v ? Number(v) : null)} />
          <EditField label="Nº de WC" value={numVal('num_wc')} type="number" onChange={(v) => onFieldChange('num_wc', v ? Number(v) : null)} />
          <EditField label="Área mínima útil" value={numVal('area_min_m2')} type="number" suffix="m²" onChange={(v) => onFieldChange('area_min_m2', v ? Number(v) : null)} />
          <SelectDisplayField label="Estado do imóvel" value={val('estado_imovel')} options={NEGOCIO_ESTADOS_IMOVEL} onChange={(v) => onFieldChange('estado_imovel', v)} isEditing />
        </>
      ) : (
        <>
          <ZonasDisplay zonas={(form.zonas as NegocioZone[] | null) ?? []} legacyValue={val('localizacao')} />
          <DisplayField label="Tipo de imóvel" value={val('tipo_imovel')} />
          <DisplayField label="Quartos mínimos" value={numVal('quartos_min')} />
          <DisplayField label="Nº de WC" value={numVal('num_wc')} />
          <DisplayField label="Área mínima útil" value={numVal('area_min_m2')} suffix="m²" />
          <DisplayField label="Estado do imóvel" value={val('estado_imovel')} />
        </>
      )}

      <SectionHeader title="Características" />
      <AmenityGrid form={form} isEditing={isEditing} onToggle={(f, v) => onFieldChange(f, v)} />

      <SectionHeader title="Contexto" />
      {isEditing ? (
        <>
          <SelectDisplayField label="Motivação de compra" value={val('motivacao_compra')} options={NEGOCIO_MOTIVACOES} onChange={(v) => onFieldChange('motivacao_compra', v)} isEditing />
          <SelectDisplayField label="Prazo para comprar" value={val('prazo_compra')} options={NEGOCIO_PRAZOS} onChange={(v) => onFieldChange('prazo_compra', v)} isEditing />
        </>
      ) : (
        <>
          <DisplayField label="Motivação de compra" value={val('motivacao_compra')} />
          <DisplayField label="Prazo para comprar" value={val('prazo_compra')} />
        </>
      )}

      {/* Financiamento — merged from former separate tab */}
      <SectionHeader title="Financiamento" />
      <ToggleRow label="Necessita financiamento" checked={boolVal('financiamento_necessario')} onChange={(v) => onFieldChange('financiamento_necessario', v)} isEditing={isEditing} />
      {boolVal('financiamento_necessario') && (
        <>
          {isEditing ? (
            <>
              <EditField label="Capital próprio disponível" value={numVal('capital_proprio')} type="number" suffix="€" onChange={(v) => onFieldChange('capital_proprio', v ? Number(v) : null)} />
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Crédito pré-aprovado</p>
                <Switch checked={boolVal('credito_pre_aprovado')} onCheckedChange={(v) => onFieldChange('credito_pre_aprovado', v)} />
              </div>
              <EditField label="Valor do crédito aprovado" value={numVal('valor_credito')} type="number" suffix="€" fullWidth onChange={(v) => onFieldChange('valor_credito', v ? Number(v) : null)} />
            </>
          ) : (
            <>
              <DisplayField label="Capital próprio disponível" value={formatCurrency(numVal('capital_proprio'))} />
              <DisplayField label="Crédito pré-aprovado" value={boolVal('credito_pre_aprovado') ? 'Sim' : 'Não'} />
              <DisplayField label="Valor do crédito aprovado" value={formatCurrency(numVal('valor_credito'))} fullWidth />
            </>
          )}
          <div className="col-span-full mt-2">
            <Link
              href={`/dashboard/credito/novo?lead_id=${val('lead_id')}&negocio_id=${negocioId}`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Landmark className="h-4 w-4" />
              Iniciar Pedido de Crédito
            </Link>
          </div>
        </>
      )}
    </>
  )

  /* ─── Venda fields block ─── */
  const vendaTipoField = isCompraEVenda ? 'tipo_imovel_venda' : 'tipo_imovel'
  const vendaLocField = isCompraEVenda ? 'localizacao_venda' : 'localizacao'
  const vendaAmenityPrefix = isCompraEVenda ? '_venda' : ''

  const renderVendaFields = () => (
    <>
      <SectionHeader title="Dados do imóvel" />
      {isEditing ? (
        <>
          <EditField label="Preço de venda" value={numVal('preco_venda')} type="number" suffix="€" onChange={(v) => onFieldChange('preco_venda', v ? Number(v) : null)} />
          <SelectDisplayField label="Tipo de imóvel" value={val(vendaTipoField)} options={NEGOCIO_TIPOS_IMOVEL} onChange={(v) => onFieldChange(vendaTipoField, v)} isEditing />
          <EditField label="Quartos" value={numVal('quartos')} type="number" onChange={(v) => onFieldChange('quartos', v ? Number(v) : null)} />
          <EditField label="Casas de banho" value={numVal('casas_banho')} type="number" onChange={(v) => onFieldChange('casas_banho', v ? Number(v) : null)} />
          <EditField label="Área" value={numVal('area_m2')} type="number" suffix="m²" onChange={(v) => onFieldChange('area_m2', v ? Number(v) : null)} />
          <EditField label="Total divisões" value={numVal('total_divisoes')} type="number" onChange={(v) => onFieldChange('total_divisoes', v ? Number(v) : null)} />
        </>
      ) : (
        <>
          <DisplayField label="Preço de venda" value={formatCurrency(numVal('preco_venda'))} />
          <DisplayField label="Tipo de imóvel" value={val(vendaTipoField)} />
          <DisplayField label="Quartos" value={numVal('quartos')} />
          <DisplayField label="Casas de banho" value={numVal('casas_banho')} />
          <DisplayField label="Área" value={numVal('area_m2')} suffix="m²" />
          <DisplayField label="Total divisões" value={numVal('total_divisoes')} />
        </>
      )}

      <SectionHeader title="Localização" />
      {isEditing ? (
        <>
          <div className="col-span-full rounded-xl border px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Localização</p>
            <TagsInput value={val(vendaLocField)} onChange={(v) => onFieldChange(vendaLocField, v)} placeholder="Zona do imóvel..." suggestions={LOCALIZACOES_PT} />
          </div>
          <EditField label="Distrito" value={val('distrito')} onChange={(v) => onFieldChange('distrito', v)} />
          <EditField label="Concelho" value={val('concelho')} onChange={(v) => onFieldChange('concelho', v)} />
          <EditField label="Freguesia" value={val('freguesia')} onChange={(v) => onFieldChange('freguesia', v)} />
        </>
      ) : (
        <>
          <div className="col-span-full rounded-xl border px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">Localização</p>
            <TagsDisplay value={val(vendaLocField)} />
          </div>
          <DisplayField label="Distrito" value={val('distrito')} />
          <DisplayField label="Concelho" value={val('concelho')} />
          <DisplayField label="Freguesia" value={val('freguesia')} />
        </>
      )}

      <SectionHeader title="Características" />
      <AmenityGrid form={form} isEditing={isEditing} onToggle={(f, v) => onFieldChange(f, v)} fieldPrefix={vendaAmenityPrefix} />
    </>
  )

  /* Observações now lives in the page-level popup, not inline. */

  /* ─── AI fill banner row ─── */
  const renderAiFillRow = () => {
    if (!onAiFillClick) return null
    return (
      <button
        type="button"
        onClick={onAiFillClick}
        className="group relative col-span-full overflow-hidden rounded-2xl border border-violet-200/60 dark:border-violet-500/30 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-sky-50 dark:from-violet-950/40 dark:via-fuchsia-950/30 dark:to-sky-950/40 px-5 py-3.5 mb-3 flex items-center justify-between transition-all hover:shadow-md hover:border-violet-300 dark:hover:border-violet-400/50"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Preencher com IA</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Cole texto ou grave uma nota de voz para preencher automaticamente</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
      </button>
    )
  }

  /* ─── Dados do negócio tab content ─── */
  const renderDadosTab = () => {
    /* Compra e Venda → subtabs for Compra / Venda */
    if (isCompraEVenda) {
      return (
        <>
          {renderAiFillRow()}
          <Tabs defaultValue="subtab-compra">
            <TabsList className="bg-muted/50 rounded-full p-1 h-auto gap-0 mb-4">
              <TabsTrigger value="subtab-compra" className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                O que procura
              </TabsTrigger>
              <TabsTrigger value="subtab-venda" className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                O que vende
              </TabsTrigger>
            </TabsList>
            <TabsContent value="subtab-compra" className="mt-0">
              <div className="grid grid-cols-2 gap-3">
                {renderCompraFields()}
              </div>
            </TabsContent>
            <TabsContent value="subtab-venda" className="mt-0">
              <div className="grid grid-cols-2 gap-3">
                {renderVendaFields()}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )
    }

    /* Single-type negócios */
    return (
      <div className="grid grid-cols-2 gap-3">
        {renderAiFillRow()}
        {isCompra && renderCompraFields()}
        {isVenda && renderVendaFields()}

        {/* ─── ARRENDATÁRIO fields ─── */}
        {isArrendatario && (
          <>
            <SectionHeader title="Critérios de arrendamento" />
            {isEditing ? (
              <>
                <EditField label="Renda máxima mensal" value={numVal('renda_max_mensal')} type="number" suffix="€" onChange={(v) => onFieldChange('renda_max_mensal', v ? Number(v) : null)} />
                <EditField label="Quartos mínimos" value={numVal('quartos_min')} type="number" onChange={(v) => onFieldChange('quartos_min', v ? Number(v) : null)} />
                <EditField label="Área mínima" value={numVal('area_min_m2')} type="number" suffix="m²" onChange={(v) => onFieldChange('area_min_m2', v ? Number(v) : null)} />
                <SelectDisplayField label="Situação profissional" value={val('situacao_profissional')} options={NEGOCIO_SITUACOES_PROFISSIONAIS} onChange={(v) => onFieldChange('situacao_profissional', v)} isEditing />
                <EditField label="Rendimento mensal" value={numVal('rendimento_mensal')} type="number" suffix="€" onChange={(v) => onFieldChange('rendimento_mensal', v ? Number(v) : null)} />
                <div className="col-span-full rounded-xl border px-4 py-3 space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Localização (texto)</p>
                    <TagsInput value={val('localizacao')} onChange={(v) => onFieldChange('localizacao', v)} placeholder="Lisboa, Porto..." suggestions={LOCALIZACOES_PT} />
                  </div>
                  <div className="border-t pt-3">
                    <NegocioZonasField
                      value={(form.zonas as NegocioZone[] | null) ?? []}
                      onChange={(zonas) => onFieldChange('zonas', zonas)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <DisplayField label="Renda máxima mensal" value={formatCurrency(numVal('renda_max_mensal'))} />
                <DisplayField label="Quartos mínimos" value={numVal('quartos_min')} />
                <DisplayField label="Área mínima" value={numVal('area_min_m2')} suffix="m²" />
                <DisplayField label="Situação profissional" value={val('situacao_profissional')} />
                <DisplayField label="Rendimento mensal" value={formatCurrency(numVal('rendimento_mensal'))} />
                <ZonasDisplay zonas={(form.zonas as NegocioZone[] | null) ?? []} legacyValue={val('localizacao')} />
              </>
            )}
            <ToggleRow label="Tem fiador" checked={boolVal('tem_fiador')} onChange={(v) => onFieldChange('tem_fiador', v)} isEditing={isEditing} />
            <ToggleRow label="Mobilado" checked={boolVal('mobilado')} onChange={(v) => onFieldChange('mobilado', v)} isEditing={isEditing} />

            <SectionHeader title="Características" />
            <AmenityGrid form={form} isEditing={isEditing} onToggle={(f, v) => onFieldChange(f, v)} />
          </>
        )}

        {/* ─── ARRENDADOR fields ─── */}
        {isArrendador && (
          <>
            <SectionHeader title="Condições de arrendamento" />
            {isEditing ? (
              <>
                <EditField label="Renda pretendida" value={numVal('renda_pretendida')} type="number" suffix="€" onChange={(v) => onFieldChange('renda_pretendida', v ? Number(v) : null)} />
                <SelectDisplayField label="Duração mínima" value={val('duracao_minima_contrato')} options={NEGOCIO_DURACOES_CONTRATO} onChange={(v) => onFieldChange('duracao_minima_contrato', v)} isEditing />
                <EditField label="Caução (rendas)" value={numVal('caucao_rendas')} type="number" onChange={(v) => onFieldChange('caucao_rendas', v ? Number(v) : null)} />
                <EditField label="Quartos" value={numVal('quartos')} type="number" onChange={(v) => onFieldChange('quartos', v ? Number(v) : null)} />
                <EditField label="Área" value={numVal('area_m2')} type="number" suffix="m²" onChange={(v) => onFieldChange('area_m2', v ? Number(v) : null)} />
                <EditField label="Total divisões" value={numVal('total_divisoes')} type="number" onChange={(v) => onFieldChange('total_divisoes', v ? Number(v) : null)} />
              </>
            ) : (
              <>
                <DisplayField label="Renda pretendida" value={formatCurrency(numVal('renda_pretendida'))} />
                <DisplayField label="Duração mínima" value={val('duracao_minima_contrato')} />
                <DisplayField label="Caução (rendas)" value={numVal('caucao_rendas')} />
                <DisplayField label="Quartos" value={numVal('quartos')} />
                <DisplayField label="Área" value={numVal('area_m2')} suffix="m²" />
                <DisplayField label="Total divisões" value={numVal('total_divisoes')} />
              </>
            )}
            <ToggleRow label="Aceita animais" checked={boolVal('aceita_animais')} onChange={(v) => onFieldChange('aceita_animais', v)} isEditing={isEditing} />
            <ToggleRow label="Mobilado" checked={boolVal('mobilado')} onChange={(v) => onFieldChange('mobilado', v)} isEditing={isEditing} />

            <SectionHeader title="Características" />
            <AmenityGrid form={form} isEditing={isEditing} onToggle={(f, v) => onFieldChange(f, v)} />
          </>
        )}
      </div>
    )
  }

  /* ─── Build tabs ─── */
  const dadosLabel = isCompraEVenda
    ? 'Dados do negócio'
    : isCompra
      ? 'Dados da Compra'
      : isVenda
        ? 'Dados da Venda'
        : isArrendatario
          ? 'Dados do Arrendamento'
          : isArrendador
            ? 'Dados do Arrendamento'
            : 'Dados do negócio'

  const tabs: { value: string; label: string; onActivate?: () => void }[] = [
    { value: 'dados', label: dadosLabel },
  ]
  for (const et of extraTabs) {
    tabs.push({ value: et.value, label: et.label, onActivate: et.onActivate })
  }

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-muted/50 rounded-full p-1 h-auto gap-0">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  onClick={t.onActivate}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Edit / Save (only for dados/financiamento tabs) */}
            {showEditButton && (isEditing ? (
              <button
                onClick={handleSaveAndExit}
                disabled={isSaving}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                {isSaving ? <Spinner variant="infinite" size={16} /> : <Check className="h-4 w-4" />}
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
            ))}
          </div>

          <TabsContent value="dados" className="mt-0">
            {renderDadosTab()}
          </TabsContent>

          {extraTabs.map((et) => (
            <TabsContent key={et.value} value={et.value} className="mt-0">
              {et.content}
            </TabsContent>
          ))}

        </Tabs>
      </CardContent>
    </Card>
  )
}
