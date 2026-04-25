'use client'

import { UseFormReturn } from 'react-hook-form'
import { useState } from 'react'
import {
  AcqSectionHeader,
  AcqInputField,
  AcqTextareaField,
  AcqSelectField,
} from './acquisition-field'
import { PropertyVoiceDescription } from './property-voice-description'
import {
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
} from '@/lib/constants'

interface StepPropertyProps {
  form: UseFormReturn<any>
}

const toOptions = (obj: Record<string, string>) =>
  Object.entries(obj).map(([value, label]) => ({ value, label }))

export function StepProperty({ form }: StepPropertyProps) {
  const errors = form.formState.errors
  const aiFields = new Set<string>(form.watch('_aiFilledFields') || [])
  const ai = (field: string) => aiFields.has(field)
  const isEmpty = (field: string) => {
    const v = form.watch(field)
    return v === undefined || v === null || v === '' || v === 0
  }

  const TYPOLOGY_OPTIONS = [
    { value: 'T0', label: 'T0' },
    { value: 'T1', label: 'T1' },
    { value: 'T2', label: 'T2' },
    { value: 'T3', label: 'T3' },
    { value: 'T4', label: 'T4' },
    { value: 'T5', label: 'T5' },
    { value: 'T5+', label: 'T5+' },
    { value: '_outro', label: 'Outro...' },
  ]
  const currentTypology = form.watch('specifications.typology') || ''
  const isStandardTypology = TYPOLOGY_OPTIONS.some(o => o.value === currentTypology && o.value !== '_outro')
  const [customTypology, setCustomTypology] = useState(!isStandardTypology && currentTypology.length > 0)

  return (
    <div className="space-y-4">
      <AcqSectionHeader title="Informações Básicas" />

      <div className="grid grid-cols-2 gap-3">
        <AcqInputField
          label="Título do Anúncio"
          required
          fullWidth
          value={form.watch('title')}
          onChange={(v) => form.setValue('title', v, { shouldDirty: true })}
          placeholder="Ex: Apartamento T2 no centro de Lisboa"
          error={errors.title?.message as string}
          isAiFilled={ai('title')}
          isMissing={isEmpty('title')}
        />

        <AcqSelectField
          label="Tipo de Imóvel"
          required
          value={form.watch('property_type')}
          onChange={(v) => form.setValue('property_type', v, { shouldDirty: true })}
          options={toOptions(PROPERTY_TYPES)}
          placeholder="Seleccionar tipo"
          error={errors.property_type?.message as string}
          isAiFilled={ai('property_type')}
          isMissing={isEmpty('property_type')}
        />

        <AcqSelectField
          label="Tipo de Negócio"
          required
          value={form.watch('business_type')}
          onChange={(v) => form.setValue('business_type', v, { shouldDirty: true })}
          options={toOptions(BUSINESS_TYPES)}
          placeholder="Seleccionar tipo"
          error={errors.business_type?.message as string}
          isAiFilled={ai('business_type')}
          isMissing={isEmpty('business_type')}
        />

        <AcqInputField
          label="Preço"
          required
          type="number"
          value={form.watch('listing_price')}
          onChange={(v) => form.setValue('listing_price', parseFloat(v) || 0, { shouldDirty: true })}
          placeholder="0"
          suffix="€"
          error={errors.listing_price?.message as string}
          isAiFilled={ai('listing_price')}
          isMissing={isEmpty('listing_price')}
        />

        <AcqSelectField
          label="Estado do Imóvel"
          value={form.watch('property_condition')}
          onChange={(v) => form.setValue('property_condition', v)}
          options={toOptions(PROPERTY_CONDITIONS)}
          placeholder="Seleccionar estado"
        />

        <AcqSelectField
          label="Certificado Energético"
          value={form.watch('energy_certificate')}
          onChange={(v) => form.setValue('energy_certificate', v)}
          options={toOptions(ENERGY_CERTIFICATES)}
          placeholder="Seleccionar classe"
          isAiFilled={ai('energy_certificate')}
        />

        <PropertyVoiceDescription form={form} />

        <AcqTextareaField
          label="Descrição"
          value={form.watch('description')}
          onChange={(v) => form.setValue('description', v)}
          placeholder="Descreva as características principais do imóvel ou utilize a gravação por voz acima..."
          rows={5}
        />
      </div>

      <AcqSectionHeader title="Especificações" className="pt-2" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {customTypology ? (
          <AcqInputField
            label="Tipologia"
            value={currentTypology}
            onChange={(v) => {
              if (!v) { setCustomTypology(false); form.setValue('specifications.typology', '') }
              else form.setValue('specifications.typology', v)
            }}
            placeholder="Escrever tipologia..."
            isAiFilled={ai('specifications.typology')}
          />
        ) : (
          <AcqSelectField
            label="Tipologia"
            value={currentTypology}
            onChange={(v) => {
              if (v === '_outro') { setCustomTypology(true); form.setValue('specifications.typology', '') }
              else form.setValue('specifications.typology', v)
            }}
            options={TYPOLOGY_OPTIONS}
            placeholder="Seleccionar"
            isAiFilled={ai('specifications.typology')}
          />
        )}

        <AcqInputField
          label="Quartos"
          type="number"
          value={form.watch('specifications.bedrooms')}
          onChange={(v) => form.setValue('specifications.bedrooms', parseInt(v) || 0)}
          isAiFilled={ai('specifications.bedrooms')}
        />

        <AcqInputField
          label="Casas de Banho"
          type="number"
          value={form.watch('specifications.bathrooms')}
          onChange={(v) => form.setValue('specifications.bathrooms', parseInt(v) || 0)}
          isAiFilled={ai('specifications.bathrooms')}
        />

        <AcqInputField
          label="Área Útil"
          type="number"
          value={form.watch('specifications.area_util')}
          onChange={(v) => form.setValue('specifications.area_util', parseFloat(v) || 0)}
          suffix="m²"
          isAiFilled={ai('specifications.area_util')}
        />

        <AcqInputField
          label="Área Bruta"
          type="number"
          value={form.watch('specifications.area_gross')}
          onChange={(v) => form.setValue('specifications.area_gross', parseFloat(v) || 0)}
          suffix="m²"
          isAiFilled={ai('specifications.area_gross')}
        />

        <AcqInputField
          label="Ano Construção"
          type="number"
          value={form.watch('specifications.construction_year')}
          onChange={(v) => form.setValue('specifications.construction_year', parseInt(v) || null)}
          placeholder="Ex: 2005"
          isAiFilled={ai('specifications.construction_year')}
        />

        <AcqInputField
          label="Estacionamento"
          type="number"
          value={form.watch('specifications.parking_spaces')}
          onChange={(v) => form.setValue('specifications.parking_spaces', parseInt(v) || 0)}
          isAiFilled={ai('specifications.parking_spaces')}
        />

        <AcqInputField
          label="Garagem"
          type="number"
          value={form.watch('specifications.garage_spaces')}
          onChange={(v) => form.setValue('specifications.garage_spaces', parseInt(v) || 0)}
        />
      </div>
    </div>
  )
}
