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
import { AcqSelectField } from '@/components/acquisitions/acquisition-field'
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
  const scenario = form.watch('scenario') as DealScenario | undefined
  const businessType = form.watch('business_type') as BusinessType | undefined
  const commissionType = form.watch('commission_type') as 'percentage' | 'fixed' | undefined
  const isAngExterna = scenario === 'angariacao_externa'
  const showCpcv = businessType === 'venda'
  const labels = getLabels(businessType)

  return (
    <div className="space-y-5">
      {/* Business type */}
      <AcqFieldWrapper fullWidth>
        <AcqFieldLabel required>Tipo de Negocio</AcqFieldLabel>
        <div className="mt-2">
          <DealToggleGroup
            value={businessType}
            onChange={(v) => form.setValue('business_type', v as BusinessType)}
            options={Object.entries(BUSINESS_TYPES).map(([value, label]) => ({ value, label }))}
            error={errors.business_type}
          />
        </div>
      </AcqFieldWrapper>

      {/* External property fields (Angariacao Externa only) */}
      {isAngExterna && (
        <>
          <AcqFieldWrapper fullWidth>
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

          <AcqFieldWrapper fullWidth>
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
            />
            <AcqInputField
              label="Ano de Construção"
              value={form.watch('external_property_construction_year')}
              onChange={(v) => form.setValue('external_property_construction_year', v)}
              required
              error={errors.external_property_construction_year}
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

      {/* Financial fields — 2 column grid */}
      <div className="grid grid-cols-2 gap-3">
        <AcqInputField
          label={labels.value}
          value={form.watch('deal_value')}
          onChange={(v) => form.setValue('deal_value', parseFloat(v) || 0)}
          suffix="€"
          required
          error={errors.deal_value}
        />
        <AcqInputField
          label={labels.deposit}
          value={form.watch('deposit_value')}
          onChange={(v) => form.setValue('deposit_value', v)}
          required
          error={errors.deposit_value}
        />
      </div>

      {/* Commission type + value */}
      <div className="grid grid-cols-2 gap-3">
        <DealQuickPick
          label={commissionType === 'fixed' ? 'Valor da Comissão (€)' : 'Comissão final (%)'}
          value={form.watch('commission_pct')}
          onChange={(v) => form.setValue('commission_pct', parseFloat(v) || 0)}
          quickPicks={commissionType === 'fixed' ? [] : [
            { value: 4, label: '4%' },
            { value: 5, label: '5%' },
            { value: 6, label: '6%' },
          ]}
          suffix={commissionType === 'fixed' ? '€' : '%'}
          hint={undefined}
          required
          error={errors.commission_pct}
        />
        <AcqSelectField
          label="Tipo de Comissão"
          value={commissionType || 'percentage'}
          onChange={(v) => form.setValue('commission_type', v)}
          options={[
            { value: 'percentage', label: 'Percentagem (%)' },
            { value: 'fixed', label: 'Valor Fixo (€)' },
          ]}
        />
      </div>

      {/* CPCV */}
      <div className="grid grid-cols-2 gap-3">
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
        <AcqFieldWrapper>
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
