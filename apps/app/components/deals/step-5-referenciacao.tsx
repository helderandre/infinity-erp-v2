'use client'

import { useEffect, useState } from 'react'
import { DealToggleGroup, DealYesNo } from './deal-toggle-group'
import {
  AcqFieldWrapper,
  AcqFieldLabel,
  AcqInputField,
  AcqSelectField,
  AcqTextareaField,
} from '@/components/acquisitions/acquisition-field'
import { CheckCircle } from 'lucide-react'
import type { DealScenario, ReferralType } from '@/types/deal'

interface StepReferenciacaoProps {
  form: any
  errors: Record<string, string>
}

export function StepReferenciacao({ form, errors }: StepReferenciacaoProps) {
  const isEmpty = (field: string) => {
    const v = form.watch(field)
    return v === undefined || v === null || v === '' || v === 0
  }

  const scenario = form.watch('scenario') as DealScenario | undefined
  const hasReferral = form.watch('has_referral')
  const referralType = form.watch('referral_type')
  const [consultants, setConsultants] = useState<{ value: string; label: string }[]>([])

  const isDisabled = scenario === 'comprador_externo'

  useEffect(() => {
    fetch('/api/consultants?per_page=100&status=active')
      .then((r) => r.json())
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data
        if (Array.isArray(list)) {
          setConsultants(list.map((c: { id: string; commercial_name: string }) => ({
            value: c.id,
            label: c.commercial_name,
          })))
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      {isDisabled ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>O comprador é externo, logo não há referência no negócio, só na Angariação</span>
        </div>
      ) : (
        <>
          <AcqFieldWrapper fullWidth isMissing={hasReferral === undefined || hasReferral === null}>
            <AcqFieldLabel required>Existe Referência?</AcqFieldLabel>
            <div className="mt-2">
              <DealYesNo
                value={hasReferral}
                onChange={(v) => form.setValue('has_referral', v)}
                error={errors.has_referral}
              />
            </div>
          </AcqFieldWrapper>

          {hasReferral && (
            <>
              <AcqInputField
                label="Quanto?"
                value={form.watch('referral_pct')}
                onChange={(v) => form.setValue('referral_pct', parseFloat(v) || 0)}
                suffix="%"
                placeholder="exemplo: 25"
                required
                fullWidth
                error={errors.referral_pct}
                isMissing={isEmpty('referral_pct')}
              />

              <AcqFieldWrapper fullWidth isMissing={isEmpty('referral_type')}>
                <AcqFieldLabel required>Referenciação</AcqFieldLabel>
                <div className="mt-2">
                  <DealToggleGroup
                    value={referralType}
                    onChange={(v) => form.setValue('referral_type', v as ReferralType)}
                    options={[
                      { value: 'interna', label: 'Interna' },
                      { value: 'externa', label: 'Externa' },
                    ]}
                    error={errors.referral_type}
                  />
                </div>
              </AcqFieldWrapper>

              {/* Interna — select consultant */}
              {referralType === 'interna' && (
                <AcqSelectField
                  label="Consultor referenciado"
                  value={form.watch('referral_info')}
                  onChange={(v) => form.setValue('referral_info', v)}
                  options={consultants}
                  placeholder="Seleccionar consultor..."
                  required
                  fullWidth
                  error={errors.referral_info}
                  isMissing={isEmpty('referral_info')}
                />
              )}

              {/* Externa — full contact info */}
              {referralType === 'externa' && (
                <AcqTextareaField
                  label="Informação do referenciado"
                  value={form.watch('referral_info')}
                  onChange={(v) => form.setValue('referral_info', v)}
                  placeholder={'Nome\nContacto\nEmail\nAgência'}
                  required
                  rows={4}
                  isMissing={isEmpty('referral_info')}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
