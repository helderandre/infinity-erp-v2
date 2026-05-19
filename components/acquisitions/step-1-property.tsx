'use client'

import { UseFormReturn } from 'react-hook-form'
import {
  AcqSectionHeader,
  AcqInputField,
  AcqSelectField,
  AcqSelectFieldWithOther,
} from './acquisition-field'
import {
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
  TYPOLOGIES,
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

  const currentTypology = form.watch('specifications.typology') || ''

  return (
    <div className="space-y-5">
      {/* Hero centrado — alinha com Documentos / Proprietários. O label do
          passo já não aparece no stepper, por isso vive aqui. */}
      <div className="flex flex-col items-center text-center gap-2 pt-1 pb-2">
        <h3 className="text-2xl font-semibold tracking-tight">Dados do Imóvel</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Informação base sobre o imóvel — quanto mais preencheres, melhor.
        </p>
      </div>

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

        <AcqSelectFieldWithOther
          label="Tipo de Imóvel"
          required
          scope="property_type"
          value={form.watch('property_type')}
          onChange={(v) => form.setValue('property_type', v, { shouldDirty: true })}
          options={Object.entries(PROPERTY_TYPES)
            .filter(([key]) => key !== 'outro')
            .map(([value, label]) => ({ value, label }))}
          legacyLabels={PROPERTY_TYPES as unknown as Record<string, string>}
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
          onChange={(v) => form.setValue('listing_price', v === '' ? null : (parseFloat(v) || null), { shouldDirty: true })}
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
          onChange={(v) => {
            // `_na` ("Não aplicável") é sentinela — grava como string vazia,
            // mantendo a coluna do DB livre e o imóvel sem CE atribuído.
            if (v === '_na') form.setValue('energy_certificate', '')
            else form.setValue('energy_certificate', v)
          }}
          options={[
            { value: '_na', label: 'Não aplicável' },
            ...toOptions(ENERGY_CERTIFICATES),
          ]}
          placeholder="Seleccionar classe"
          isAiFilled={ai('energy_certificate')}
        />

      </div>

      <AcqSectionHeader title="Especificações" className="pt-2" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AcqSelectFieldWithOther
          label="Tipologia"
          scope="typology"
          value={currentTypology}
          onChange={(v) => form.setValue('specifications.typology', v, { shouldDirty: true })}
          options={TYPOLOGIES.map((t) => ({ value: t, label: t }))}
          placeholder="Seleccionar"
          isAiFilled={ai('specifications.typology')}
        />

        <AcqInputField
          label="Quartos"
          type="number"
          value={form.watch('specifications.bedrooms')}
          onChange={(v) => form.setValue('specifications.bedrooms', v === '' ? null : (parseInt(v) || null))}
          isAiFilled={ai('specifications.bedrooms')}
        />

        <AcqInputField
          label="Casas de Banho"
          type="number"
          value={form.watch('specifications.bathrooms')}
          onChange={(v) => form.setValue('specifications.bathrooms', v === '' ? null : (parseInt(v) || null))}
          isAiFilled={ai('specifications.bathrooms')}
        />

        <AcqInputField
          label="Área Útil"
          type="number"
          value={form.watch('specifications.area_util')}
          onChange={(v) => form.setValue('specifications.area_util', v === '' ? null : (parseFloat(v) || null))}
          suffix="m²"
          isAiFilled={ai('specifications.area_util')}
        />

        <AcqInputField
          label="Área Bruta"
          type="number"
          value={form.watch('specifications.area_gross')}
          onChange={(v) => form.setValue('specifications.area_gross', v === '' ? null : (parseFloat(v) || null))}
          suffix="m²"
          isAiFilled={ai('specifications.area_gross')}
        />

        <AcqInputField
          label="Ano Construção"
          type="number"
          value={form.watch('specifications.construction_year')}
          onChange={(v) => form.setValue('specifications.construction_year', v === '' ? null : (parseInt(v) || null))}
          placeholder="Ex: 2005"
          isAiFilled={ai('specifications.construction_year')}
        />

        <AcqInputField
          label="Estacionamento"
          type="number"
          value={form.watch('specifications.parking_spaces')}
          onChange={(v) => form.setValue('specifications.parking_spaces', v === '' ? null : (parseInt(v) || null))}
          isAiFilled={ai('specifications.parking_spaces')}
        />

        <AcqInputField
          label="Garagem"
          type="number"
          value={form.watch('specifications.garage_spaces')}
          onChange={(v) => form.setValue('specifications.garage_spaces', v === '' ? null : (parseInt(v) || null))}
        />
      </div>
    </div>
  )
}
