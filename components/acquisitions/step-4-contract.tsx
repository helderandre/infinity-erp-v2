'use client'

import { UseFormReturn } from 'react-hook-form'
import {
  AcqSectionHeader,
  AcqInputField,
  AcqTextareaField,
  AcqSelectField,
} from './acquisition-field'
import { CONTRACT_REGIMES } from '@/lib/constants'

interface StepContractProps {
  form: UseFormReturn<any>
}

const toOptions = (obj: Record<string, string>) =>
  Object.entries(obj).map(([value, label]) => ({ value, label }))

export function StepContract({ form }: StepContractProps) {
  const errors = form.formState.errors

  return (
    <div className="space-y-4">
      <AcqSectionHeader title="Informações Contratuais" />

      <div className="grid grid-cols-2 gap-3">
        <AcqSelectField
          label="Regime Contratual"
          required
          value={form.watch('contract_regime')}
          onChange={(v) => form.setValue('contract_regime', v, { shouldValidate: true })}
          options={toOptions(CONTRACT_REGIMES)}
          placeholder="Seleccionar regime"
          error={errors.contract_regime?.message as string}
        />

        <AcqInputField
          label="Prazo do Contrato"
          value={form.watch('contract_term')}
          onChange={(v) => form.setValue('contract_term', v)}
          placeholder="Ex: 12 meses"
        />

        <AcqInputField
          label="Data de Expiração"
          type="date"
          value={form.watch('contract_expiry')}
          onChange={(v) => form.setValue('contract_expiry', v)}
          fullWidth
        />
      </div>

      <AcqSectionHeader title="Comissão" className="pt-2" />

      <div className="grid grid-cols-2 gap-3">
        <AcqInputField
          label="Valor da Comissão"
          required
          type="number"
          value={form.watch('commission_agreed')}
          onChange={(v) => form.setValue('commission_agreed', parseFloat(v) || 0, { shouldValidate: true })}
          placeholder="0"
          error={errors.commission_agreed?.message as string}
        />

        <AcqSelectField
          label="Tipo de Comissão"
          value={form.watch('commission_type')}
          onChange={(v) => form.setValue('commission_type', v)}
          options={[
            { value: 'percentage', label: 'Percentagem (%)' },
            { value: 'fixed', label: 'Valor Fixo (€)' },
          ]}
        />
      </div>

      <AcqSectionHeader title="Valores Adicionais" className="pt-2" />

      <div className="grid grid-cols-2 gap-3">
        <AcqInputField
          label="Valor IMI Anual"
          type="number"
          value={form.watch('imi_value')}
          onChange={(v) => form.setValue('imi_value', v ? parseFloat(v) : undefined)}
          suffix="€"
        />

        <AcqInputField
          label="Condomínio Mensal"
          type="number"
          value={form.watch('condominium_fee')}
          onChange={(v) => form.setValue('condominium_fee', v ? parseFloat(v) : undefined)}
          suffix="€"
        />

        <AcqTextareaField
          label="Notas Internas"
          value={form.watch('internal_notes')}
          onChange={(v) => form.setValue('internal_notes', v)}
          placeholder="Observações privadas sobre o imóvel ou proprietário..."
        />
      </div>
    </div>
  )
}
