'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ownerSchema, type OwnerFormData } from '@/lib/validations/owner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MaskInput } from '@/components/ui/mask-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { OwnerSearch } from '@/components/owners/owner-search'
import { Loader2, Star, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { PERSON_TYPES, MARITAL_STATUS, MARITAL_REGIMES, OWNER_ROLE_COLORS, MARRIED_STATUSES } from '@/lib/constants'
import { phonePTMask, nifMask, postalCodePTMask } from '@/lib/masks'
import { cn } from '@/lib/utils'
import type { OwnerRoleType } from '@/types/owner'

interface OwnerEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  owner: any
  propertyId: string
  roleTypes: OwnerRoleType[]
  onSaved?: () => void
  onSpousePrompt?: (owner: any) => void
}

export function OwnerEditSheet({
  open,
  onOpenChange,
  owner,
  propertyId,
  roleTypes,
  onSaved,
  onSpousePrompt,
}: OwnerEditSheetProps) {
  const [saving, setSaving] = useState(false)

  // Junction fields (managed separately)
  const [ownershipPercentage, setOwnershipPercentage] = useState(
    owner?.ownership_percentage ?? 100
  )
  const [isMainContact, setIsMainContact] = useState(
    owner?.is_main_contact ?? false
  )
  const [ownerRoleId, setOwnerRoleId] = useState(
    owner?.owner_role_id || owner?.owner_role?.id || ''
  )

  const form = useForm<OwnerFormData>({
    resolver: zodResolver(ownerSchema),
    defaultValues: buildDefaults(owner),
  })

  // Reset form when owner changes
  useEffect(() => {
    if (owner) {
      form.reset(buildDefaults(owner))
      setOwnershipPercentage(owner.ownership_percentage ?? 100)
      setIsMainContact(owner.is_main_contact ?? false)
      setOwnerRoleId(owner.owner_role_id || owner.owner_role?.id || '')
    }
  }, [owner?.id])

  const personType = form.watch('person_type')
  const isPep = form.watch('is_pep')
  const isResident = form.watch('is_portugal_resident')
  const maritalStatus = form.watch('marital_status')

  const onSubmit = async (data: OwnerFormData) => {
    setSaving(true)
    try {
      // 1. Update owner data
      const res = await fetch(`/api/owners/${owner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar proprietário')
      }

      // 2. Update junction data
      const junctionRes = await fetch(`/api/properties/${propertyId}/owners`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owners: [{
            owner_id: owner.id,
            ownership_percentage: ownershipPercentage,
            is_main_contact: isMainContact,
            owner_role_id: ownerRoleId || undefined,
          }],
        }),
      })

      // Junction update may fail if main contact validation fails — that's ok for single update
      if (!junctionRes.ok) {
        const jErr = await junctionRes.json()
        // If error is about main contact, still save owner data
        if (!jErr.error?.includes('contacto principal')) {
          throw new Error(jErr.error || 'Erro ao actualizar dados de propriedade')
        }
      }

      toast.success('Proprietário actualizado com sucesso')
      onSaved?.()

      // Check if spouse prompt is needed
      const isMarried = MARRIED_STATUSES.includes(maritalStatus as any)
      if (isMarried && personType === 'singular') {
        onSpousePrompt?.(owner)
      }

      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao guardar'
      )
    } finally {
      setSaving(false)
    }
  }

  const selectedRole = roleTypes.find((r) => r.id === ownerRoleId)
  const roleColorKey = selectedRole?.name || 'proprietario'
  const roleColors = OWNER_ROLE_COLORS[roleColorKey] || OWNER_ROLE_COLORS.proprietario

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-[800px]! flex flex-col gap-0 p-0">
        {/* ─── Fixed Header ─── */}
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Editar Proprietário</SheetTitle>
          <SheetDescription>{owner?.name}</SheetDescription>
        </SheetHeader>

        {/* ─── Scrollable Content ─── */}
        <form
          id="owner-edit-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto"
        >
          <div className="space-y-6 px-6 py-6">
            {/* ─── Junction Fields ─── */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Relação com o Imóvel
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Role */}
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={ownerRoleId} onValueChange={setOwnerRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roleTypes.map((role) => {
                        const colors = OWNER_ROLE_COLORS[role.name] || OWNER_ROLE_COLORS.proprietario
                        return (
                          <SelectItem key={role.id} value={role.id}>
                            <span className="flex items-center gap-2">
                              <span className={cn('h-2 w-2 rounded-full', colors.bg.replace('100', '500'))} />
                              {role.label}
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Percentage */}
                <div className="space-y-2">
                  <Label>Percentagem (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={ownershipPercentage}
                    onChange={(e) => setOwnershipPercentage(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Main contact */}
              <div className="flex items-center gap-3">
                <Switch checked={isMainContact} onCheckedChange={setIsMainContact} />
                <Label className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" />
                  Contacto Principal
                </Label>
              </div>

              {selectedRole && (
                <Badge
                  variant="outline"
                  className={cn('border-0', roleColors.bg, roleColors.text)}
                >
                  {selectedRole.label} · {ownershipPercentage}%
                </Badge>
              )}
            </div>

            <Separator />

            {/* ─── Person Type ─── */}
            <div className="space-y-2">
              <Label>Tipo de Pessoa</Label>
              <Select
                value={personType}
                onValueChange={(v) => form.setValue('person_type', v as 'singular' | 'coletiva')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERSON_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* ─── General Data ─── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {personType === 'coletiva' ? 'Dados da Empresa' : 'Dados Pessoais'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">
                    {personType === 'coletiva' ? 'Nome da Empresa *' : 'Nome Completo *'}
                  </Label>
                  <Input id="edit-name" {...form.register('name')} />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-nif">NIF{personType === 'coletiva' ? '/NIPC' : ''}</Label>
                  <MaskInput
                    mask={nifMask}
                    placeholder="123 456 789"
                    value={form.watch('nif') || ''}
                    onValueChange={(_masked, unmasked) => form.setValue('nif', unmasked)}
                  />
                  {form.formState.errors.nif && (
                    <p className="text-sm text-destructive">{form.formState.errors.nif.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" {...form.register('email')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Telefone</Label>
                  <MaskInput
                    mask={phonePTMask}
                    placeholder="+351 9XX XXX XXX"
                    value={form.watch('phone') || ''}
                    onValueChange={(_masked, unmasked) => form.setValue('phone', unmasked)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Morada</Label>
                  <Input id="edit-address" {...form.register('address')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-postal_code">Código Postal</Label>
                  <MaskInput
                    mask={postalCodePTMask}
                    placeholder="1234-567"
                    value={form.watch('postal_code') || ''}
                    onValueChange={(_masked, unmasked) => form.setValue('postal_code', unmasked)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-city">Localidade</Label>
                  <Input id="edit-city" {...form.register('city')} />
                </div>
              </div>
            </div>

            {/* ─── Singular Fields ─── */}
            {personType === 'singular' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Identificação
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data de Nascimento</Label>
                      <DatePicker
                        value={form.watch('birth_date')}
                        onChange={(v) => form.setValue('birth_date', v)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-nationality">Nacionalidade</Label>
                      <Input id="edit-nationality" {...form.register('nationality')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-naturality">Naturalidade</Label>
                      <Input id="edit-naturality" {...form.register('naturality')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado Civil</Label>
                      <Select
                        value={maritalStatus || ''}
                        onValueChange={(v) => form.setValue('marital_status', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(MARITAL_STATUS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {MARRIED_STATUSES.includes(maritalStatus as any) && (
                      <div className="space-y-2">
                        <Label>Regime Matrimonial</Label>
                        <Select
                          value={form.watch('marital_regime') || ''}
                          onValueChange={(v) => form.setValue('marital_regime', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(MARITAL_REGIMES).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
                    Documento de Identificação
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Documento</Label>
                      <Select
                        value={form.watch('id_doc_type') || ''}
                        onValueChange={(v) => form.setValue('id_doc_type', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cc">Cartão de Cidadão</SelectItem>
                          <SelectItem value="passport">Passaporte</SelectItem>
                          <SelectItem value="bi">Bilhete de Identidade</SelectItem>
                          <SelectItem value="ar">Autorização de Residência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-id_doc_number">Número do Documento</Label>
                      <Input id="edit-id_doc_number" {...form.register('id_doc_number')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Validade</Label>
                      <DatePicker
                        value={form.watch('id_doc_expiry')}
                        onChange={(v) => form.setValue('id_doc_expiry', v)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-id_doc_issued_by">Emitido por</Label>
                      <Input id="edit-id_doc_issued_by" {...form.register('id_doc_issued_by')} />
                    </div>
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
                    Profissão e Residência
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-profession">Profissão Actual</Label>
                      <Input id="edit-profession" {...form.register('profession')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-last_profession">Última Profissão</Label>
                      <Input id="edit-last_profession" {...form.register('last_profession')} />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <Switch
                        checked={isResident ?? true}
                        onCheckedChange={(v) => form.setValue('is_portugal_resident', v)}
                      />
                      <Label>Residente em Portugal</Label>
                    </div>
                    {!isResident && (
                      <div className="space-y-2">
                        <Label htmlFor="edit-residence_country">País de Residência</Label>
                        <Input id="edit-residence_country" {...form.register('residence_country')} />
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
                    PEP (Pessoa Politicamente Exposta)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 pt-2">
                      <Switch
                        checked={isPep ?? false}
                        onCheckedChange={(v) => form.setValue('is_pep', v)}
                      />
                      <Label>Pessoa Politicamente Exposta</Label>
                    </div>
                    {isPep && (
                      <div className="space-y-2">
                        <Label htmlFor="edit-pep_position">Cargo PEP</Label>
                        <Input id="edit-pep_position" {...form.register('pep_position')} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ─── Coletiva Fields ─── */}
            {personType === 'coletiva' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Representante Legal
                  </p>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Link2 className="h-3.5 w-3.5" />
                      Vincular pessoa existente
                    </Label>
                    <OwnerSearch
                      placeholder="Pesquisar pessoa singular por nome, NIF ou email..."
                      onSelect={(selected) => {
                        form.setValue('legal_representative_name', selected.name || '')
                        form.setValue('legal_representative_nif', selected.nif || '')
                        const docParts = [selected.id_doc_type, selected.id_doc_number].filter(Boolean)
                        form.setValue('legal_rep_id_doc', docParts.join(' - '))
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-legal_representative_name">Nome do Representante Legal *</Label>
                      <Input id="edit-legal_representative_name" {...form.register('legal_representative_name')} />
                      {form.formState.errors.legal_representative_name && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.legal_representative_name.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-legal_representative_nif">NIF do Representante Legal *</Label>
                      <MaskInput
                        mask={nifMask}
                        placeholder="123 456 789"
                        value={form.watch('legal_representative_nif') || ''}
                        onValueChange={(_masked, unmasked) => form.setValue('legal_representative_nif', unmasked)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-legal_rep_id_doc">Documento do Representante Legal</Label>
                      <Input id="edit-legal_rep_id_doc" {...form.register('legal_rep_id_doc')} />
                    </div>
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
                    Dados da Empresa
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-company_object">Objecto Social</Label>
                      <Input id="edit-company_object" {...form.register('company_object')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-legal_nature">Natureza Jurídica</Label>
                      <Input id="edit-legal_nature" {...form.register('legal_nature')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-country_of_incorporation">País de Constituição</Label>
                      <Input id="edit-country_of_incorporation" {...form.register('country_of_incorporation')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-cae_code">Código CAE</Label>
                      <Input id="edit-cae_code" {...form.register('cae_code')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-rcbe_code">Código RCBE</Label>
                      <Input id="edit-rcbe_code" {...form.register('rcbe_code')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-company_branches">Sucursais</Label>
                      <Input id="edit-company_branches" {...form.register('company_branches')} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ─── Observations ─── */}
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="edit-observations">Observações</Label>
              <Textarea id="edit-observations" {...form.register('observations')} rows={3} />
            </div>
          </div>
        </form>

        {/* ─── Fixed Footer ─── */}
        <SheetFooter className="border-t px-6 py-4 flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" form="owner-edit-form" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Alterações
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function buildDefaults(owner: any): OwnerFormData {
  return {
    person_type: (owner?.person_type as 'singular' | 'coletiva') || 'singular',
    name: owner?.name || '',
    email: owner?.email || '',
    phone: owner?.phone || '',
    nif: owner?.nif || '',
    nationality: owner?.nationality || '',
    naturality: owner?.naturality || '',
    marital_status: owner?.marital_status || '',
    marital_regime: owner?.marital_regime || '',
    address: owner?.address || '',
    postal_code: owner?.postal_code || '',
    city: owner?.city || '',
    observations: owner?.observations || '',
    birth_date: owner?.birth_date || '',
    id_doc_type: owner?.id_doc_type || '',
    id_doc_number: owner?.id_doc_number || '',
    id_doc_expiry: owner?.id_doc_expiry || '',
    id_doc_issued_by: owner?.id_doc_issued_by || '',
    profession: owner?.profession || '',
    last_profession: owner?.last_profession || '',
    is_portugal_resident: owner?.is_portugal_resident ?? true,
    residence_country: owner?.residence_country || '',
    is_pep: owner?.is_pep ?? false,
    pep_position: owner?.pep_position || '',
    funds_origin: owner?.funds_origin || [],
    legal_representative_name: owner?.legal_representative_name || '',
    legal_representative_nif: owner?.legal_representative_nif || '',
    legal_rep_id_doc: owner?.legal_rep_id_doc || '',
    company_cert_url: owner?.company_cert_url || '',
    company_object: owner?.company_object || '',
    company_branches: owner?.company_branches || '',
    legal_nature: owner?.legal_nature || '',
    country_of_incorporation: owner?.country_of_incorporation || '',
    cae_code: owner?.cae_code || '',
    rcbe_code: owner?.rcbe_code || '',
  }
}
