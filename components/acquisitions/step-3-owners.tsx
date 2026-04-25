'use client'

import { useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, User, ChevronDown, UserPlus } from 'lucide-react'
import { ContactPickerDialog, type PickedContact } from '@/components/shared/contact-picker-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { OwnerKycSingular } from './owner-kyc-singular'
import { OwnerKycColetiva } from './owner-kyc-coletiva'
import { OwnerBeneficiariesList } from './owner-beneficiaries-list'
import { OwnerDocumentsInline } from './owner-documents-inline'

interface StepOwnersProps {
  form: UseFormReturn<any>
}

export function StepOwners({ form }: StepOwnersProps) {
  const owners = form.watch('owners') || []
  const [expandedOwners, setExpandedOwners] = useState<Set<number>>(new Set([0]))
  const [pickerOpen, setPickerOpen] = useState(false)

  const toggleExpanded = (index: number) => {
    setExpandedOwners(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const addOwner = () => {
    const newOwner = {
      person_type: 'singular',
      name: '',
      email: '',
      phone: '',
      nif: '',
      ownership_percentage: 100,
      is_main_contact: owners.length === 0,
    }
    form.setValue('owners', [...owners, newOwner])
    setExpandedOwners(prev => new Set([...prev, owners.length]))
  }

  const addOwnerFromContact = (c: PickedContact) => {
    const newOwner = {
      id: c.source === 'owner' ? c.id : undefined, // se for owner existente, reusa o ID
      person_type: c.person_type || 'singular',
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      nif: c.nif || '',
      ownership_percentage: 100,
      is_main_contact: owners.length === 0,
    }
    form.setValue('owners', [...owners, newOwner])
    setExpandedOwners(prev => new Set([...prev, owners.length]))
  }

  const removeOwner = (index: number) => {
    const updated = owners.filter((_: any, i: number) => i !== index)
    // Se remover o contacto principal, fazer o primeiro ser o principal
    if (owners[index]?.is_main_contact && updated.length > 0) {
      updated[0].is_main_contact = true
    }
    form.setValue('owners', updated)
  }

  const setMainContact = (index: number) => {
    const updated = owners.map((owner: any, i: number) => ({
      ...owner,
      is_main_contact: i === index,
    }))
    form.setValue('owners', updated)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Proprietários</h3>
          <p className="text-sm text-muted-foreground">
            Adicione pelo menos um proprietário
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setPickerOpen(true)}
            size="sm"
            variant="outline"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button type="button" onClick={addOwner} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      {owners.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Nenhum proprietário adicionado
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={addOwner}
              className="mt-4"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Primeiro Proprietário
            </Button>
          </CardContent>
        </Card>
      )}

      {owners.map((owner: any, index: number) => {
        const isExpanded = expandedOwners.has(index)
        const ownerName = owner.name?.trim() || `Proprietário ${index + 1}`
        const ownerNif = owner.nif ? ` · NIF ${owner.nif}` : ''
        const ownerType = owner.person_type === 'coletiva' ? 'Empresa' : 'Singular'

        return (
        <Card key={index}>
          <CardContent className="p-0">
            {/* Collapsible header */}
            <button
              type="button"
              onClick={() => toggleExpanded(index)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-accent/30 transition-colors"
            >
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-180')} />
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{ownerName}</span>
                  {owner.is_main_contact && (
                    <Badge variant="default" className="text-[10px] shrink-0">Principal</Badge>
                  )}
                </div>
                {!isExpanded && (
                  <p className="text-xs text-muted-foreground mt-0.5">{ownerType}{ownerNif} · {owner.ownership_percentage || 100}%</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={(e) => { e.stopPropagation(); removeOwner(index) }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </button>

            {/* Collapsible content */}
            <div
              style={{
                display: 'grid',
                gridTemplateRows: isExpanded ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
            <div className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4">
              <FormField
                control={form.control}
                name={`owners.${index}.person_type`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Pessoa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="singular">Pessoa Singular</SelectItem>
                        <SelectItem value="coletiva">Pessoa Colectiva</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`owners.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome / Razão Social *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`owners.${index}.email`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`owners.${index}.phone`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telemóvel</FormLabel>
                      <FormControl>
                        <Input placeholder="+351 912 345 678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`owners.${index}.nif`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIF</FormLabel>
                      <FormControl>
                        <Input placeholder="123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`owners.${index}.ownership_percentage`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentagem de Propriedade</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 100)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name={`owners.${index}.is_main_contact`}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setMainContact(index)
                          }
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Definir como contacto principal</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {/* KYC Condicional */}
              {form.watch(`owners.${index}.person_type`) === 'singular' && (
                <OwnerKycSingular form={form} index={index} />
              )}

              {form.watch(`owners.${index}.person_type`) === 'coletiva' && (
                <>
                  <OwnerKycColetiva form={form} index={index} />
                  {!form.watch(`owners.${index}.rcbe_code`) && (
                    <OwnerBeneficiariesList form={form} ownerIndex={index} />
                  )}
                </>
              )}

              {/* Documentos do Proprietário */}
              {form.watch(`owners.${index}.person_type`) && (
                <OwnerDocumentsInline
                  form={form}
                  ownerIndex={index}
                  personType={form.watch(`owners.${index}.person_type`)}
                />
              )}
            </div>
            </div>
            </div>
          </CardContent>
        </Card>
        )
      })}

      <ContactPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kind="owner"
        title="Importar proprietário"
        description="Pesquisa um proprietário já existente para reusar os dados (NIF, morada, etc.)."
        onSelect={addOwnerFromContact}
      />
    </div>
  )
}
