'use client'

import { UseFormReturn } from 'react-hook-form'
import {
  AcqSectionHeader,
  AcqInputField,
  AcqTextareaField,
  AcqSelectField,
} from './acquisition-field'
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

  return (
    <div className="space-y-4">
      <AcqSectionHeader title="Informações Básicas" />

      <div className="grid grid-cols-2 gap-3">
        <AcqInputField
          label="Título do Anúncio"
          required
          fullWidth
          value={form.watch('title')}
          onChange={(v) => form.setValue('title', v, { shouldValidate: true })}
          placeholder="Ex: Apartamento T2 no centro de Lisboa"
          error={errors.title?.message as string}
        />

        <AcqSelectField
          label="Tipo de Imóvel"
          required
          value={form.watch('property_type')}
          onChange={(v) => form.setValue('property_type', v, { shouldValidate: true })}
          options={toOptions(PROPERTY_TYPES)}
          placeholder="Seleccionar tipo"
          error={errors.property_type?.message as string}
        />

        <AcqSelectField
          label="Tipo de Negócio"
          required
          value={form.watch('business_type')}
          onChange={(v) => form.setValue('business_type', v, { shouldValidate: true })}
          options={toOptions(BUSINESS_TYPES)}
          placeholder="Seleccionar tipo"
          error={errors.business_type?.message as string}
        />

        <AcqInputField
          label="Preço"
          required
          type="number"
          value={form.watch('listing_price')}
          onChange={(v) => form.setValue('listing_price', parseFloat(v) || 0, { shouldValidate: true })}
          placeholder="0"
          suffix="€"
          error={errors.listing_price?.message as string}
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
        />

        <AcqTextareaField
          label="Descrição"
          value={form.watch('description')}
          onChange={(v) => form.setValue('description', v)}
          placeholder="Descreva as características principais do imóvel..."
          rows={3}
        />
      </div>

      <AcqSectionHeader title="Especificações" className="pt-2" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AcqInputField
          label="Tipologia"
          value={form.watch('specifications.typology')}
          onChange={(v) => form.setValue('specifications.typology', v)}
          placeholder="Ex: T2"
        />

        <AcqInputField
          label="Quartos"
          type="number"
          value={form.watch('specifications.bedrooms')}
          onChange={(v) => form.setValue('specifications.bedrooms', parseInt(v) || 0)}
        />

        <AcqInputField
          label="Casas de Banho"
          type="number"
          value={form.watch('specifications.bathrooms')}
          onChange={(v) => form.setValue('specifications.bathrooms', parseInt(v) || 0)}
        />

        <AcqInputField
          label="Área Útil"
          type="number"
          value={form.watch('specifications.area_util')}
          onChange={(v) => form.setValue('specifications.area_util', parseFloat(v) || 0)}
          suffix="m²"
        />

        <AcqInputField
          label="Área Bruta"
          type="number"
          value={form.watch('specifications.area_gross')}
          onChange={(v) => form.setValue('specifications.area_gross', parseFloat(v) || 0)}
          suffix="m²"
        />

        <AcqInputField
          label="Ano Construção"
          type="number"
          value={form.watch('specifications.construction_year')}
          onChange={(v) => form.setValue('specifications.construction_year', parseInt(v) || null)}
          placeholder="Ex: 2005"
        />

        <AcqInputField
          label="Estacionamento"
          type="number"
          value={form.watch('specifications.parking_spaces')}
          onChange={(v) => form.setValue('specifications.parking_spaces', parseInt(v) || 0)}
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
