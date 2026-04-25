'use client'

import { Euro, Home, MapPin, Bed, Ruler } from 'lucide-react'
import type { NegocioZone } from '@/lib/matching'

interface BriefingPreviewProps {
  tipo: string
  form: Record<string, unknown>
}

interface Chip {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}

/**
 * Mostra os critérios mais importantes do briefing como chips read-only.
 * O detalhe completo + edição está no BriefingSheet.
 */
export function BriefingPreview({ tipo, form }: BriefingPreviewProps) {
  const chips = buildChips(tipo, form)

  if (chips.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Briefing vazio. Use o assistente ou clique em "Ver/editar" para preencher.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip, i) => (
        <span
          key={`${chip.label}-${i}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 border border-border/40 px-3 py-1 text-xs"
        >
          <chip.icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">{chip.label}:</span>
          <span className="font-medium">{chip.value}</span>
        </span>
      ))}
    </div>
  )
}

function buildChips(tipo: string, f: Record<string, unknown>): Chip[] {
  const chips: Chip[] = []
  const num = (k: string) => f[k] as number | null | undefined
  const str = (k: string) => (f[k] as string | null | undefined) || ''

  const fmtEuros = (v: number | null | undefined) =>
    v != null ? `${(v / 1000).toFixed(0)}k €` : null

  const isCompra = tipo === 'Compra' || tipo === 'Compra e Venda'
  const isVenda = tipo === 'Venda' || tipo === 'Compra e Venda'
  const isArrendatario = tipo === 'Arrendatário'
  const isArrendador = tipo === 'Arrendador'

  // Tipo imóvel
  if (str('tipo_imovel')) {
    chips.push({ icon: Home, label: 'Tipo', value: str('tipo_imovel') })
  }

  // Localização (zonas têm prioridade sobre legacy text)
  const zonas = (f.zonas as NegocioZone[] | null) ?? []
  if (zonas.length > 0) {
    const labels = zonas.slice(0, 2).map((z) => z.label).join(', ')
    const more = zonas.length > 2 ? ` +${zonas.length - 2}` : ''
    chips.push({ icon: MapPin, label: 'Localização', value: labels + more })
  } else if (str('localizacao')) {
    chips.push({
      icon: MapPin,
      label: 'Localização',
      value: str('localizacao').slice(0, 40),
    })
  }

  // Orçamento / Renda / Preço
  if (isCompra) {
    const min = num('orcamento')
    const max = num('orcamento_max')
    const value =
      min && max
        ? `${fmtEuros(min)} – ${fmtEuros(max)}`
        : max
          ? `até ${fmtEuros(max)}`
          : min
            ? `desde ${fmtEuros(min)}`
            : null
    if (value) chips.push({ icon: Euro, label: 'Orçamento', value })
  }
  if (isVenda) {
    const v = num('preco_venda')
    if (v) chips.push({ icon: Euro, label: 'Preço', value: fmtEuros(v) || '—' })
  }
  if (isArrendatario) {
    const v = num('renda_max_mensal')
    if (v) chips.push({ icon: Euro, label: 'Renda máx.', value: `${v} €/mês` })
  }
  if (isArrendador) {
    const v = num('renda_pretendida')
    if (v) chips.push({ icon: Euro, label: 'Renda', value: `${v} €/mês` })
  }

  // Quartos
  const quartos = num('quartos_min') ?? num('quartos')
  if (quartos != null) {
    chips.push({ icon: Bed, label: 'Quartos', value: `${quartos}+` })
  }

  // Área
  const area = num('area_min_m2') ?? num('area_m2')
  if (area != null) {
    chips.push({ icon: Ruler, label: 'Área', value: `${area} m²` })
  }

  return chips
}
