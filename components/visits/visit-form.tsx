// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createVisitSchema, type CreateVisitInput } from '@/lib/validations/visit'
import { VISIT_DURATION_OPTIONS } from '@/lib/constants'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface VisitFormProps {
  defaultPropertyId?: string
  defaultLeadId?: string
  defaultConsultantId?: string
  onSubmit: (data: CreateVisitInput) => Promise<any>
  onCancel?: () => void
}

interface PropertyOption {
  id: string
  title: string
  external_ref: string | null
}

interface LeadOption {
  id: string
  name: string
  telemovel: string | null
}

interface ConsultantOption {
  id: string
  commercial_name: string | null
}

export function VisitForm({
  defaultPropertyId,
  defaultLeadId,
  defaultConsultantId,
  onSubmit,
  onCancel,
}: VisitFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [consultants, setConsultants] = useState<ConsultantOption[]>([])
  const [useManualClient, setUseManualClient] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateVisitInput>({
    resolver: zodResolver(createVisitSchema),
    defaultValues: {
      property_id: defaultPropertyId || '',
      lead_id: defaultLeadId || null,
      consultant_id: defaultConsultantId || '',
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: '10:00',
      duration_minutes: 30,
      notes: '',
      client_name: null,
      client_phone: null,
      client_email: null,
    },
  })

  const selectedLeadId = watch('lead_id')

  // Fetch properties, leads, consultants
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [propRes, leadRes, consultRes] = await Promise.all([
          fetch('/api/properties?limit=200&status=active'),
          fetch('/api/leads?limit=200'),
          fetch('/api/users?role=consultant&limit=100'),
        ])

        if (propRes.ok) {
          const propJson = await propRes.json()
          setProperties(
            (propJson.data || propJson || []).map((p: any) => ({
              id: p.id,
              title: p.title,
              external_ref: p.external_ref,
            }))
          )
        }

        if (leadRes.ok) {
          const leadJson = await leadRes.json()
          setLeads(
            (leadJson.data || leadJson || []).map((l: any) => ({
              id: l.id,
              name: l.full_name,
              telemovel: l.telemovel || l.telemovel,
            }))
          )
        }

        if (consultRes.ok) {
          const consultJson = await consultRes.json()
          setConsultants(
            (consultJson.data || consultJson || []).map((c: any) => ({
              id: c.id,
              commercial_name: c.commercial_name,
            }))
          )
        }
      } catch (err) {
        console.error('Error loading form data:', err)
      }
    }

    fetchData()
  }, [])

  const handleFormSubmit = async (data: CreateVisitInput) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao agendar visita')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      {/* Imóvel */}
      <div className="space-y-2">
        <Label htmlFor="property_id">Imóvel *</Label>
        <Select
          value={watch('property_id')}
          onValueChange={(v) => setValue('property_id', v)}
          disabled={!!defaultPropertyId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar imóvel..." />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.external_ref ? `${p.external_ref} — ` : ''}{p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.property_id && (
          <p className="text-sm text-destructive">{errors.property_id.message}</p>
        )}
      </div>

      {/* Consultor */}
      <div className="space-y-2">
        <Label htmlFor="consultant_id">Consultor *</Label>
        <Select
          value={watch('consultant_id')}
          onValueChange={(v) => setValue('consultant_id', v)}
          disabled={!!defaultConsultantId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar consultor..." />
          </SelectTrigger>
          <SelectContent>
            {consultants.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.commercial_name || c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.consultant_id && (
          <p className="text-sm text-destructive">{errors.consultant_id.message}</p>
        )}
      </div>

      {/* Lead ou Cliente Manual */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Cliente *</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setUseManualClient(!useManualClient)
              if (!useManualClient) {
                setValue('lead_id', null)
              } else {
                setValue('client_name', null)
                setValue('client_phone', null)
                setValue('client_email', null)
              }
            }}
          >
            {useManualClient ? 'Seleccionar lead' : 'Introduzir manualmente'}
          </Button>
        </div>

        {!useManualClient ? (
          <div className="space-y-2">
            <Select
              value={selectedLeadId || ''}
              onValueChange={(v) => setValue('lead_id', v || null)}
              disabled={!!defaultLeadId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar lead..." />
              </SelectTrigger>
              <SelectContent>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.full_name}{l.telemovel ? ` (${l.telemovel})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="client_name" className="text-xs text-muted-foreground">
                Nome *
              </Label>
              <Input
                id="client_name"
                placeholder="Nome do cliente"
                {...register('client_name')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="client_phone" className="text-xs text-muted-foreground">
                Telemóvel
              </Label>
              <Input
                id="client_phone"
                placeholder="+351 9XX XXX XXX"
                {...register('client_phone')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="client_email" className="text-xs text-muted-foreground">
                Email
              </Label>
              <Input
                id="client_email"
                type="email"
                placeholder="email@exemplo.pt"
                {...register('client_email')}
              />
            </div>
          </div>
        )}
        {errors.lead_id && (
          <p className="text-sm text-destructive">{errors.lead_id.message}</p>
        )}
      </div>

      {/* Data, Hora, Duração */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="visit_date">Data *</Label>
          <Input
            id="visit_date"
            type="date"
            {...register('visit_date')}
          />
          {errors.visit_date && (
            <p className="text-sm text-destructive">{errors.visit_date.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="visit_time">Hora *</Label>
          <Input
            id="visit_time"
            type="time"
            {...register('visit_time')}
          />
          {errors.visit_time && (
            <p className="text-sm text-destructive">{errors.visit_time.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration_minutes">Duração</Label>
          <Select
            value={String(watch('duration_minutes') || 30)}
            onValueChange={(v) => setValue('duration_minutes', parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIT_DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notas */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          placeholder="Notas adicionais sobre a visita..."
          rows={3}
          {...register('notes')}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Agendar Visita
        </Button>
      </div>
    </form>
  )
}
