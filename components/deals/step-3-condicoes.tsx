'use client'

import { UseFormReturn } from 'react-hook-form'
import { DealToggleGroup } from './deal-toggle-group'
import { DealQuickPick } from './deal-quick-pick'
import {
  AcqFieldWrapper,
  AcqFieldLabel,
  AcqInputField,
  AcqTextareaField,
} from '@/components/acquisitions/acquisition-field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { BUSINESS_TYPES, PROPERTY_TYPES_OPTIONS, TYPOLOGY_OPTIONS } from '@/types/deal'
import type { DealFormData } from '@/lib/validations/deal'
import type { DealScenario, BusinessType } from '@/types/deal'

interface StepCondicoesProps {
  form: any
  errors: Record<string, string>
}

function getLabels(bt: BusinessType | undefined) {
  switch (bt) {
    case 'arrendamento':
      return {
        value: 'Valor da renda mensal',
        deposit: 'Caucao / Rendas adiantadas (euro)',
        date: 'Data prevista para assinatura do Contrato de Arrendamento',
        deadline: 'Duracao do Arrendamento (Anos)',
      }
    case 'trespasse':
      return {
        value: 'Valor do trespasse',
        deposit: 'Sinal / Pagamento inicial (euro)',
        date: 'Data prevista para assinatura do Contrato de Trespasse',
        deadline: 'Prazo para contrato definitivo (Dias)',
      }
    default:
      return {
        value: 'Preco de venda',
        deposit: 'Valor do sinal no CPCV (euro)',
        date: 'Data prevista para assinatura do CPCV',
        deadline: 'Prazo maximo para a Escritura (Dias)',
      }
  }
}

export function StepCondicoes({ form, errors }: StepCondicoesProps) {
  const isEmpty = (field: string) => {
    const v = form.watch(field)
    return v === undefined || v === null || v === '' || v === 0
  }

  const scenario = form.watch('scenario') as DealScenario | undefined
  const businessType = form.watch('business_type') as BusinessType | undefined
  const commissionType = form.watch('commission_type') as 'percentage' | 'fixed' | undefined
  const isAngExterna = scenario === 'angariacao_externa'
  const showCpcv = businessType === 'venda'
  const labels = getLabels(businessType)

  return (
    <div className="space-y-5">
      {/* Business type + Deal value */}
      <div className="grid grid-cols-2 gap-3">
        <AcqFieldWrapper isMissing={isEmpty('business_type')}>
          <AcqFieldLabel required>Tipo de Negócio</AcqFieldLabel>
          <div className="mt-2">
            <DealToggleGroup
              value={businessType}
              onChange={(v) => form.setValue('business_type', v as BusinessType)}
              options={Object.entries(BUSINESS_TYPES).map(([value, label]) => ({ value, label }))}
              error={errors.business_type}
            />
          </div>
        </AcqFieldWrapper>
        <AcqInputField
          label={labels.value}
          value={form.watch('deal_value')}
          onChange={(v) => form.setValue('deal_value', parseFloat(v) || 0)}
          suffix="€"
          required
          error={errors.deal_value}
          isMissing={isEmpty('deal_value')}
        />
      </div>

      {/* External property fields (Angariacao Externa only) */}
      {isAngExterna && (
        <>
          <AcqFieldWrapper fullWidth isMissing={isEmpty('external_property_type')}>
            <AcqFieldLabel required>Tipo de Imóvel</AcqFieldLabel>
            <div className="mt-2">
              <DealToggleGroup
                value={form.watch('external_property_type')}
                onChange={(v) => form.setValue('external_property_type', v)}
                options={PROPERTY_TYPES_OPTIONS.map((t) => ({ value: t, label: t }))}
                error={errors.external_property_type}
              />
            </div>
          </AcqFieldWrapper>

          <AcqFieldWrapper fullWidth isMissing={isEmpty('external_property_typology')}>
            <AcqFieldLabel required>Tipologia</AcqFieldLabel>
            <div className="mt-2">
              <DealToggleGroup
                value={form.watch('external_property_typology')}
                onChange={(v) => form.setValue('external_property_typology', v)}
                options={TYPOLOGY_OPTIONS.map((t) => ({ value: t, label: t }))}
                error={errors.external_property_typology}
              />
            </div>
          </AcqFieldWrapper>

          <div className="grid grid-cols-2 gap-3">
            <AcqInputField
              label="ID do Imóvel"
              value={form.watch('external_property_id')}
              onChange={(v) => form.setValue('external_property_id', v)}
              required
              error={errors.external_property_id}
              isMissing={isEmpty('external_property_id')}
            />
            <AcqInputField
              label="Ano de Construção"
              value={form.watch('external_property_construction_year')}
              onChange={(v) => form.setValue('external_property_construction_year', v)}
              required
              error={errors.external_property_construction_year}
              isMissing={isEmpty('external_property_construction_year')}
            />
            <AcqInputField
              label="Zona"
              value={form.watch('external_property_zone')}
              onChange={(v) => form.setValue('external_property_zone', v)}
            />
          </div>
          <AcqTextareaField
            label="Identificação extra (opcional)"
            value={form.watch('external_property_extra')}
            onChange={(v) => form.setValue('external_property_extra', v)}
            placeholder='Opcional, por exemplo: "empreendimento X"'
          />
        </>
      )}

      {/* Commission — full width */}
      <AcqFieldWrapper fullWidth isMissing={isEmpty('commission_pct')} className={cn(errors.commission_pct && 'border-destructive')}>
        <AcqFieldLabel required>Comissão</AcqFieldLabel>
          <div className="mt-1.5">
            <DealToggleGroup
              value={commissionType || 'percentage'}
              onChange={(v) => form.setValue('commission_type', v)}
              options={[
                { value: 'percentage', label: '%' },
                { value: 'fixed', label: '€ Fixo' },
              ]}
            />
          </div>
          {commissionType !== 'fixed' && (
            <div className="flex flex-wrap gap-1.5 mt-3 mb-1">
              {[4, 5, 6].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => form.setValue('commission_pct', v)}
                  className={cn(
                    'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                    form.watch('commission_pct') === v
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-foreground border-border hover:bg-accent'
                  )}
                >
                  {v}%
                </button>
              ))}
            </div>
          )}
          <div className="relative mt-2">
            <Input
              type="text"
              value={form.watch('commission_pct') ?? ''}
              onChange={(e) => form.setValue('commission_pct', parseFloat(e.target.value) || 0)}
              placeholder="Outra"
              className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium pr-6"
            />
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {commissionType === 'fixed' ? '€' : '%'}
            </span>
          </div>
        {errors.commission_pct && <p className="text-xs text-destructive mt-1">{errors.commission_pct}</p>}
      </AcqFieldWrapper>

      {/* Deposit + CPCV */}
      <div className="grid grid-cols-2 gap-3">
        <AcqInputField
          label={labels.deposit}
          value={form.watch('deposit_value')}
          onChange={(v) => form.setValue('deposit_value', v)}
          required
          error={errors.deposit_value}
          isMissing={isEmpty('deposit_value')}
        />
        {showCpcv && (
          <DealQuickPick
            label="Pagamento no CPCV"
            value={form.watch('cpcv_pct')}
            onChange={(v) => form.setValue('cpcv_pct', parseFloat(v) || 0)}
            quickPicks={[
              { value: 0, label: '0%' },
              { value: 50, label: '50%' },
              { value: 100, label: '100%' },
            ]}
            hint="Indica a percentagem paga no cpcv e faremos o cálculo automático da percentagem da escritura"
            required
            error={errors.cpcv_pct}
          />
        )}
      </div>

      {/* Date + Deadline side by side */}
      <div className="grid grid-cols-2 gap-3">
        <AcqFieldWrapper isMissing={isEmpty('contract_signing_date')}>
          <AcqFieldLabel required>{labels.date}</AcqFieldLabel>
          <input
            type="date"
            value={form.watch('contract_signing_date') || ''}
            onChange={(e) => form.setValue('contract_signing_date', e.target.value)}
            className="h-8 w-full border-0 p-0 text-sm font-medium focus:outline-none"
          />
          {errors.contract_signing_date && <p className="text-xs text-destructive mt-1">{errors.contract_signing_date}</p>}
        </AcqFieldWrapper>
        <AcqInputField
          label={labels.deadline}
          value={form.watch('max_deadline')}
          onChange={(v) => form.setValue('max_deadline', v)}
          required
          error={errors.max_deadline}
          isMissing={isEmpty('max_deadline')}
        />
      </div>

      {/* Notes */}
      <AcqTextareaField
        label="Observacoes sobre as condicoes de negocio"
        value={form.watch('conditions_notes')}
        onChange={(v) => form.setValue('conditions_notes', v)}
      />
    </div>
  )
}
