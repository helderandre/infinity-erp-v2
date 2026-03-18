// @ts-nocheck
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPartnerSchema, type CreatePartnerInput } from '@/lib/validations/partner'
import {
  PARTNER_CATEGORY_OPTIONS,
  PARTNER_VISIBILITY_OPTIONS,
  PARTNER_PAYMENT_OPTIONS,
} from '@/lib/constants'
import { Loader2, X, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { Partner } from '@/types/partner'

interface PartnerFormProps {
  partner?: Partner | null
  onSubmit: (data: any) => Promise<any>
  onCancel?: () => void
  canSeePrivate?: boolean
}

export function PartnerForm({ partner, onSubmit, onCancel, canSeePrivate }: PartnerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [areaInput, setAreaInput] = useState('')

  const isEditing = !!partner

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePartnerInput>({
    resolver: zodResolver(createPartnerSchema),
    defaultValues: {
      name: partner?.name || '',
      person_type: partner?.person_type || 'coletiva',
      nif: partner?.nif || '',
      category: partner?.category || 'other',
      visibility: partner?.visibility || 'public',
      email: partner?.email || '',
      phone: partner?.phone || '',
      phone_secondary: partner?.phone_secondary || '',
      website: partner?.website || '',
      address: partner?.address || '',
      city: partner?.city || '',
      postal_code: partner?.postal_code || '',
      contact_person: partner?.contact_person || '',
      specialties: partner?.specialties || [],
      service_areas: partner?.service_areas || [],
      commercial_conditions: partner?.commercial_conditions || '',
      payment_method: partner?.payment_method || null,
      is_recommended: partner?.is_recommended || false,
      internal_notes: partner?.internal_notes || '',
    },
  })

  const specialties = watch('specialties') || []
  const serviceAreas = watch('service_areas') || []

  const addSpecialty = () => {
    const val = specialtyInput.trim()
    if (val && !specialties.includes(val)) {
      setValue('specialties', [...specialties, val])
      setSpecialtyInput('')
    }
  }

  const removeSpecialty = (s: string) => {
    setValue('specialties', specialties.filter((x) => x !== s))
  }

  const addArea = () => {
    const val = areaInput.trim()
    if (val && !serviceAreas.includes(val)) {
      setValue('service_areas', [...serviceAreas, val])
      setAreaInput('')
    }
  }

  const removeArea = (a: string) => {
    setValue('service_areas', serviceAreas.filter((x) => x !== a))
  }

  const handleFormSubmit = async (data: CreatePartnerInput) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Identificação */}
      <div className="rounded-xl border bg-card/50 p-4 space-y-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Identificação
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs font-medium">Nome *</Label>
            <Input className="rounded-xl" placeholder="Nome do parceiro" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Tipo</Label>
            <Select value={watch('person_type')} onValueChange={(v) => setValue('person_type', v as any)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="singular">Singular</SelectItem>
                <SelectItem value="coletiva">Colectiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">NIF</Label>
            <Input className="rounded-xl" placeholder="NIF / NIPC" {...register('nif')} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Categoria *</Label>
            <Select value={watch('category')} onValueChange={(v) => setValue('category', v as any)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARTNER_CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
          </div>
          {canSeePrivate && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Visibilidade</Label>
              <Select value={watch('visibility')} onValueChange={(v) => setValue('visibility', v as any)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTNER_VISIBILITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Contacto */}
      <div className="rounded-xl border bg-card/50 p-4 space-y-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Contacto
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Email</Label>
            <Input className="rounded-xl" type="email" placeholder="email@exemplo.pt" {...register('email')} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Telemóvel</Label>
            <Input className="rounded-xl" placeholder="+351 9XX XXX XXX" {...register('phone')} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Telefone Secundário</Label>
            <Input className="rounded-xl" placeholder="Telefone" {...register('phone_secondary')} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Website</Label>
            <Input className="rounded-xl" placeholder="https://..." {...register('website')} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Pessoa de Contacto</Label>
            <Input className="rounded-xl" placeholder="Nome" {...register('contact_person')} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Cidade</Label>
            <Input className="rounded-xl" placeholder="Lisboa" {...register('city')} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs font-medium">Morada</Label>
            <Input className="rounded-xl" placeholder="Rua, nº, código postal" {...register('address')} />
          </div>
        </div>
      </div>

      {/* Profissional */}
      <div className="rounded-xl border bg-card/50 p-4 space-y-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Informação Profissional
        </h4>

        {/* Specialties */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Especialidades</Label>
          <div className="flex gap-2">
            <Input
              className="rounded-xl flex-1"
              placeholder="Ex: direito imobiliário"
              value={specialtyInput}
              onChange={(e) => setSpecialtyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty() } }}
            />
            <Button type="button" variant="outline" size="icon" className="rounded-xl shrink-0" onClick={addSpecialty}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {specialties.map((s) => (
                <Badge key={s} variant="secondary" className="rounded-full gap-1 pr-1">
                  {s}
                  <button type="button" onClick={() => removeSpecialty(s)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Service Areas */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Zonas de Actuação</Label>
          <div className="flex gap-2">
            <Input
              className="rounded-xl flex-1"
              placeholder="Ex: Lisboa, Porto"
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArea() } }}
            />
            <Button type="button" variant="outline" size="icon" className="rounded-xl shrink-0" onClick={addArea}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {serviceAreas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {serviceAreas.map((a) => (
                <Badge key={a} variant="secondary" className="rounded-full gap-1 pr-1">
                  {a}
                  <button type="button" onClick={() => removeArea(a)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Método de Pagamento</Label>
          <Select value={watch('payment_method') || ''} onValueChange={(v) => setValue('payment_method', v as any)}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {PARTNER_PAYMENT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canSeePrivate && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Condições Comerciais</Label>
            <Textarea className="rounded-xl" rows={3} placeholder="Comissões, descontos, acordos..." {...register('commercial_conditions')} />
          </div>
        )}
      </div>

      {/* Admin */}
      {canSeePrivate && (
        <div className="rounded-xl border bg-card/50 p-4 space-y-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Administração
          </h4>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Parceiro Recomendado</Label>
            <Switch
              checked={watch('is_recommended')}
              onCheckedChange={(v) => setValue('is_recommended', v)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Notas Internas</Label>
            <Textarea className="rounded-xl" rows={3} placeholder="Notas internas (visíveis apenas para gestão)..." {...register('internal_notes')} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="rounded-full px-6" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Guardar' : 'Criar Parceiro'}
        </Button>
      </div>
    </form>
  )
}
