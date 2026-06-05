'use client'

import { UseFormReturn } from 'react-hook-form'
import {
  AcqSectionHeader,
  AcqInputField,
  AcqTextareaField,
  AcqSelectField,
  AcqSwitchField,
} from './acquisition-field'
import { CONTRACT_REGIMES } from '@/lib/constants'

const STANDARD_CONTRACT_TERM = '6 meses'

// No formulário de angariação só fazem sentido os regimes contratuais
// vinculativos (Exclusivo / Não Exclusivo). "Angariação" é um valor legacy
// que continua a existir em CONTRACT_REGIMES para descodificar rows antigas
// mas não deve ser oferecido em novos contratos.
const ACQUISITION_CONTRACT_REGIMES = {
  exclusivo: CONTRACT_REGIMES.exclusivo,
  nao_exclusivo: CONTRACT_REGIMES.nao_exclusivo,
} as const

interface StepContractProps {
  form: UseFormReturn<any>
}

const toOptions = (obj: Record<string, string>) =>
  Object.entries(obj).map(([value, label]) => ({ value, label }))

export function StepContract({ form }: StepContractProps) {
  const errors = form.formState.errors
  const aiFields = new Set<string>(form.watch('_aiFilledFields') || [])
  const ai = (field: string) => aiFields.has(field)
  const isEmpty = (field: string) => {
    const v = form.watch(field)
    return v === undefined || v === null || v === '' || v === 0
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center gap-2 pt-1 pb-2">
        <h3 className="text-2xl font-semibold tracking-tight">Contrato</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Regime, comissão e condições — base para emitir o CMI mais tarde.
        </p>
      </div>

      <AcqSectionHeader title="Informações Contratuais" />

      <div className="grid grid-cols-2 gap-3">
        <AcqSelectField
          label="Regime Contratual"
          required
          value={form.watch('contract_regime')}
          onChange={(v) => form.setValue('contract_regime', v, { shouldDirty: true })}
          options={toOptions(ACQUISITION_CONTRACT_REGIMES)}
          placeholder="Seleccionar regime"
          error={errors.contract_regime?.message as string}
          isAiFilled={ai('contract_regime')}
          isMissing={isEmpty('contract_regime')}
        />

        <AcqSwitchField
          label="Prazo standard (6 meses)?"
          checked={(form.watch('contract_term') || '').trim() === STANDARD_CONTRACT_TERM}
          onChange={(v) => {
            if (v) {
              form.setValue('contract_term', STANDARD_CONTRACT_TERM, { shouldDirty: true })
              form.setValue('contract_term_custom_reason', null, { shouldDirty: true })
            } else {
              // Limpa o valor para o consultor escrever um prazo concreto;
              // o textarea de justificação aparece logo de seguida.
              form.setValue('contract_term', '', { shouldDirty: true })
            }
          }}
        />
      </div>

      {(form.watch('contract_term') || '').trim() !== STANDARD_CONTRACT_TERM && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Prazo diferente do standard
          </p>
          <div className="grid grid-cols-1 gap-3">
            <AcqInputField
              label="Prazo do Contrato"
              value={form.watch('contract_term')}
              onChange={(v) => form.setValue('contract_term', v, { shouldDirty: true })}
              placeholder="Ex: 12 meses"
              isAiFilled={ai('contract_term')}
            />
            <AcqTextareaField
              label="Motivo (porquê este prazo?)"
              value={form.watch('contract_term_custom_reason') ?? ''}
              onChange={(v) =>
                form.setValue('contract_term_custom_reason', v || null, { shouldDirty: true })
              }
              placeholder="Justificação que vai ficar visível à gestão processual…"
            />
          </div>
        </div>
      )}
      {/* Data de Expiração removida — calculada automaticamente após assinatura
       *  do CMI a partir do prazo do contrato. */}

      <AcqSectionHeader title="Comissão" className="pt-2" />

      <div className="grid grid-cols-2 gap-3">
        <AcqInputField
          label="Valor da Comissão"
          required
          type="number"
          value={form.watch('commission_agreed')}
          onChange={(v) => form.setValue('commission_agreed', v === '' ? null : (parseFloat(v) || null), { shouldDirty: true })}
          placeholder="5"
          error={errors.commission_agreed?.message as string}
          isAiFilled={ai('commission_agreed')}
          isMissing={isEmpty('commission_agreed')}
        />

        <AcqSelectField
          label="Tipo de Comissão"
          value={form.watch('commission_type')}
          onChange={(v) => form.setValue('commission_type', v)}
          options={[
            { value: 'percentage', label: 'Percentagem (%)' },
            { value: 'fixed', label: 'Valor Fixo (€)' },
          ]}
          isAiFilled={ai('commission_type')}
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
