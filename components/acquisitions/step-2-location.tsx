'use client'

import { UseFormReturn } from 'react-hook-form'
import { PropertyAddressMapPicker } from '@/components/properties/property-address-map-picker'
import { AcqSectionHeader, AcqInputField } from './acquisition-field'

interface StepLocationProps {
  form: UseFormReturn<any>
}

export function StepLocation({ form }: StepLocationProps) {
  const errors = form.formState.errors
  const aiFields = new Set<string>(form.watch('_aiFilledFields') || [])
  const ai = (field: string) => aiFields.has(field)
  const isEmpty = (field: string) => {
    const v = form.watch(field)
    return v === undefined || v === null || v === ''
  }

  return (
    <div className="space-y-4">
      <AcqSectionHeader title="Localização do Imóvel" />

      <PropertyAddressMapPicker
        address={form.watch('address_street')}
        postalCode={form.watch('postal_code')}
        city={form.watch('city')}
        zone={form.watch('zone')}
        latitude={form.watch('latitude')}
        longitude={form.watch('longitude')}
        onAddressChange={(v) => form.setValue('address_street', v, { shouldDirty: true })}
        onPostalCodeChange={(v) => form.setValue('postal_code', v, { shouldDirty: true })}
        onCityChange={(v) => form.setValue('city', v, { shouldDirty: true })}
        onZoneChange={(v) => form.setValue('zone', v, { shouldDirty: true })}
        onLatitudeChange={(v) => form.setValue('latitude', v)}
        onLongitudeChange={(v) => form.setValue('longitude', v)}
      />

      <div className="grid grid-cols-2 gap-3">
        <AcqInputField
          label="Cidade"
          required
          value={form.watch('city')}
          onChange={(v) => form.setValue('city', v, { shouldDirty: true })}
          placeholder="Ex: Lisboa"
          error={errors.city?.message as string}
          isAiFilled={ai('city')}
          isMissing={isEmpty('city')}
        />

        <AcqInputField
          label="Zona"
          value={form.watch('zone')}
          onChange={(v) => form.setValue('zone', v)}
          placeholder="Ex: Centro"
        />

        <AcqInputField
          label="Freguesia"
          fullWidth
          value={form.watch('address_parish')}
          onChange={(v) => form.setValue('address_parish', v)}
          placeholder="Ex: Santa Maria Maior"
          isAiFilled={ai('address_parish')}
        />

        <AcqInputField
          label="Código Postal"
          value={form.watch('postal_code')}
          onChange={(v) => form.setValue('postal_code', v)}
          placeholder="1100-000"
          isAiFilled={ai('postal_code')}
        />

        <AcqInputField
          label="Latitude"
          type="number"
          value={form.watch('latitude')}
          onChange={(v) => form.setValue('latitude', v ? parseFloat(v) : null)}
          placeholder="38.7223"
          isAiFilled={ai('latitude')}
        />

        <AcqInputField
          label="Longitude"
          type="number"
          value={form.watch('longitude')}
          onChange={(v) => form.setValue('longitude', v ? parseFloat(v) : null)}
          placeholder="-9.1393"
          isAiFilled={ai('longitude')}
        />
      </div>
    </div>
  )
}
