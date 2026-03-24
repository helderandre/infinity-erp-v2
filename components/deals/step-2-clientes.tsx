'use client'

import { UseFormReturn } from 'react-hook-form'
import { DealToggleGroup } from './deal-toggle-group'
import {
  AcqFieldWrapper,
  AcqFieldLabel,
  AcqInputField,
  AcqTextareaField,
} from '@/components/acquisitions/acquisition-field'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, AlertTriangle, Info } from 'lucide-react'
import type { DealFormData } from '@/lib/validations/deal'
import type { DealScenario, BusinessType } from '@/types/deal'

interface StepClientesProps {
  form: any
  errors: Record<string, string>
}

export function StepClientes({ form, errors }: StepClientesProps) {
  const isEmpty = (field: string) => {
    const v = form.watch(field)
    return v === undefined || v === null || v === '' || v === 0
  }

  const isClientFieldEmpty = (index: number, field: string) => {
    const clients = form.watch('clients') || []
    const v = clients[index]?.[field]
    return v === undefined || v === null || v === ''
  }

  const scenario = form.watch('scenario') as DealScenario | undefined
  const businessType = form.watch('business_type') as BusinessType | undefined
  const clients = form.watch('clients') || []
  const personType = form.watch('person_type')

  const isDisabled = scenario === 'comprador_externo'

  const clientLabel = businessType === 'arrendamento' ? 'Arrendatarios'
    : businessType === 'trespasse' ? 'Trespassarios'
    : 'Compradores'

  const addClient = () => {
    form.setValue('clients', [
      ...clients,
      { person_type: personType || 'singular', name: '', email: '', phone: '', order_index: clients.length },
    ])
  }

  const removeClient = (index: number) => {
    const updated = clients.filter((_: unknown, i: number) => i !== index)
    form.setValue('clients', updated)
  }

  const updateClient = (index: number, field: string, value: string) => {
    const updated = [...clients]
    updated[index] = { ...updated[index], [field]: value }
    form.setValue('clients', updated)
  }

  return (
    <div className="space-y-5">
      {isDisabled ? (
        <>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Nao necessitas preencher pois os clientes nao sao teus</span>
          </div>
          <AcqTextareaField
            label="Observacoes sobre o/s cliente/s"
            value={form.watch('clients_notes')}
            onChange={(v) => form.setValue('clients_notes', v)}
          />
        </>
      ) : (
        <>
          {/* Person type */}
          <AcqFieldWrapper fullWidth>
            <AcqFieldLabel required>Pessoa</AcqFieldLabel>
            <div className="mt-2">
              <DealToggleGroup
                value={personType}
                onChange={(v) => form.setValue('person_type', v as 'singular' | 'coletiva')}
                options={[
                  { value: 'singular', label: 'Singular' },
                  { value: 'coletiva', label: 'Coletiva' },
                ]}
              />
            </div>
          </AcqFieldWrapper>

          {/* Client list */}
          {clients.map((client: any, index: number) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cliente {index + 1}
                </span>
                {clients.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeClient(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <AcqInputField
                  label="Nome"
                  value={client.name}
                  onChange={(v) => updateClient(index, 'name', v)}
                  required
                  isMissing={isClientFieldEmpty(index, 'name')}
                />
                <AcqInputField
                  label="Email"
                  value={client.email}
                  onChange={(v) => updateClient(index, 'email', v)}
                  required
                />
                <AcqInputField
                  label="Contacto"
                  value={client.phone}
                  onChange={(v) => updateClient(index, 'phone', v)}
                  required
                />
              </div>
            </div>
          ))}

          {errors.clients && (
            <p className="text-xs text-destructive">{errors.clients}</p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addClient}
            className="w-full gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Cliente
          </Button>

          <AcqTextareaField
            label="Observacoes sobre o/s cliente/s"
            value={form.watch('clients_notes')}
            onChange={(v) => form.setValue('clients_notes', v)}
          />
        </>
      )}
    </div>
  )
}
