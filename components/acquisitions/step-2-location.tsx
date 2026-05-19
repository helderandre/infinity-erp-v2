'use client'

import { UseFormReturn } from 'react-hook-form'
import { PropertyAddressMapPicker } from '@/components/properties/property-address-map-picker'
import {
  AcqSectionHeader,
  AcqInputField,
  AcqFieldWrapper,
  AcqFieldLabel,
} from './acquisition-field'
import {
  AdminDivisionAutocomplete,
  type DivisionPick,
} from '@/components/shared/admin-division-autocomplete'

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

  // Auto-preenche os pais a partir da escolha do utilizador, mas só campos
  // que ainda não tenham valor — não destruímos o que o consultor já digitou.
  const applyParents = (pick: DivisionPick) => {
    if (pick.concelho && !form.getValues('city')) {
      form.setValue('city', pick.concelho, { shouldDirty: true })
    }
    if (pick.distrito && !form.getValues('zone')) {
      form.setValue('zone', pick.distrito, { shouldDirty: true })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center gap-2 pt-1 pb-2">
        <h3 className="text-2xl font-semibold tracking-tight">Localização</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Onde fica o imóvel — escolhe o ponto exacto no mapa para preencher tudo.
        </p>
      </div>

      <AcqSectionHeader title="Localização do Imóvel" />

      <PropertyAddressMapPicker
        address={form.watch('address_street')}
        postalCode={form.watch('postal_code')}
        city={form.watch('city')}
        zone={form.watch('zone')}
        parish={form.watch('address_parish')}
        latitude={form.watch('latitude')}
        longitude={form.watch('longitude')}
        onAddressChange={(v) => form.setValue('address_street', v, { shouldDirty: true })}
        onPostalCodeChange={(v) => form.setValue('postal_code', v, { shouldDirty: true })}
        onCityChange={(v) => form.setValue('city', v, { shouldDirty: true })}
        onZoneChange={(v) => form.setValue('zone', v, { shouldDirty: true })}
        onParishChange={(v) => form.setValue('address_parish', v, { shouldDirty: true })}
        onLatitudeChange={(v) => form.setValue('latitude', v)}
        onLongitudeChange={(v) => form.setValue('longitude', v)}
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Concelho (city) — autocomplete contra admin_areas; ao escolher,
            preenche distrito (zone) se vazio. */}
        <AcqFieldWrapper
          isAiFilled={ai('city')}
          isMissing={isEmpty('city')}
          className={errors.city ? 'border-destructive' : undefined}
        >
          <AcqFieldLabel required>Concelho</AcqFieldLabel>
          <AdminDivisionAutocomplete
            type="concelho"
            value={form.watch('city') || ''}
            onChange={(v) => form.setValue('city', v, { shouldDirty: true })}
            onPick={applyParents}
            placeholder="Ex: Lisboa"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-7 text-sm"
          />
          {errors.city?.message && (
            <p className="mt-1 text-[10px] text-destructive">{String(errors.city.message)}</p>
          )}
        </AcqFieldWrapper>

        {/* Distrito (zone) — autocomplete; sem pais para auto-preencher. */}
        <AcqFieldWrapper>
          <AcqFieldLabel>Distrito</AcqFieldLabel>
          <AdminDivisionAutocomplete
            type="distrito"
            value={form.watch('zone') || ''}
            onChange={(v) => form.setValue('zone', v, { shouldDirty: true })}
            onPick={applyParents}
            placeholder="Ex: Lisboa"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-7 text-sm"
          />
        </AcqFieldWrapper>

        {/* Freguesia (address_parish) — autocomplete; ao escolher preenche
            concelho + distrito se vazios. */}
        <AcqFieldWrapper fullWidth isAiFilled={ai('address_parish')}>
          <AcqFieldLabel>Freguesia</AcqFieldLabel>
          <AdminDivisionAutocomplete
            type="freguesia"
            value={form.watch('address_parish') || ''}
            onChange={(v) => form.setValue('address_parish', v, { shouldDirty: true })}
            onPick={applyParents}
            placeholder="Ex: Santa Maria Maior"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-7 text-sm"
          />
        </AcqFieldWrapper>

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
