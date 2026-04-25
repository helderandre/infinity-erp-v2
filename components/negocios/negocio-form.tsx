'use client'

import { Input } from '@/components/ui/input'
import { MaskInput } from '@/components/ui/mask-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagsInput } from '@/components/ui/tags-input'
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
import { NegocioZonasField } from '@/components/negocios/zonas/negocio-zonas-field'
import type { NegocioZone } from '@/lib/matching'

interface NegocioFormProps {
  tipo: string
  form: Record<string, unknown>
  updateField: (field: string, value: unknown) => void
}

function NumberInput({
  label,
  field,
  form,
  updateField,
  placeholder,
  suffix,
}: {
  label: string
  field: string
  form: Record<string, unknown>
  updateField: (field: string, value: unknown) => void
  placeholder?: string
  suffix?: string
}) {
  if (suffix === '€') {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <MaskInput
          mask="currency"
          currency="EUR"
          locale="pt-PT"
          placeholder="0,00 €"
          value={form[field] != null ? String(form[field]) : ''}
          onValueChange={(_masked, unmasked) => {
            updateField(field, unmasked ? Number(unmasked) : null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={(form[field] as number) ?? ''}
          onChange={(e) => updateField(field, e.target.value ? Number(e.target.value) : null)}
          placeholder={placeholder}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function CheckboxField({
  label,
  field,
  form,
  updateField,
}: {
  label: string
  field: string
  form: Record<string, unknown>
  updateField: (field: string, value: unknown) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={field}
        checked={!!form[field]}
        onCheckedChange={(v) => updateField(field, v)}
      />
      <Label htmlFor={field} className="text-sm">{label}</Label>
    </div>
  )
}

function SelectField({
  label,
  field,
  form,
  updateField,
  options,
}: {
  label: string
  field: string
  form: Record<string, unknown>
  updateField: (field: string, value: unknown) => void
  options: readonly string[]
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={(form[field] as string) || ''} onValueChange={(v) => updateField(field, v)}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar" />
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

function LocationTagsField({
  label,
  field,
  form,
  updateField,
  placeholder,
}: {
  label: string
  field: string
  form: Record<string, unknown>
  updateField: (field: string, value: unknown) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-md border px-3 py-2">
        <TagsInput
          value={(form[field] as string) || ''}
          onChange={(v) => updateField(field, v)}
          placeholder={placeholder || 'Zonas pretendidas...'}
          suggestions={LOCALIZACOES_PT}
        />
      </div>
    </div>
  )
}

const amenityFields = [
  { field: 'tem_elevador', label: 'Elevador' },
  { field: 'tem_estacionamento', label: 'Estacionamento' },
  { field: 'tem_garagem', label: 'Garagem' },
  { field: 'tem_exterior', label: 'Espaço Exterior' },
  { field: 'tem_varanda', label: 'Varanda' },
  { field: 'tem_piscina', label: 'Piscina' },
  { field: 'tem_porteiro', label: 'Porteiro' },
  { field: 'tem_arrumos', label: 'Arrumos' },
]

export function NegocioForm({ tipo, form, updateField }: NegocioFormProps) {
  const isCompraEVenda = tipo === 'Compra e Venda'
  const isCompra = tipo === 'Compra' || isCompraEVenda
  const isVenda = tipo === 'Venda' || isCompraEVenda
  const isArrendatario = tipo === 'Arrendatário'
  const isArrendador = tipo === 'Arrendador'

  return (
    <div className="space-y-6">
      {/* Shared top fields — only for single-type negócios (not Compra e Venda) */}
      {!isCompraEVenda && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField label="Tipo de Imóvel" field="tipo_imovel" form={form} updateField={updateField} options={NEGOCIO_TIPOS_IMOVEL} />
            <LocationTagsField label="Localização" field="localizacao" form={form} updateField={updateField} />
          </div>
          {(isCompra || isArrendatario) && (
            <NegocioZonasField
              value={(form.zonas as NegocioZone[] | null) ?? []}
              onChange={(zonas) => updateField('zonas', zonas)}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField label="Estado do Imóvel" field="estado_imovel" form={form} updateField={updateField} options={NEGOCIO_ESTADOS_IMOVEL} />
            <SelectField label="Classe" field="classe_imovel" form={form} updateField={updateField} options={NEGOCIO_CLASSES_IMOVEL} />
          </div>
        </>
      )}

      {/* ─── Compra section ─── */}
      {isCompra && (
        <>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {isCompraEVenda ? 'O que procura (Compra)' : 'Critérios de Compra'}
          </h4>

          {/* Compra-specific shared fields when Compra e Venda */}
          {isCompraEVenda && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label="Tipo de Imóvel" field="tipo_imovel" form={form} updateField={updateField} options={NEGOCIO_TIPOS_IMOVEL} />
              <LocationTagsField label="Zonas pretendidas" field="localizacao" form={form} updateField={updateField} placeholder="Lisboa, Cascais..." />
              <SelectField label="Estado do Imóvel" field="estado_imovel" form={form} updateField={updateField} options={NEGOCIO_ESTADOS_IMOVEL} />
              <SelectField label="Classe" field="classe_imovel" form={form} updateField={updateField} options={NEGOCIO_CLASSES_IMOVEL} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Orçamento Mínimo" field="orcamento" form={form} updateField={updateField} suffix="€" />
            <NumberInput label="Orçamento Máximo" field="orcamento_max" form={form} updateField={updateField} suffix="€" />
            <NumberInput label="Quartos Mínimos" field="quartos_min" form={form} updateField={updateField} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Área Mínima" field="area_min_m2" form={form} updateField={updateField} suffix="m²" />
            <SelectField label="Motivação" field="motivacao_compra" form={form} updateField={updateField} options={NEGOCIO_MOTIVACOES} />
            <SelectField label="Prazo" field="prazo_compra" form={form} updateField={updateField} options={NEGOCIO_PRAZOS} />
          </div>
          <div className="space-y-3">
            <Label>Financiamento</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <CheckboxField label="Crédito pré-aprovado" field="credito_pre_aprovado" form={form} updateField={updateField} />
              <CheckboxField label="Financiamento necessário" field="financiamento_necessario" form={form} updateField={updateField} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput label="Valor do Crédito" field="valor_credito" form={form} updateField={updateField} suffix="€" />
              <NumberInput label="Capital Próprio" field="capital_proprio" form={form} updateField={updateField} suffix="€" />
            </div>
          </div>

          {/* Amenities for Compra side */}
          {isCompraEVenda && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Características pretendidas</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {amenityFields.map(({ field, label }) => (
                  <CheckboxField key={field} label={label} field={field} form={form} updateField={updateField} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Venda section ─── */}
      {isVenda && (
        <>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {isCompraEVenda ? 'O que vende (Venda)' : 'Dados de Venda'}
          </h4>

          {/* Venda-specific fields when Compra e Venda */}
          {isCompraEVenda && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label="Tipo de Imóvel" field="tipo_imovel_venda" form={form} updateField={updateField} options={NEGOCIO_TIPOS_IMOVEL} />
              <LocationTagsField label="Localização do imóvel" field="localizacao_venda" form={form} updateField={updateField} placeholder="Zona do imóvel..." />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Preço de Venda" field="preco_venda" form={form} updateField={updateField} suffix="€" />
            <NumberInput label="Quartos" field="quartos" form={form} updateField={updateField} />
            <NumberInput label="Área" field="area_m2" form={form} updateField={updateField} suffix="m²" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Casas de Banho" field="casas_banho" form={form} updateField={updateField} />
            <NumberInput label="WCs" field="num_wc" form={form} updateField={updateField} />
            <NumberInput label="Total Divisões" field="total_divisoes" form={form} updateField={updateField} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Distrito</Label>
              <Input
                value={(form.distrito as string) || ''}
                onChange={(e) => updateField('distrito', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Concelho</Label>
              <Input
                value={(form.concelho as string) || ''}
                onChange={(e) => updateField('concelho', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Freguesia</Label>
              <Input
                value={(form.freguesia as string) || ''}
                onChange={(e) => updateField('freguesia', e.target.value)}
              />
            </div>
          </div>

          {/* Amenities for Venda side */}
          {isCompraEVenda && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Características do imóvel</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {amenityFields.map(({ field, label }) => (
                  <CheckboxField key={`${field}_venda`} label={label} field={`${field}_venda`} form={form} updateField={updateField} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Arrendatário section ─── */}
      {isArrendatario && (
        <>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Critérios de Arrendamento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Renda Máxima Mensal" field="renda_max_mensal" form={form} updateField={updateField} suffix="€" />
            <NumberInput label="Quartos Mínimos" field="quartos_min" form={form} updateField={updateField} />
            <NumberInput label="Área Mínima" field="area_min_m2" form={form} updateField={updateField} suffix="m²" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField label="Situação Profissional" field="situacao_profissional" form={form} updateField={updateField} options={NEGOCIO_SITUACOES_PROFISSIONAIS} />
            <NumberInput label="Rendimento Mensal" field="rendimento_mensal" form={form} updateField={updateField} suffix="€" />
          </div>
          <div className="flex items-center gap-6">
            <CheckboxField label="Tem fiador" field="tem_fiador" form={form} updateField={updateField} />
            <CheckboxField label="Mobilado" field="mobilado" form={form} updateField={updateField} />
          </div>
        </>
      )}

      {/* ─── Arrendador section ─── */}
      {isArrendador && (
        <>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Condições de Arrendamento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Renda Pretendida" field="renda_pretendida" form={form} updateField={updateField} suffix="€" />
            <SelectField label="Duração Mínima" field="duracao_minima_contrato" form={form} updateField={updateField} options={NEGOCIO_DURACOES_CONTRATO} />
            <NumberInput label="Caução (rendas)" field="caucao_rendas" form={form} updateField={updateField} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Quartos" field="quartos" form={form} updateField={updateField} />
            <NumberInput label="Área" field="area_m2" form={form} updateField={updateField} suffix="m²" />
            <NumberInput label="Total Divisões" field="total_divisoes" form={form} updateField={updateField} />
          </div>
          <div className="flex items-center gap-6">
            <CheckboxField label="Aceita animais" field="aceita_animais" form={form} updateField={updateField} />
            <CheckboxField label="Mobilado" field="mobilado" form={form} updateField={updateField} />
          </div>
        </>
      )}

      {/* Amenidades (single-type only — Compra e Venda has them inline above) */}
      {!isCompraEVenda && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Amenidades</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {amenityFields.map(({ field, label }) => (
              <CheckboxField key={field} label={label} field={field} form={form} updateField={updateField} />
            ))}
          </div>
        </div>
      )}

      {/* Observações */}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          rows={3}
          value={(form.observacoes as string) || ''}
          onChange={(e) => updateField('observacoes', e.target.value)}
          placeholder="Notas sobre o negócio..."
        />
      </div>
    </div>
  )
}
