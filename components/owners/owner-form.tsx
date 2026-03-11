'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ownerSchema, type OwnerFormData } from '@/lib/validations/owner'
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
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { DatePicker } from '@/components/ui/date-picker'
import { OwnerSearch } from '@/components/owners/owner-search'
import { PERSON_TYPES, MARITAL_STATUS, MARITAL_REGIMES } from '@/lib/constants'
import { Loader2, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import type { OwnerRow } from '@/types/owner'

interface OwnerFormProps {
  owner?: OwnerRow | null
  onSuccess: (owner: OwnerRow) => void
  onCancel?: () => void
}

export function OwnerForm({ owner, onSuccess, onCancel }: OwnerFormProps) {
  const isEditing = !!owner

  const form = useForm<OwnerFormData>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
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
    },
  })

  const personType = form.watch('person_type')
  const isPep = form.watch('is_pep')
  const isResident = form.watch('is_portugal_resident')
  const { isSubmitting } = form.formState

  const onSubmit = async (data: OwnerFormData) => {
    try {
      const url = isEditing ? `/api/owners/${owner.id}` : '/api/owners'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar')
      }

      const saved = await res.json()
      toast.success(
        isEditing
          ? 'Proprietário actualizado com sucesso'
          : 'Proprietário criado com sucesso'
      )
      onSuccess(saved)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao guardar proprietário'
      )
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Tipo de Pessoa */}
      <div className="space-y-2">
        <Label>Tipo de Pessoa</Label>
        <Select
          value={personType}
          onValueChange={(v) =>
            form.setValue('person_type', v as 'singular' | 'coletiva')
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERSON_TYPES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.person_type && (
          <p className="text-sm text-destructive">
            {form.formState.errors.person_type.message}
          </p>
        )}
      </div>

      <Separator />

      {/* Dados Gerais */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {personType === 'coletiva' ? 'Dados da Empresa' : 'Dados Pessoais'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {personType === 'coletiva' ? 'Nome da Empresa *' : 'Nome Completo *'}
            </Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nif">NIF{personType === 'coletiva' ? '/NIPC' : ''}</Label>
            <Input id="nif" {...form.register('nif')} maxLength={9} />
            {form.formState.errors.nif && (
              <p className="text-sm text-destructive">
                {form.formState.errors.nif.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" {...form.register('phone')} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address">Morada</Label>
            <Input id="address" {...form.register('address')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">Código Postal</Label>
            <Input id="postal_code" {...form.register('postal_code')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Localidade</Label>
            <Input id="city" {...form.register('city')} />
          </div>
        </div>
      </div>

      {/* Campos Pessoa Singular */}
      {personType === 'singular' && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Identificação
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <DatePicker
                  value={form.watch('birth_date')}
                  onChange={(v) => form.setValue('birth_date', v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">Nacionalidade</Label>
                <Input
                  id="nationality"
                  {...form.register('nationality')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="naturality">Naturalidade</Label>
                <Input
                  id="naturality"
                  {...form.register('naturality')}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado Civil</Label>
                <Select
                  value={form.watch('marital_status') || ''}
                  onValueChange={(v) => form.setValue('marital_status', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MARITAL_STATUS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            <h3 className="text-sm font-medium text-muted-foreground pt-2">
              Documento de Identificação
            </h3>
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
                <Label htmlFor="id_doc_number">Número do Documento</Label>
                <Input
                  id="id_doc_number"
                  {...form.register('id_doc_number')}
                />
              </div>
              <div className="space-y-2">
                <Label>Validade</Label>
                <DatePicker
                  value={form.watch('id_doc_expiry')}
                  onChange={(v) => form.setValue('id_doc_expiry', v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="id_doc_issued_by">Emitido por</Label>
                <Input
                  id="id_doc_issued_by"
                  {...form.register('id_doc_issued_by')}
                />
              </div>
            </div>

            <h3 className="text-sm font-medium text-muted-foreground pt-2">
              Profissão e Residência
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profession">Profissão Actual</Label>
                <Input
                  id="profession"
                  {...form.register('profession')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_profession">Última Profissão</Label>
                <Input
                  id="last_profession"
                  {...form.register('last_profession')}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch
                  checked={isResident ?? true}
                  onCheckedChange={(v) =>
                    form.setValue('is_portugal_resident', v)
                  }
                />
                <Label>Residente em Portugal</Label>
              </div>
              {!isResident && (
                <div className="space-y-2">
                  <Label htmlFor="residence_country">País de Residência</Label>
                  <Input
                    id="residence_country"
                    {...form.register('residence_country')}
                  />
                </div>
              )}
            </div>

            <h3 className="text-sm font-medium text-muted-foreground pt-2">
              PEP (Pessoa Politicamente Exposta)
            </h3>
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
                  <Label htmlFor="pep_position">Cargo PEP</Label>
                  <Input
                    id="pep_position"
                    {...form.register('pep_position')}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Campos Pessoa Colectiva */}
      {personType === 'coletiva' && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Representante Legal
            </h3>

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
                <Label htmlFor="legal_representative_name">
                  Nome do Representante Legal *
                </Label>
                <Input
                  id="legal_representative_name"
                  {...form.register('legal_representative_name')}
                />
                {form.formState.errors.legal_representative_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.legal_representative_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_representative_nif">
                  NIF do Representante Legal *
                </Label>
                <Input
                  id="legal_representative_nif"
                  {...form.register('legal_representative_nif')}
                  maxLength={9}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_rep_id_doc">
                  Documento do Representante Legal
                </Label>
                <Input
                  id="legal_rep_id_doc"
                  {...form.register('legal_rep_id_doc')}
                />
              </div>
            </div>

            <h3 className="text-sm font-medium text-muted-foreground pt-2">
              Dados da Empresa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_object">Objecto Social</Label>
                <Input
                  id="company_object"
                  {...form.register('company_object')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_nature">Natureza Jurídica</Label>
                <Input
                  id="legal_nature"
                  {...form.register('legal_nature')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country_of_incorporation">
                  País de Constituição
                </Label>
                <Input
                  id="country_of_incorporation"
                  {...form.register('country_of_incorporation')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cae_code">Código CAE</Label>
                <Input
                  id="cae_code"
                  {...form.register('cae_code')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rcbe_code">Código RCBE</Label>
                <Input
                  id="rcbe_code"
                  {...form.register('rcbe_code')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_branches">Sucursais</Label>
                <Input
                  id="company_branches"
                  {...form.register('company_branches')}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Observações */}
      <Separator />
      <div className="space-y-2">
        <Label htmlFor="observations">Observações</Label>
        <Textarea
          id="observations"
          {...form.register('observations')}
          rows={3}
        />
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Guardar Alterações' : 'Criar Proprietário'}
        </Button>
      </div>
    </form>
  )
}
