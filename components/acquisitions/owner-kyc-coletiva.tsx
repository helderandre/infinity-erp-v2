'use client'

import { useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'

const LEGAL_NATURES = [
  { value: 'unipessoal', label: 'Sociedade Unipessoal' },
  { value: 'quotas', label: 'Sociedade por Quotas' },
  { value: 'anonima', label: 'Sociedade Anonima' },
  { value: 'associacao', label: 'Associacao' },
  { value: 'fundacao', label: 'Fundacao' },
  { value: 'outro', label: 'Outro' },
]

interface OwnerKycColetivaProps {
  form: UseFormReturn<any>
  index: number
}

export function OwnerKycColetiva({ form, index }: OwnerKycColetivaProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between" type="button">
          Dados KYC — Pessoa Colectiva
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={`owners.${index}.company_object`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Objecto Social</FormLabel>
                <FormControl>
                  <Input placeholder="Objecto social..." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`owners.${index}.company_branches`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estabelecimentos</FormLabel>
                <FormControl>
                  <Input placeholder="Estabelecimentos..." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={`owners.${index}.legal_nature`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Natureza Juridica</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LEGAL_NATURES.map((n) => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`owners.${index}.country_of_incorporation`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pais de Constituicao</FormLabel>
                <FormControl>
                  <Input placeholder="Portugal" {...field} value={field.value || 'Portugal'} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={`owners.${index}.cae_code`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Codigo CAE</FormLabel>
                <FormControl>
                  <Input placeholder="CAE..." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`owners.${index}.rcbe_code`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Codigo RCBE</FormLabel>
                <FormControl>
                  <Input placeholder="RCBE (se aplicavel)..." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
