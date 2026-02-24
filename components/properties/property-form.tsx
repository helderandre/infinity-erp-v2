'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  propertySchema,
  propertySpecsSchema,
  propertyInternalSchema,
} from '@/lib/validations/property'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PropertyAddressMapPicker } from './property-address-map-picker'
import { Loader2 } from 'lucide-react'
import {
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
  PROPERTY_STATUS,
  CONTRACT_REGIMES,
  TYPOLOGIES,
  SOLAR_ORIENTATIONS,
  VIEWS,
  EQUIPMENT,
  FEATURES,
} from '@/lib/constants'
import type { PropertyFormData, PropertySpecsFormData, PropertyInternalFormData } from '@/lib/validations/property'

// Combined form schema (all optional except title + types)
const formSchema = propertySchema.extend({
  // Specifications
  typology: z.string().optional(),
  bedrooms: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  bathrooms: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  area_gross: z.coerce.number().positive().optional().or(z.literal('')),
  area_util: z.coerce.number().positive().optional().or(z.literal('')),
  construction_year: z.coerce.number().int().min(1800).max(new Date().getFullYear() + 5).optional().or(z.literal('')),
  parking_spaces: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  garage_spaces: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  has_elevator: z.boolean().optional(),
  fronts_count: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  features: z.array(z.string()).optional(),
  solar_orientation: z.array(z.string()).optional(),
  views_list: z.array(z.string()).optional(),
  equipment_list: z.array(z.string()).optional(),
  storage_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  balcony_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  pool_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  attic_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  pantry_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  gym_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  // Internal
  internal_notes: z.string().optional(),
  commission_agreed: z.coerce.number().nonnegative().optional().or(z.literal('')),
  commission_type: z.string().optional(),
  contract_term: z.string().optional(),
  contract_expiry: z.string().optional(),
  imi_value: z.coerce.number().nonnegative().optional().or(z.literal('')),
  condominium_fee: z.coerce.number().nonnegative().optional().or(z.literal('')),
  cpcv_percentage: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
})

type FormValues = z.infer<typeof formSchema>

interface PropertyFormProps {
  defaultValues?: Partial<FormValues>
  onSubmit: (data: {
    property: PropertyFormData
    specifications: Partial<PropertySpecsFormData>
    internal: Partial<PropertyInternalFormData>
  }) => Promise<void>
  isSubmitting?: boolean
  mode: 'create' | 'edit'
}

const NONE_VALUE = '__none__'

function cleanNumber(val: unknown): number | undefined {
  if (val === '' || val === undefined || val === null) return undefined
  const n = Number(val)
  return isNaN(n) ? undefined : n
}

export function PropertyForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode,
}: PropertyFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      property_type: '',
      business_type: '',
      status: 'pending_approval',
      has_elevator: false,
      features: [],
      solar_orientation: [],
      views_list: [],
      equipment_list: [],
      commission_type: 'percentage',
      ...defaultValues,
    },
  })

  const handleSubmit = async (values: FormValues) => {
    const {
      typology, bedrooms, bathrooms, area_gross, area_util, construction_year,
      parking_spaces, garage_spaces, has_elevator, fronts_count,
      features: feats, solar_orientation: solar, views_list, equipment_list,
      storage_area, balcony_area, pool_area, attic_area, pantry_area, gym_area,
      internal_notes, commission_agreed, commission_type, contract_term,
      contract_expiry, imi_value, condominium_fee, cpcv_percentage,
      ...propertyData
    } = values

    const property: PropertyFormData = {
      ...propertyData,
      listing_price: cleanNumber(propertyData.listing_price),
    }

    const specifications: Partial<PropertySpecsFormData> = {}
    if (typology) specifications.typology = typology
    const bedroomsN = cleanNumber(bedrooms)
    if (bedroomsN !== undefined) specifications.bedrooms = bedroomsN
    const bathroomsN = cleanNumber(bathrooms)
    if (bathroomsN !== undefined) specifications.bathrooms = bathroomsN
    const areaGrossN = cleanNumber(area_gross)
    if (areaGrossN !== undefined) specifications.area_gross = areaGrossN
    const areaUtilN = cleanNumber(area_util)
    if (areaUtilN !== undefined) specifications.area_util = areaUtilN
    const constructionYearN = cleanNumber(construction_year)
    if (constructionYearN !== undefined) specifications.construction_year = constructionYearN
    const parkingN = cleanNumber(parking_spaces)
    if (parkingN !== undefined) specifications.parking_spaces = parkingN
    const garageN = cleanNumber(garage_spaces)
    if (garageN !== undefined) specifications.garage_spaces = garageN
    if (has_elevator !== undefined) specifications.has_elevator = has_elevator
    const frontsN = cleanNumber(fronts_count)
    if (frontsN !== undefined) specifications.fronts_count = frontsN
    if (feats?.length) specifications.features = feats
    if (solar?.length) specifications.solar_orientation = solar
    if (views_list?.length) specifications.views = views_list
    if (equipment_list?.length) specifications.equipment = equipment_list
    const storageN = cleanNumber(storage_area)
    if (storageN !== undefined) specifications.storage_area = storageN
    const balconyN = cleanNumber(balcony_area)
    if (balconyN !== undefined) specifications.balcony_area = balconyN
    const poolN = cleanNumber(pool_area)
    if (poolN !== undefined) specifications.pool_area = poolN
    const atticN = cleanNumber(attic_area)
    if (atticN !== undefined) specifications.attic_area = atticN
    const pantryN = cleanNumber(pantry_area)
    if (pantryN !== undefined) specifications.pantry_area = pantryN
    const gymN = cleanNumber(gym_area)
    if (gymN !== undefined) specifications.gym_area = gymN

    const internal: Partial<PropertyInternalFormData> = {}
    if (internal_notes) internal.internal_notes = internal_notes
    const commN = cleanNumber(commission_agreed)
    if (commN !== undefined) internal.commission_agreed = commN
    if (commission_type) internal.commission_type = commission_type
    if (values.contract_regime) internal.contract_regime = values.contract_regime
    if (contract_term) internal.contract_term = contract_term
    if (contract_expiry) internal.contract_expiry = contract_expiry
    const imiN = cleanNumber(imi_value)
    if (imiN !== undefined) internal.imi_value = imiN
    const condoN = cleanNumber(condominium_fee)
    if (condoN !== undefined) internal.condominium_fee = condoN
    const cpcvN = cleanNumber(cpcv_percentage)
    if (cpcvN !== undefined) internal.cpcv_percentage = cpcvN

    await onSubmit({ property, specifications, internal })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Card 1 — Dados Gerais */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titulo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Apartamento T2 no centro de Lisboa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descricao</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descreva o imovel..." className="min-h-[100px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="property_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Imovel *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PROPERTY_TYPES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Negocio *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(BUSINESS_TYPES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="listing_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preco (EUR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="property_condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condicao</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)} value={field.value || NONE_VALUE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                        {Object.entries(PROPERTY_CONDITIONS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="energy_certificate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificado Energetico</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)} value={field.value || NONE_VALUE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
                        {Object.entries(ENERGY_CERTIFICATES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="external_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referencia Externa</FormLabel>
                    <FormControl>
                      <Input placeholder="REF-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {mode === 'edit' && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PROPERTY_STATUS).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2 — Localizacao */}
        <Card>
          <CardHeader>
            <CardTitle>Localizacao</CardTitle>
          </CardHeader>
          <CardContent>
            <PropertyAddressMapPicker
              address={form.watch('address_street') || ''}
              postalCode={form.watch('postal_code') || ''}
              city={form.watch('city') || ''}
              zone={form.watch('zone') || ''}
              latitude={form.watch('latitude') ?? null}
              longitude={form.watch('longitude') ?? null}
              onAddressChange={(v) => form.setValue('address_street', v)}
              onPostalCodeChange={(v) => form.setValue('postal_code', v)}
              onCityChange={(v) => form.setValue('city', v)}
              onZoneChange={(v) => form.setValue('zone', v)}
              onLatitudeChange={(v) => form.setValue('latitude', v ?? undefined)}
              onLongitudeChange={(v) => form.setValue('longitude', v ?? undefined)}
            />
          </CardContent>
        </Card>

        {/* Card 3 — Especificacoes */}
        <Card>
          <CardHeader>
            <CardTitle>Especificacoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="typology"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipologia</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)} value={field.value || NONE_VALUE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                        {TYPOLOGIES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quartos</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bathrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Casas de banho</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="construction_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano de construcao</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="area_gross"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area bruta (m2)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="area_util"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area util (m2)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parking_spaces"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estacionamentos</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="garage_spaces"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Garagens</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fronts_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frentes</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="has_elevator"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">Elevador</FormLabel>
                </FormItem>
              )}
            />

            {/* Multi-select checkboxes */}
            <div className="space-y-3">
              <FormLabel>Orientacao Solar</FormLabel>
              <div className="flex flex-wrap gap-3">
                {SOLAR_ORIENTATIONS.map((o) => (
                  <label key={o} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.watch('solar_orientation')?.includes(o) || false}
                      onCheckedChange={(checked) => {
                        const current = form.getValues('solar_orientation') || []
                        form.setValue(
                          'solar_orientation',
                          checked ? [...current, o] : current.filter((v) => v !== o)
                        )
                      }}
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <FormLabel>Vistas</FormLabel>
              <div className="flex flex-wrap gap-3">
                {VIEWS.map((v) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.watch('views_list')?.includes(v) || false}
                      onCheckedChange={(checked) => {
                        const current = form.getValues('views_list') || []
                        form.setValue(
                          'views_list',
                          checked ? [...current, v] : current.filter((x) => x !== v)
                        )
                      }}
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <FormLabel>Equipamento</FormLabel>
              <div className="flex flex-wrap gap-3">
                {EQUIPMENT.map((e) => (
                  <label key={e} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.watch('equipment_list')?.includes(e) || false}
                      onCheckedChange={(checked) => {
                        const current = form.getValues('equipment_list') || []
                        form.setValue(
                          'equipment_list',
                          checked ? [...current, e] : current.filter((x) => x !== e)
                        )
                      }}
                    />
                    {e}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <FormLabel>Caracteristicas</FormLabel>
              <div className="flex flex-wrap gap-3">
                {FEATURES.map((f) => (
                  <label key={f} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.watch('features')?.includes(f) || false}
                      onCheckedChange={(checked) => {
                        const current = form.getValues('features') || []
                        form.setValue(
                          'features',
                          checked ? [...current, f] : current.filter((x) => x !== f)
                        )
                      }}
                    />
                    {f}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { name: 'storage_area' as const, label: 'Arrecadacao (m2)' },
                { name: 'balcony_area' as const, label: 'Varanda (m2)' },
                { name: 'pool_area' as const, label: 'Piscina (m2)' },
                { name: 'attic_area' as const, label: 'Sotao (m2)' },
                { name: 'pantry_area' as const, label: 'Despensa (m2)' },
                { name: 'gym_area' as const, label: 'Ginasio (m2)' },
              ].map(({ name, label }) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{label}</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card 4 — Dados Internos (Contrato) */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Internos (Contrato)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="contract_regime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime de Contrato</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)} value={field.value || NONE_VALUE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
                        {Object.entries(CONTRACT_REGIMES).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commission_agreed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comissao Acordada</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commission_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Comissao</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'percentage'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentagem</SelectItem>
                        <SelectItem value="fixed">Valor Fixo</SelectItem>
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
                      <Input placeholder="6 meses" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Expiracao</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imi_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IMI (EUR)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="condominium_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condominio (EUR)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cpcv_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPCV (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} step="0.1" placeholder="0" {...field} />
                    </FormControl>
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
                    <Textarea placeholder="Notas internas sobre o imovel..." className="min-h-[80px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Criar Imovel' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
