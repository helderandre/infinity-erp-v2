'use client'

import { useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, User, ChevronDown, UserPlus, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AcqTextareaField } from '@/components/acquisitions/acquisition-field'
import { OwnerKycSingular } from '@/components/acquisitions/owner-kyc-singular'
import { OwnerKycColetiva } from '@/components/acquisitions/owner-kyc-coletiva'
import { OwnerBeneficiariesList } from '@/components/acquisitions/owner-beneficiaries-list'
import {
  ContactPickerDialog,
  type PickedContact,
} from '@/components/shared/contact-picker-dialog'
import type { DealScenario, BusinessType } from '@/types/deal'

interface StepClientesProps {
  form: UseFormReturn<any>
  errors: Record<string, string>
}

export function StepClientes({ form, errors }: StepClientesProps) {
  const scenario = form.watch('scenario') as DealScenario | undefined
  const businessType = form.watch('business_type') as BusinessType | undefined
  const clients = form.watch('clients') || []
  const personType = form.watch('person_type')
  const isDisabled = scenario === 'comprador_externo'

  const [pickerOpen, setPickerOpen] = useState(false)
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set([0]))

  const clientLabel = businessType === 'arrendamento'
    ? 'Arrendatários'
    : businessType === 'trespasse'
      ? 'Trespassários'
      : 'Compradores'

  const toggleExpanded = (index: number) => {
    setExpandedClients((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const setMainContact = (index: number) => {
    const updated = clients.map((c: any, i: number) => ({ ...c, is_main_contact: i === index }))
    form.setValue('clients', updated)
  }

  const addClient = () => {
    const newClient = {
      person_type: personType || 'singular',
      name: '',
      email: '',
      phone: '',
      nif: '',
      is_main_contact: clients.length === 0,
      order_index: clients.length,
      is_pep: false,
      funds_origin: [],
      is_portugal_resident: true,
      country_of_incorporation: 'Portugal',
      beneficiaries: [],
    }
    form.setValue('clients', [...clients, newClient])
    setExpandedClients((prev) => new Set([...prev, clients.length]))
  }

  const addClientFromContact = (c: PickedContact) => {
    const newClient = {
      id: c.source === 'lead' ? c.id : undefined,
      person_type: c.person_type || personType || 'singular',
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      nif: c.nif || '',
      is_main_contact: clients.length === 0,
      order_index: clients.length,
      is_pep: false,
      funds_origin: [],
      is_portugal_resident: true,
      country_of_incorporation: 'Portugal',
      beneficiaries: [],
    }
    form.setValue('clients', [...clients, newClient])
    setExpandedClients((prev) => new Set([...prev, clients.length]))
  }

  const removeClient = (index: number) => {
    const updated = clients.filter((_: any, i: number) => i !== index)
    if (clients[index]?.is_main_contact && updated.length > 0) {
      updated[0].is_main_contact = true
    }
    form.setValue('clients', updated)
  }

  if (isDisabled) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Não necessitas preencher pois os clientes não são teus</span>
        </div>
        <AcqTextareaField
          label="Observações sobre o/s cliente/s"
          value={form.watch('clients_notes')}
          onChange={(v) => form.setValue('clients_notes', v)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{clientLabel}</h3>
          <p className="text-sm text-muted-foreground">Adicione pelo menos um cliente</p>
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
          <Button type="button" onClick={addClient} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      {clients.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Nenhum cliente adicionado</p>
            <Button type="button" variant="outline" onClick={addClient} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar primeiro cliente
            </Button>
          </CardContent>
        </Card>
      )}

      {clients.map((client: any, index: number) => {
        const isExpanded = expandedClients.has(index)
        const clientName = client.name?.trim() || `Cliente ${index + 1}`
        const clientNif = client.nif ? ` · NIF ${client.nif}` : ''
        const clientType = client.person_type === 'coletiva' ? 'Empresa' : 'Singular'

        return (
          <Card key={index}>
            <CardContent className="p-0">
              <button
                type="button"
                onClick={() => toggleExpanded(index)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-accent/30 transition-colors"
              >
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    isExpanded && 'rotate-180',
                  )}
                />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{clientName}</span>
                    {client.is_main_contact && (
                      <Badge variant="default" className="text-[10px] shrink-0">
                        Principal
                      </Badge>
                    )}
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {clientType}
                      {clientNif}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeClient(index)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </button>

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
                      name={`clients.${index}.person_type`}
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
                      name={`clients.${index}.name`}
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
                        name={`clients.${index}.email`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="email@exemplo.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`clients.${index}.phone`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telemóvel *</FormLabel>
                            <FormControl>
                              <Input placeholder="+351 912 345 678" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`clients.${index}.nif`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NIF</FormLabel>
                          <FormControl>
                            <Input placeholder="123456789" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`clients.${index}.is_main_contact`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                if (checked) setMainContact(index)
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Definir como contacto principal</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* KYC Condicional — reusa os componentes do Owners com pathPrefix='clients' */}
                    {form.watch(`clients.${index}.person_type`) === 'singular' && (
                      <OwnerKycSingular form={form} index={index} pathPrefix="clients" />
                    )}

                    {form.watch(`clients.${index}.person_type`) === 'coletiva' && (
                      <>
                        <OwnerKycColetiva form={form} index={index} pathPrefix="clients" />
                        {!form.watch(`clients.${index}.rcbe_code`) && (
                          <OwnerBeneficiariesList form={form} ownerIndex={index} pathPrefix="clients" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {errors.clients && <p className="text-xs text-destructive">{errors.clients}</p>}

      <AcqTextareaField
        label="Observações sobre o/s cliente/s"
        value={form.watch('clients_notes')}
        onChange={(v) => form.setValue('clients_notes', v)}
      />

      <ContactPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kind="lead"
        title="Importar contacto"
        description="Pesquisa um lead existente para preencher os dados do cliente."
        onSelect={addClientFromContact}
      />
    </div>
  )
}
