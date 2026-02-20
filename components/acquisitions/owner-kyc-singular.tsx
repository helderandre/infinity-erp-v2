'use client'

import { useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'

const ID_DOC_TYPES = [
  { value: 'CC', label: 'Cartao de Cidadao' },
  { value: 'BI', label: 'Bilhete de Identidade' },
  { value: 'Passaporte', label: 'Passaporte' },
  { value: 'Titulo de Residencia', label: 'Titulo de Residencia' },
  { value: 'Outro', label: 'Outro' },
]

const FUNDS_ORIGINS = [
  'Salario', 'Poupancas', 'Heranca', 'Venda de Imovel',
  'Investimentos', 'Emprestimo', 'Outro',
]

const MARITAL_REGIMES = [
  { value: 'comunhao_adquiridos', label: 'Comunhao de Adquiridos' },
  { value: 'separacao_bens', label: 'Separacao de Bens' },
  { value: 'comunhao_geral', label: 'Comunhao Geral de Bens' },
  { value: 'uniao_facto', label: 'Uniao de Facto' },
]

interface OwnerKycSingularProps {
  form: UseFormReturn<any>
  index: number
}

export function OwnerKycSingular({ form, index }: OwnerKycSingularProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isPep = form.watch(`owners.${index}.is_pep`)
  const isResident = form.watch(`owners.${index}.is_portugal_resident`)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between" type="button">
          Dados KYC — Pessoa Singular
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        {/* Documento de Identificacao */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={`owners.${index}.id_doc_type`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Documento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ID_DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`owners.${index}.id_doc_number`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numero do Documento</FormLabel>
                <FormControl>
                  <Input placeholder="Numero..." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`owners.${index}.id_doc_expiry`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Validade</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`owners.${index}.id_doc_issued_by`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emitido por</FormLabel>
                <FormControl>
                  <Input placeholder="Entidade..." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Dados Pessoais */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={`owners.${index}.birth_date`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Nascimento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`owners.${index}.profession`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profissao</FormLabel>
                <FormControl>
                  <Input placeholder="Profissao actual..." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Residencia */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={`owners.${index}.is_portugal_resident`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <FormLabel>Residente em Portugal</FormLabel>
                <FormControl>
                  <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          {isResident === false && (
            <FormField
              control={form.control}
              name={`owners.${index}.residence_country`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pais de Residencia</FormLabel>
                  <FormControl>
                    <Input placeholder="Pais..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Regime Matrimonial */}
        <FormField
          control={form.control}
          name={`owners.${index}.marital_regime`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Regime Matrimonial</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MARITAL_REGIMES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* PEP */}
        <div className="space-y-2">
          <FormField
            control={form.control}
            name={`owners.${index}.is_pep`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <FormLabel>Pessoa Politicamente Exposta (PEP)</FormLabel>
                <FormControl>
                  <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          {isPep && (
            <FormField
              control={form.control}
              name={`owners.${index}.pep_position`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo PEP</FormLabel>
                  <FormControl>
                    <Input placeholder="Cargo ou funcao..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Origem de Fundos */}
        <FormField
          control={form.control}
          name={`owners.${index}.funds_origin`}
          render={() => (
            <FormItem>
              <FormLabel>Origem dos Fundos</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {FUNDS_ORIGINS.map((origin) => (
                  <FormField
                    key={origin}
                    control={form.control}
                    name={`owners.${index}.funds_origin`}
                    render={({ field }) => {
                      const currentValue = field.value || []
                      return (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={currentValue.includes(origin)}
                              onCheckedChange={(checked) => {
                                const updated = checked
                                  ? [...currentValue, origin]
                                  : currentValue.filter((v: string) => v !== origin)
                                field.onChange(updated)
                              }}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">{origin}</FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}
