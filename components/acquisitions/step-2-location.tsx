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

interface StepLocationProps {
  form: UseFormReturn<any>
}

export function StepLocation({ form }: StepLocationProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Localização do Imóvel</h3>

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

        <FormField
          control={form.control}
          name="address_street"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Morada *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Rua do Comércio, 123"
                  {...field}
                />
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

      {/* TODO: Adicionar componente de mapa Mapbox aqui no futuro */}
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <p className="text-sm">
          Componente de mapa Mapbox será implementado aqui
        </p>
        <p className="text-xs mt-2">
          Por agora, preencha manualmente os campos de localização
        </p>
      </div>
    </div>
  )
}
