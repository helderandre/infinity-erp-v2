'use client'

import { useFormContext } from 'react-hook-form'
import { FormItem, FormLabel, FormDescription } from '@/components/ui/form'
import { PropertyAddressMapPicker } from '@/components/properties/property-address-map-picker'
import type { FieldRendererProps } from './dynamic-form-renderer'

/**
 * Renderer para o campo composto `address_map`.
 * Integra o PropertyAddressMapPicker com react-hook-form.
 *
 * Cria 6 sub-campos no form state:
 *   property__city, property__zone, property__address_street,
 *   property__postal_code, property__latitude, property__longitude
 *
 * Latitude/longitude são preenchidos automaticamente pelo Mapbox
 * mas não aparecem como inputs visíveis.
 */
export function AddressMapFieldRenderer({ field }: FieldRendererProps) {
  const form = useFormContext()
  const entity = field.target_entity

  // Keys compostas para os sub-campos
  const cityKey = `${entity}__city`
  const zoneKey = `${entity}__zone`
  const addressKey = `${entity}__address_street`
  const postalKey = `${entity}__postal_code`
  const latKey = `${entity}__latitude`
  const lngKey = `${entity}__longitude`

  return (
    <FormItem>
      <FormLabel>
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </FormLabel>
      {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
      <PropertyAddressMapPicker
        address={(form.watch(addressKey) as string) || ''}
        postalCode={(form.watch(postalKey) as string) || ''}
        city={(form.watch(cityKey) as string) || ''}
        zone={(form.watch(zoneKey) as string) || ''}
        latitude={(form.watch(latKey) as number) ?? null}
        longitude={(form.watch(lngKey) as number) ?? null}
        onAddressChange={(v) => form.setValue(addressKey, v, { shouldDirty: true })}
        onPostalCodeChange={(v) => form.setValue(postalKey, v, { shouldDirty: true })}
        onCityChange={(v) => form.setValue(cityKey, v, { shouldDirty: true })}
        onZoneChange={(v) => form.setValue(zoneKey, v, { shouldDirty: true })}
        onLatitudeChange={(v) => form.setValue(latKey, v ?? undefined, { shouldDirty: true })}
        onLongitudeChange={(v) => form.setValue(lngKey, v ?? undefined, { shouldDirty: true })}
      />
    </FormItem>
  )
}
