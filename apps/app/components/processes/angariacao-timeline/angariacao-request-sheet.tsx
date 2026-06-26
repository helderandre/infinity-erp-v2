'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, User, Home, MapPin, FileSignature, Users, Pencil, Plus, Trash2, Loader2, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { FinanceiroSheet } from '@/components/financial/sheets/financeiro-sheet'
import { DetailRow } from '@/components/shared/detail-row'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { formatCurrency } from '@/lib/constants'
import { BUSINESS_TYPES } from '@/types/deal'
import {
  FieldRow, TextInput, NumInput, SelectInput, BoolInput, TextAreaField,
} from '@/components/processes/editable-fields'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CONTRACT_REGIMES: Record<string, string> = {
  exclusivo: 'Exclusivo',
  nao_exclusivo: 'Não exclusivo',
}

const yesNo = (v: unknown): string | undefined =>
  v === true ? 'Sim' : v === false ? 'Não' : undefined

const eur = (v: number | null | undefined): string | undefined =>
  v == null || v === 0 ? undefined : formatCurrency(Number(v))

const num = (v: number | null | undefined): string | undefined =>
  v == null ? undefined : String(v)

const area = (v: number | null | undefined): string | undefined =>
  v == null ? undefined : `${Number(v)} m²`

// Campos por tabela (split do `form` flat no save).
const SPECS_KEYS = ['typology', 'bedrooms', 'bathrooms', 'area_gross', 'area_util', 'construction_year', 'parking_spaces', 'garage_spaces', 'has_elevator'] as const
const INTERNAL_KEYS = ['contract_regime', 'contract_term', 'commission_agreed', 'commission_type', 'imi_value', 'condominium_fee', 'cpcv_percentage', 'internal_notes'] as const
const PROPERTY_KEYS = ['property_type', 'business_type', 'listing_price', 'property_condition', 'energy_certificate', 'external_ref', 'description', 'address_street', 'address_parish', 'city', 'zone', 'postal_code'] as const
const NUMERIC_KEYS = new Set(['listing_price', 'bedrooms', 'bathrooms', 'area_gross', 'area_util', 'construction_year', 'parking_spaces', 'garage_spaces', 'commission_agreed', 'imi_value', 'condominium_fee', 'cpcv_percentage'])

interface EditOwner {
  id?: string
  person_type: string
  name: string
  nif: string
  email: string
  phone: string
  nationality: string
  naturality: string
  marital_status: string
  address: string
  ownership_percentage: string | number
  is_main_contact: boolean
  legal_representative_name: string
  legal_representative_nif: string
}

/**
 * Sheet com TODA a informação submetida no "pedido de angariação" (o formulário
 * multi-passo de angariação): imóvel, especificações, localização,
 * proprietários e condições do contrato. Lazy-fetch a `/api/processes/[id]`.
 * **A gestão pode editar** os campos e adicionar/remover proprietários (botão
 * "Editar"); guarda via PUT /api/properties/[id] + endpoints de owners.
 */
export function AngariacaoRequestSheet({
  processId,
  open,
  onClose,
}: {
  processId: string | null
  open: boolean
  onClose: () => void
}) {
  const { user } = useUser()
  const canEdit = isManagementRole(user?.role_names ?? [])

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const loadedFor = useRef<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})
  const [features, setFeatures] = useState('')
  const [owners, setOwners] = useState<EditOwner[]>([])

  const load = useCallback(async (force = false) => {
    if (!processId) return
    if (!force && loadedFor.current === processId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}`)
      const d = res.ok ? await res.json() : null
      if (d) {
        setData(d)
        loadedFor.current = processId
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [processId])

  useEffect(() => {
    if (open) load()
  }, [open, load])
  useEffect(() => {
    if (!open) setEditing(false)
  }, [open])

  const property = data?.instance?.property ?? null
  const propertyId: string | null = property?.id ?? data?.instance?.property_id ?? null
  const specs = property?.specs ?? null
  const internal = property?.internal ?? null
  const displayOwners: any[] = Array.isArray(data?.owners) ? data.owners : []

  const businessLabel = property?.business_type
    ? BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] ?? property.business_type
    : null

  const setF = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))

  const startEdit = () => {
    if (!property) return
    setForm({
      // property
      property_type: property.property_type ?? '',
      business_type: property.business_type ?? '',
      listing_price: property.listing_price ?? '',
      property_condition: property.property_condition ?? '',
      energy_certificate: property.energy_certificate ?? '',
      external_ref: property.external_ref ?? '',
      description: property.description ?? '',
      address_street: property.address_street ?? '',
      address_parish: property.address_parish ?? '',
      city: property.city ?? '',
      zone: property.zone ?? '',
      postal_code: property.postal_code ?? '',
      // specs
      typology: specs?.typology ?? '',
      bedrooms: specs?.bedrooms ?? '',
      bathrooms: specs?.bathrooms ?? '',
      area_gross: specs?.area_gross ?? '',
      area_util: specs?.area_util ?? '',
      construction_year: specs?.construction_year ?? '',
      parking_spaces: specs?.parking_spaces ?? '',
      garage_spaces: specs?.garage_spaces ?? '',
      has_elevator: specs?.has_elevator ?? false,
      // internal
      contract_regime: internal?.contract_regime ?? '',
      contract_term: internal?.contract_term ?? '',
      commission_agreed: internal?.commission_agreed ?? '',
      commission_type: internal?.commission_type ?? 'percentage',
      imi_value: internal?.imi_value ?? '',
      condominium_fee: internal?.condominium_fee ?? '',
      cpcv_percentage: internal?.cpcv_percentage ?? '',
      internal_notes: internal?.internal_notes ?? '',
    })
    setFeatures(Array.isArray(specs?.features) ? specs.features.join(', ') : '')
    setOwners(
      displayOwners.map((o) => ({
        id: o.id,
        person_type: o.person_type ?? 'singular',
        name: o.name ?? '',
        nif: o.nif ?? '',
        email: o.email ?? '',
        phone: o.phone ?? '',
        nationality: o.nationality ?? '',
        naturality: o.naturality ?? '',
        marital_status: o.marital_status ?? '',
        address: o.address ?? '',
        ownership_percentage: o.ownership_percentage ?? 100,
        is_main_contact: Boolean(o.is_main_contact),
        legal_representative_name: o.legal_representative_name ?? '',
        legal_representative_nif: o.legal_representative_nif ?? '',
      })),
    )
    setEditing(true)
  }

  const setOwner = (i: number, k: keyof EditOwner, v: any) =>
    setOwners((p) => p.map((o, idx) => (idx === i ? { ...o, [k]: v } : o)))
  const addOwner = () =>
    setOwners((p) => [
      ...p,
      {
        person_type: 'singular', name: '', nif: '', email: '', phone: '', nationality: '', naturality: '',
        marital_status: '', address: '', ownership_percentage: 0, is_main_contact: p.length === 0,
        legal_representative_name: '', legal_representative_nif: '',
      },
    ])
  const removeOwner = (i: number) => setOwners((p) => p.filter((_, idx) => idx !== i))

  const coerce = (key: string, val: any) => {
    if (val === '' || val == null) return null
    if (NUMERIC_KEYS.has(key)) return Number(val)
    return val
  }
  // Specs/internal são upserted directamente → null limpa o campo. OK.
  const pick = (keys: readonly string[]) => {
    const out: Record<string, any> = {}
    for (const k of keys) {
      const v = coerce(k, form[k])
      if (v !== undefined) out[k] = v
    }
    return out
  }
  // O `property` é validado por updatePropertySchema (z.string().optional() NÃO
  // aceita null) → omitimos campos vazios em vez de enviar null.
  const buildProperty = () => {
    const out: Record<string, any> = {}
    for (const k of PROPERTY_KEYS) {
      const raw = form[k]
      if (raw === '' || raw == null) continue
      out[k] = NUMERIC_KEYS.has(k) ? Number(raw) : raw
    }
    return out
  }

  const ownerPayload = (o: EditOwner) => ({
    person_type: o.person_type || 'singular',
    name: o.name,
    nif: o.nif || '',
    email: o.email || '',
    phone: o.phone || '',
    nationality: o.nationality || '',
    naturality: o.naturality || '',
    marital_status: o.marital_status || '',
    address: o.address || '',
    legal_representative_name: o.legal_representative_name || '',
    legal_representative_nif: o.legal_representative_nif || '',
  })

  const handleSave = async () => {
    if (!propertyId) {
      toast.error('Imóvel não identificado.')
      return
    }
    if (owners.length > 0 && owners.filter((o) => o.is_main_contact).length !== 1) {
      toast.error('Deve haver exactamente 1 contacto principal entre os proprietários.')
      return
    }
    setSaving(true)
    try {
      // 1. Property + specs + internal
      const specifications = pick(SPECS_KEYS)
      specifications.has_elevator = !!form.has_elevator
      specifications.features = features.split(',').map((s) => s.trim()).filter(Boolean)
      const propRes = await fetch(`/api/properties/${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property: buildProperty(),
          specifications,
          internal: { ...pick(INTERNAL_KEYS), commission_type: form.commission_type || 'percentage' },
        }),
      })
      if (!propRes.ok) {
        const j = await propRes.json().catch(() => ({}))
        throw new Error(j.error || 'Erro ao guardar o imóvel')
      }

      // 2. Owners — adds + edits, then deletes, then batch junction
      const junction: { owner_id: string; ownership_percentage: number; is_main_contact: boolean }[] = []
      for (const o of owners) {
        let ownerId = o.id
        if (!ownerId) {
          const res = await fetch(`/api/properties/${propertyId}/owners`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              owner: ownerPayload(o),
              ownership_percentage: Number(o.ownership_percentage) || 0,
              is_main_contact: o.is_main_contact,
            }),
          })
          const j = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(j.error || `Erro ao adicionar ${o.name || 'proprietário'}`)
          ownerId = j.owner_id
        } else {
          const res = await fetch(`/api/owners/${ownerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ownerPayload(o)),
          })
          if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            throw new Error(j.error || `Erro ao actualizar ${o.name || 'proprietário'}`)
          }
        }
        if (ownerId) junction.push({ owner_id: ownerId, ownership_percentage: Number(o.ownership_percentage) || 0, is_main_contact: !!o.is_main_contact })
      }

      // Remover os que saíram
      const keptIds = new Set(owners.filter((o) => o.id).map((o) => o.id))
      for (const orig of displayOwners) {
        if (orig.id && !keptIds.has(orig.id)) {
          await fetch(`/api/properties/${propertyId}/owners/${orig.id}`, { method: 'DELETE' })
        }
      }

      // Junction (ownership% + principal) — normaliza num só passo
      if (junction.length > 0) {
        await fetch(`/api/properties/${propertyId}/owners`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owners: junction }),
        })
      }

      toast.success('Pedido de angariação actualizado')
      setEditing(false)
      await load(true)
    } catch (e) {
      toast.error((e as Error)?.message ?? 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FinanceiroSheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      size="wide"
      title="Pedido de angariação"
      accent={<Home className="h-4 w-4 text-emerald-600" />}
      subtitle={
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span>{property?.title || property?.external_ref || 'Imóvel'}</span>
          {businessLabel && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span>{businessLabel}</span>
            </>
          )}
        </span>
      }
      footer={
        property && canEdit ? (
          editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving} className="rounded-full">
                <X className="mr-1.5 h-4 w-4" /> Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-full">
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Guardar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEdit} className="rounded-full">
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
          )
        ) : null
      }
    >
      {loading && !property ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : !property ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sem dados do pedido de angariação.
        </p>
      ) : (
        <>
          {/* Imóvel */}
          <Section title="Imóvel" icon={Home}>
            <FieldRow label="Tipo de imóvel" editing={editing} display={property.property_type}>
              <TextInput value={form.property_type} onChange={(v) => setF('property_type', v)} />
            </FieldRow>
            <FieldRow label="Tipo de negócio" editing={editing} display={businessLabel ?? undefined}>
              <SelectInput value={form.business_type} onChange={(v) => setF('business_type', v)}
                options={Object.entries(BUSINESS_TYPES).map(([value, label]) => ({ value, label }))} />
            </FieldRow>
            <FieldRow label="Preço" editing={editing} display={eur(property.listing_price)}>
              <NumInput value={form.listing_price} onChange={(v) => setF('listing_price', v)} suffix="€" />
            </FieldRow>
            <FieldRow label="Estado do imóvel" editing={editing} display={property.property_condition}>
              <TextInput value={form.property_condition} onChange={(v) => setF('property_condition', v)} />
            </FieldRow>
            <FieldRow label="Certificado energético" editing={editing} display={property.energy_certificate}>
              <TextInput value={form.energy_certificate} onChange={(v) => setF('energy_certificate', v)} />
            </FieldRow>
            <FieldRow label="Referência" editing={editing} display={property.external_ref}>
              <TextInput value={form.external_ref} onChange={(v) => setF('external_ref', v)} />
            </FieldRow>
            {editing ? (
              <TextAreaField label="Descrição" value={form.description} onChange={(v) => setF('description', v)} />
            ) : (
              property.description && (
                <p className="pt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{property.description}</p>
              )
            )}
          </Section>

          {/* Especificações */}
          {(specs || editing) && (
            <Section title="Especificações" icon={Building2}>
              <FieldRow label="Tipologia" editing={editing} display={specs?.typology}>
                <TextInput value={form.typology} onChange={(v) => setF('typology', v)} />
              </FieldRow>
              <FieldRow label="Quartos" editing={editing} display={num(specs?.bedrooms)}>
                <NumInput value={form.bedrooms} onChange={(v) => setF('bedrooms', v)} />
              </FieldRow>
              <FieldRow label="Casas de banho" editing={editing} display={num(specs?.bathrooms)}>
                <NumInput value={form.bathrooms} onChange={(v) => setF('bathrooms', v)} />
              </FieldRow>
              <FieldRow label="Área bruta" editing={editing} display={area(specs?.area_gross)}>
                <NumInput value={form.area_gross} onChange={(v) => setF('area_gross', v)} suffix="m²" />
              </FieldRow>
              <FieldRow label="Área útil" editing={editing} display={area(specs?.area_util)}>
                <NumInput value={form.area_util} onChange={(v) => setF('area_util', v)} suffix="m²" />
              </FieldRow>
              <FieldRow label="Ano de construção" editing={editing} display={num(specs?.construction_year)}>
                <NumInput value={form.construction_year} onChange={(v) => setF('construction_year', v)} />
              </FieldRow>
              <FieldRow label="Estacionamento" editing={editing} display={num(specs?.parking_spaces)}>
                <NumInput value={form.parking_spaces} onChange={(v) => setF('parking_spaces', v)} />
              </FieldRow>
              <FieldRow label="Garagens" editing={editing} display={num(specs?.garage_spaces)}>
                <NumInput value={form.garage_spaces} onChange={(v) => setF('garage_spaces', v)} />
              </FieldRow>
              <FieldRow label="Elevador" editing={editing} display={yesNo(specs?.has_elevator)}>
                <BoolInput value={form.has_elevator} onChange={(v) => setF('has_elevator', v)} />
              </FieldRow>
              <FieldRow
                label="Características"
                editing={editing}
                display={Array.isArray(specs?.features) && specs.features.length > 0 ? specs.features.join(', ') : undefined}
              >
                <TextInput value={features} onChange={setFeatures} placeholder="Separadas por vírgula" />
              </FieldRow>
            </Section>
          )}

          {/* Localização */}
          <Section title="Localização" icon={MapPin}>
            <FieldRow label="Morada" editing={editing} display={property.address_street}>
              <TextInput value={form.address_street} onChange={(v) => setF('address_street', v)} />
            </FieldRow>
            <FieldRow label="Freguesia" editing={editing} display={property.address_parish}>
              <TextInput value={form.address_parish} onChange={(v) => setF('address_parish', v)} />
            </FieldRow>
            <FieldRow label="Concelho" editing={editing} display={property.city}>
              <TextInput value={form.city} onChange={(v) => setF('city', v)} />
            </FieldRow>
            <FieldRow label="Distrito" editing={editing} display={property.zone}>
              <TextInput value={form.zone} onChange={(v) => setF('zone', v)} />
            </FieldRow>
            <FieldRow label="Código postal" editing={editing} display={property.postal_code}>
              <TextInput value={form.postal_code} onChange={(v) => setF('postal_code', v)} />
            </FieldRow>
          </Section>

          {/* Contrato */}
          {(internal || editing) && (
            <Section title="Contrato" icon={FileSignature}>
              <FieldRow
                label="Regime contratual"
                editing={editing}
                display={internal?.contract_regime ? CONTRACT_REGIMES[internal.contract_regime] ?? internal.contract_regime : undefined}
              >
                <SelectInput value={form.contract_regime} onChange={(v) => setF('contract_regime', v)}
                  options={[{ value: '', label: '—' }, ...Object.entries(CONTRACT_REGIMES).map(([value, label]) => ({ value, label }))]} />
              </FieldRow>
              <FieldRow label="Prazo do contrato" editing={editing} display={internal?.contract_term}>
                <TextInput value={form.contract_term} onChange={(v) => setF('contract_term', v)} />
              </FieldRow>
              <FieldRow
                label="Comissão acordada"
                editing={editing}
                display={
                  internal?.commission_agreed != null
                    ? internal.commission_type === 'fixed'
                      ? formatCurrency(Number(internal.commission_agreed))
                      : `${Number(internal.commission_agreed)}%`
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <SelectInput value={form.commission_type} onChange={(v) => setF('commission_type', v)}
                    options={[{ value: 'percentage', label: '%' }, { value: 'fixed', label: '€ Fixo' }]} className="w-24" />
                  <NumInput value={form.commission_agreed} onChange={(v) => setF('commission_agreed', v)} suffix={form.commission_type === 'fixed' ? '€' : '%'} />
                </div>
              </FieldRow>
              <FieldRow label="IMI anual" editing={editing} display={eur(internal?.imi_value)}>
                <NumInput value={form.imi_value} onChange={(v) => setF('imi_value', v)} suffix="€" />
              </FieldRow>
              <FieldRow label="Condomínio mensal" editing={editing} display={eur(internal?.condominium_fee)}>
                <NumInput value={form.condominium_fee} onChange={(v) => setF('condominium_fee', v)} suffix="€" />
              </FieldRow>
              <FieldRow
                label="% no CPCV"
                editing={editing}
                display={internal?.cpcv_percentage != null && Number(internal.cpcv_percentage) > 0 ? `${Number(internal.cpcv_percentage)}%` : undefined}
              >
                <NumInput value={form.cpcv_percentage} onChange={(v) => setF('cpcv_percentage', v)} suffix="%" />
              </FieldRow>
              {editing ? (
                <TextAreaField label="Notas internas" value={form.internal_notes} onChange={(v) => setF('internal_notes', v)} />
              ) : (
                internal?.internal_notes && (
                  <p className="pt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{internal.internal_notes}</p>
                )
              )}
            </Section>
          )}

          {/* Proprietários */}
          {(displayOwners.length > 0 || editing) && (
            <Section title={`Proprietários (${editing ? owners.length : displayOwners.length})`} icon={Users}>
              {editing ? (
                <div className="space-y-3">
                  {owners.map((o, i) => (
                    <EditOwnerCard key={o.id ?? `new-${i}`} owner={o} onChange={(k, v) => setOwner(i, k, v)} onRemove={() => removeOwner(i)} />
                  ))}
                  <Button variant="outline" size="sm" onClick={addOwner} className="rounded-full">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar proprietário
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayOwners.map((o, i) => (
                    <PersonCard
                      key={o.id ?? i}
                      name={o.name}
                      personType={o.person_type}
                      isMain={o.is_main_contact}
                      rows={[
                        ['NIF', o.nif],
                        ['Email', o.email],
                        ['Telefone', o.phone],
                        ['Nacionalidade', o.nationality],
                        ['Naturalidade', o.naturality],
                        ['Estado civil', o.marital_status],
                        ['Morada', o.address],
                        ['% propriedade', o.ownership_percentage != null ? `${Number(o.ownership_percentage)}%` : null],
                        ['Rep. legal', o.legal_representative_name],
                        ['NIF rep. legal', o.legal_representative_nif],
                      ]}
                    />
                  ))}
                </div>
              )}
            </Section>
          )}
        </>
      )}
    </FinanceiroSheet>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  )
}

function EditOwnerCard({
  owner, onChange, onRemove,
}: {
  owner: EditOwner
  onChange: (k: keyof EditOwner, v: any) => void
  onRemove: () => void
}) {
  const isColetiva = owner.person_type === 'coletiva'
  return (
    <div className="rounded-xl ring-1 ring-border/30 bg-background/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <SelectInput value={owner.person_type} onChange={(v) => onChange('person_type', v)}
          options={[{ value: 'singular', label: 'Singular' }, { value: 'coletiva', label: 'Coletiva' }]} className="w-28" />
        <Input value={owner.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Nome" className="h-8 flex-1 rounded-lg text-sm font-medium" />
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <input type="checkbox" checked={owner.is_main_contact} onChange={(e) => onChange('is_main_contact', e.target.checked)} />
          Principal
        </label>
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input value={owner.nif} onChange={(e) => onChange('nif', e.target.value)} placeholder="NIF" className="h-8 rounded-lg text-sm" />
        <Input value={owner.phone} onChange={(e) => onChange('phone', e.target.value)} placeholder="Telefone" className="h-8 rounded-lg text-sm" />
        <Input value={owner.email} onChange={(e) => onChange('email', e.target.value)} placeholder="Email" className="h-8 rounded-lg text-sm col-span-2" />
        <Input value={owner.nationality} onChange={(e) => onChange('nationality', e.target.value)} placeholder="Nacionalidade" className="h-8 rounded-lg text-sm" />
        <Input value={owner.naturality} onChange={(e) => onChange('naturality', e.target.value)} placeholder="Naturalidade" className="h-8 rounded-lg text-sm" />
        <Input value={owner.marital_status} onChange={(e) => onChange('marital_status', e.target.value)} placeholder="Estado civil" className="h-8 rounded-lg text-sm" />
        <div className="relative">
          <Input type="number" value={owner.ownership_percentage} onChange={(e) => onChange('ownership_percentage', e.target.value)} placeholder="% propriedade" className="h-8 rounded-lg text-sm pr-7" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
        </div>
        <Input value={owner.address} onChange={(e) => onChange('address', e.target.value)} placeholder="Morada" className="h-8 rounded-lg text-sm col-span-2" />
        {isColetiva && (
          <>
            <Input value={owner.legal_representative_name} onChange={(e) => onChange('legal_representative_name', e.target.value)} placeholder="Rep. legal" className="h-8 rounded-lg text-sm" />
            <Input value={owner.legal_representative_nif} onChange={(e) => onChange('legal_representative_nif', e.target.value)} placeholder="NIF rep. legal" className="h-8 rounded-lg text-sm" />
          </>
        )}
      </div>
    </div>
  )
}

export function PersonCard({
  name,
  personType,
  isMain,
  rows,
}: {
  name: string
  personType?: string | null
  isMain?: boolean | null
  rows: [string, React.ReactNode | string | number | null | undefined][]
}) {
  const isColetiva = personType === 'coletiva'
  return (
    <div className="rounded-xl ring-1 ring-border/30 bg-background/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            isColetiva ? 'bg-indigo-500/10 text-indigo-600' : 'bg-sky-500/10 text-sky-600'
          )}
        >
          {isColetiva ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{name || '—'}</p>
        {isMain && (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
            Principal
          </span>
        )}
      </div>
      <div className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <DetailRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  )
}
