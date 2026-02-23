'use client'

import { Input } from '@/components/ui/input'
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
import {
  NEGOCIO_TIPOS_IMOVEL,
  NEGOCIO_ESTADOS_IMOVEL,
  NEGOCIO_MOTIVACOES,
  NEGOCIO_PRAZOS,
  NEGOCIO_CLASSES_IMOVEL,
  NEGOCIO_SITUACOES_PROFISSIONAIS,
  NEGOCIO_DURACOES_CONTRATO,
} from '@/lib/constants'

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
  const isCompra = tipo === 'Compra' || tipo === 'Compra e Venda'
  const isVenda = tipo === 'Venda' || tipo === 'Compra e Venda'
  const isArrendatario = tipo === 'Arrendatário'
  const isArrendador = tipo === 'Arrendador'

  return (
    <div className="space-y-6">
      {/* Tipo de imovel e localizacao (comum a todos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Imóvel</Label>
          <Select value={(form.tipo_imovel as string) || ''} onValueChange={(v) => updateField('tipo_imovel', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {NEGOCIO_TIPOS_IMOVEL.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Localização</Label>
          <Input
            value={(form.localizacao as string) || ''}
            onChange={(e) => updateField('localizacao', e.target.value)}
            placeholder="Zonas pretendidas (separar por vírgula)"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Estado do Imóvel</Label>
          <Select value={(form.estado_imovel as string) || ''} onValueChange={(v) => updateField('estado_imovel', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {NEGOCIO_ESTADOS_IMOVEL.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Classe</Label>
          <Select value={(form.classe_imovel as string) || ''} onValueChange={(v) => updateField('classe_imovel', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {NEGOCIO_CLASSES_IMOVEL.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campos de Compra */}
      {isCompra && (
        <>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Critérios de Compra</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Orçamento Mínimo" field="orcamento" form={form} updateField={updateField} suffix="€" />
            <NumberInput label="Orçamento Máximo" field="orcamento_max" form={form} updateField={updateField} suffix="€" />
            <NumberInput label="Quartos Mínimos" field="quartos_min" form={form} updateField={updateField} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Área Mínima" field="area_min_m2" form={form} updateField={updateField} suffix="m²" />
            <div className="space-y-2">
              <Label>Motivação</Label>
              <Select value={(form.motivacao_compra as string) || ''} onValueChange={(v) => updateField('motivacao_compra', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {NEGOCIO_MOTIVACOES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Select value={(form.prazo_compra as string) || ''} onValueChange={(v) => updateField('prazo_compra', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {NEGOCIO_PRAZOS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
        </>
      )}

      {/* Campos de Venda */}
      {isVenda && (
        <>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados de Venda</h4>
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
        </>
      )}

      {/* Campos de Arrendatario */}
      {isArrendatario && (
        <>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Critérios de Arrendamento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Renda Máxima Mensal" field="renda_max_mensal" form={form} updateField={updateField} suffix="€" />
            <NumberInput label="Quartos Mínimos" field="quartos_min" form={form} updateField={updateField} />
            <NumberInput label="Área Mínima" field="area_min_m2" form={form} updateField={updateField} suffix="m²" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Situação Profissional</Label>
              <Select value={(form.situacao_profissional as string) || ''} onValueChange={(v) => updateField('situacao_profissional', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {NEGOCIO_SITUACOES_PROFISSIONAIS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumberInput label="Rendimento Mensal" field="rendimento_mensal" form={form} updateField={updateField} suffix="€" />
          </div>
          <div className="flex items-center gap-6">
            <CheckboxField label="Tem fiador" field="tem_fiador" form={form} updateField={updateField} />
            <CheckboxField label="Mobilado" field="mobilado" form={form} updateField={updateField} />
          </div>
        </>
      )}

      {/* Campos de Arrendador */}
      {isArrendador && (
        <>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Condições de Arrendamento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NumberInput label="Renda Pretendida" field="renda_pretendida" form={form} updateField={updateField} suffix="€" />
            <div className="space-y-2">
              <Label>Duração Mínima</Label>
              <Select value={(form.duracao_minima_contrato as string) || ''} onValueChange={(v) => updateField('duracao_minima_contrato', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {NEGOCIO_DURACOES_CONTRATO.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

      {/* Amenidades (comum) */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Amenidades</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {amenityFields.map(({ field, label }) => (
            <CheckboxField key={field} label={label} field={field} form={form} updateField={updateField} />
          ))}
        </div>
      </div>

      {/* Observacoes */}
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
