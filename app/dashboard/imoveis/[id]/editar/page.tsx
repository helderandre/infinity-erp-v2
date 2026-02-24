'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProperty } from '@/hooks/use-property'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PropertyForm } from '@/components/properties/property-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function EditarImovelPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { property, isLoading } = useProperty(id)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold">Imóvel não encontrado</h2>
        </div>
      </div>
    )
  }

  const specs = property.dev_property_specifications
  const internal = property.dev_property_internal

  const defaultValues = {
    title: property.title || '',
    description: property.description || '',
    property_type: property.property_type || '',
    business_type: property.business_type || '',
    listing_price: property.listing_price ?? undefined,
    status: property.status || 'pending_approval',
    property_condition: property.property_condition || '',
    energy_certificate: property.energy_certificate || '',
    external_ref: property.external_ref || '',
    consultant_id: property.consultant_id || '',
    address_street: property.address_street || '',
    address_parish: property.address_parish || '',
    postal_code: property.postal_code || '',
    city: property.city || '',
    zone: property.zone || '',
    latitude: property.latitude ?? undefined,
    longitude: property.longitude ?? undefined,
    contract_regime: property.contract_regime || internal?.contract_regime || '',
    // Specifications
    typology: specs?.typology || '',
    bedrooms: specs?.bedrooms ?? '',
    bathrooms: specs?.bathrooms ?? '',
    area_gross: specs?.area_gross ?? '',
    area_util: specs?.area_util ?? '',
    construction_year: specs?.construction_year ?? '',
    parking_spaces: specs?.parking_spaces ?? '',
    garage_spaces: specs?.garage_spaces ?? '',
    has_elevator: specs?.has_elevator || false,
    fronts_count: specs?.fronts_count ?? '',
    features: specs?.features || [],
    solar_orientation: specs?.solar_orientation || [],
    views_list: specs?.views || [],
    equipment_list: specs?.equipment || [],
    storage_area: specs?.storage_area ?? '',
    balcony_area: specs?.balcony_area ?? '',
    pool_area: specs?.pool_area ?? '',
    attic_area: specs?.attic_area ?? '',
    pantry_area: specs?.pantry_area ?? '',
    gym_area: specs?.gym_area ?? '',
    // Internal
    internal_notes: internal?.internal_notes || '',
    commission_agreed: internal?.commission_agreed ?? '',
    commission_type: internal?.commission_type || 'percentage',
    contract_term: internal?.contract_term || '',
    contract_expiry: internal?.contract_expiry || '',
    imi_value: internal?.imi_value ?? '',
    condominium_fee: internal?.condominium_fee ?? '',
    cpcv_percentage: internal?.cpcv_percentage ?? '',
  }

  async function handleSubmit(data: {
    property: Record<string, unknown>
    specifications: Record<string, unknown>
    internal: Record<string, unknown>
  }) {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property: data.property,
          specifications: data.specifications,
          internal: data.internal,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao actualizar imóvel')
      }
      toast.success('Imóvel actualizado com sucesso')
      router.push(`/dashboard/imoveis/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao actualizar imóvel')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editar Imóvel</h1>
          <p className="text-sm text-muted-foreground">{property.title}</p>
        </div>
      </div>
      <PropertyForm
        mode="edit"
        defaultValues={defaultValues as any}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
