'use client'

import { UseFormReturn } from 'react-hook-form'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CONTRACT_REGIMES } from '@/lib/constants'

interface StepContractProps {
  form: UseFormReturn<any>
}

export function StepContract({ form }: StepContractProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Informações Contratuais</h3>

        <FormField
          control={form.control}
          name="contract_regime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Regime Contratual *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar regime" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(CONTRACT_REGIMES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contract_term"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prazo do Contrato</FormLabel>
              <FormControl>
                <Input placeholder="Ex: 12 meses" {...field} />
              </FormControl>
              <FormDescription>
                Especifique o prazo de duração do contrato
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contract_expiry"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Expiração</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold">Comissão</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="commission_agreed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor da Comissão *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Percentagem ou valor fixo acordado
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="commission_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Comissão</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="percentage">Percentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (€)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold">Valores Adicionais (Opcional)</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="imi_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor IMI Anual</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormDescription>Em euros (€)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="condominium_fee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Condomínio Mensal</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    value={field.value || ''}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormDescription>Em euros (€)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="internal_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas Internas</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Observações privadas sobre o imóvel ou proprietário..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Estas notas são privadas e não aparecem no anúncio público
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
