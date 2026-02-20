'use client'

import { UseFormReturn } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PropertyAddressMapPicker } from '@/components/properties/property-address-map-picker'

interface StepLocationProps {
  form: UseFormReturn<any>
}

export function StepLocation({ form }: StepLocationProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Localização do Imóvel</h3>

        {/* Mapbox Autocomplete + Mapa Interactivo */}
        <PropertyAddressMapPicker
          address={form.watch('address_street')}
          postalCode={form.watch('postal_code')}
          city={form.watch('city')}
          zone={form.watch('zone')}
          latitude={form.watch('latitude')}
          longitude={form.watch('longitude')}
          onAddressChange={(v) => form.setValue('address_street', v, { shouldValidate: true })}
          onPostalCodeChange={(v) => form.setValue('postal_code', v, { shouldValidate: true })}
          onCityChange={(v) => form.setValue('city', v, { shouldValidate: true })}
          onZoneChange={(v) => form.setValue('zone', v, { shouldValidate: true })}
          onLatitudeChange={(v) => form.setValue('latitude', v)}
          onLongitudeChange={(v) => form.setValue('longitude', v)}
        />

        {/* Fields preenchidos pelo Mapbox (editáveis manualmente) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Lisboa" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="zone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zona</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Centro" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address_parish"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Freguesia</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Santa Maria Maior" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="postal_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código Postal *</FormLabel>
                <FormControl>
                  <Input placeholder="1100-000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="latitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitude</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="38.7223"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="longitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitude</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="-9.1393"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  )
}
