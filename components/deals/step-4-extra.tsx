'use client'

import { UseFormReturn } from 'react-hook-form'
import { DealYesNo } from './deal-toggle-group'
import {
  AcqFieldWrapper,
  AcqFieldLabel,
  AcqSelectField,
  AcqTextareaField,
} from '@/components/acquisitions/acquisition-field'
import { HOUSING_REGIMES } from '@/types/deal'
import type { DealFormData } from '@/lib/validations/deal'
import type { BusinessType, HousingRegime } from '@/types/deal'

interface StepExtraProps {
  form: any
  errors: Record<string, string>
}

export function StepExtra({ form, errors }: StepExtraProps) {
  const businessType = form.watch('business_type') as BusinessType | undefined
  const hasFinancing = form.watch('has_financing')

  const isVenda = businessType === 'venda'
  const isArrendamento = businessType === 'arrendamento'
  const isTrespasse = businessType === 'trespasse'

  const showFiador = isArrendamento || isTrespasse
  const showFinancing = isVenda
  const showFinancingCondition = isVenda && hasFinancing === true
  const showSignatureRecognition = isVenda
  const showRegime = isVenda || isArrendamento

  const mobiliaLabel = isTrespasse
    ? 'O imovel vai ser trespassado com mobilia/equipamentos?'
    : isArrendamento
    ? 'O imovel vai ser arrendado com mobilia?'
    : 'O imovel vai ser vendido com mobilia?'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Fiador — Arrendamento + Trespasse */}
        {showFiador && (
          <AcqFieldWrapper>
            <AcqFieldLabel required>Tem Fiador?</AcqFieldLabel>
            <div className="mt-2">
              <DealYesNo
                value={form.watch('has_guarantor')}
                onChange={(v) => form.setValue('has_guarantor', v)}
                error={errors.has_guarantor}
              />
            </div>
          </AcqFieldWrapper>
        )}

        {/* Mobilia — All */}
        <AcqFieldWrapper>
          <AcqFieldLabel required>{mobiliaLabel}</AcqFieldLabel>
          <div className="mt-2">
            <DealYesNo
              value={form.watch('has_furniture')}
              onChange={(v) => form.setValue('has_furniture', v)}
              error={errors.has_furniture}
            />
          </div>
        </AcqFieldWrapper>

        {/* Bilingue — All */}
        <AcqFieldWrapper>
          <AcqFieldLabel required>Contrato bilingue (PT/ENG)?</AcqFieldLabel>
          <div className="mt-2">
            <DealYesNo
              value={form.watch('is_bilingual')}
              onChange={(v) => form.setValue('is_bilingual', v)}
              error={errors.is_bilingual}
            />
          </div>
        </AcqFieldWrapper>

        {/* Financiamento — Venda only */}
        {showFinancing && (
          <AcqFieldWrapper>
            <AcqFieldLabel required>Há Financiamento?</AcqFieldLabel>
            <div className="mt-2">
              <DealYesNo
                value={form.watch('has_financing')}
                onChange={(v) => form.setValue('has_financing', v)}
                error={errors.has_financing}
              />
            </div>
          </AcqFieldWrapper>
        )}

        {/* Condicao Resolutiva — Venda + financing */}
        {showFinancingCondition && (
          <AcqFieldWrapper>
            <AcqFieldLabel required>Condição Resolutiva?</AcqFieldLabel>
            <div className="mt-2">
              <DealYesNo
                value={form.watch('has_financing_condition')}
                onChange={(v) => form.setValue('has_financing_condition', v)}
                error={errors.has_financing_condition}
              />
            </div>
          </AcqFieldWrapper>
        )}

        {/* Reconhecimento Assinaturas — Venda only */}
        {showSignatureRecognition && (
          <AcqFieldWrapper>
            <AcqFieldLabel required>Reconhecimento de Assinaturas?</AcqFieldLabel>
            <div className="mt-2">
              <DealYesNo
                value={form.watch('has_signature_recognition')}
                onChange={(v) => form.setValue('has_signature_recognition', v)}
                error={errors.has_signature_recognition}
              />
            </div>
          </AcqFieldWrapper>
        )}

        {/* Regime — Venda + Arrendamento */}
        {showRegime && (
          <AcqSelectField
            label="Regime"
            value={form.watch('housing_regime')}
            onChange={(v) => form.setValue('housing_regime', v as HousingRegime)}
            options={Object.entries(HOUSING_REGIMES).map(([value, label]) => ({ value, label }))}
            placeholder="Seleccionar..."
            required
            error={errors.housing_regime}
          />
        )}
      </div>

      {/* Extra info */}
      <AcqTextareaField
        label="Informacao Adicional Relevante"
        value={form.watch('extra_info')}
        onChange={(v) => form.setValue('extra_info', v)}
        placeholder="Por exemplo: Existencia de Procuracoes, etc.."
      />
    </div>
  )
}
