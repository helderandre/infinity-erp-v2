'use client'

import { useState } from 'react'
import { Pencil, Check, FileText, ExternalLink, Trash2, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { MaskInput, type MaskPattern } from '@/components/ui/mask-input'
import { Textarea } from '@/components/ui/textarea'
import { phonePTMask, nifMask } from '@/lib/masks'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  LEAD_MEIOS_CONTACTO,
  LEAD_GENEROS,
  LEAD_TIPOS_DOCUMENTO,
} from '@/lib/constants'
import { DocumentAnalyzer } from './document-analyzer'
import type { LeadWithAgent, LeadAttachment } from '@/types/lead'

/* ─── Display Field ─── */
function DisplayField({
  label,
  value,
  icon,
  fullWidth,
}: {
  label: string
  value?: string | null
  icon?: string
  fullWidth?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${fullWidth ? 'col-span-full' : ''}`}
    >
      <p className="text-xs text-muted-foreground mb-0.5">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

/* ─── Edit Field ─── */
function EditField({
  label,
  value,
  icon,
  fullWidth,
  type = 'text',
  placeholder,
  onChange,
  mask,
}: {
  label: string
  value?: string | null
  icon?: string
  fullWidth?: boolean
  type?: string
  placeholder?: string
  onChange: (v: string) => void
  mask?: MaskPattern
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${fullWidth ? 'col-span-full' : ''}`}
    >
      <p className="text-xs text-muted-foreground mb-1">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </p>
      {mask ? (
        <MaskInput
          mask={mask}
          value={value || ''}
          onValueChange={(_masked, unmasked) => onChange(unmasked)}
          placeholder={placeholder || '—'}
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium"
        />
      ) : (
        <Input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '—'}
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium"
        />
      )}
    </div>
  )
}

/* ─── Select Display/Edit Field ─── */
function SelectField({
  label,
  value,
  icon,
  options,
  placeholder,
  onChange,
  isEditing,
}: {
  label: string
  value?: string | null
  icon?: string
  options: readonly string[]
  placeholder?: string
  onChange: (v: string) => void
  isEditing: boolean
}) {
  if (!isEditing) {
    return <DisplayField label={label} value={value} icon={icon} />
  }
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground mb-1">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </p>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 border-0 p-0 shadow-none focus:ring-0 text-sm font-medium">
          <SelectValue placeholder={placeholder || 'Selecionar...'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/* ─── Toggle Field ─── */
function ToggleField({
  label,
  icon,
  checked,
  onChange,
  isEditing,
}: {
  label: string
  icon?: string
  checked: boolean
  onChange: (v: boolean) => void
  isEditing: boolean
}) {
  return (
    <div className="rounded-lg border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          disabled={!isEditing}
        />
        <p className="text-sm">
          {icon && <span className="mr-1">{icon}</span>}
          {label}
        </p>
      </div>
      {!isEditing && (
        <span className="text-sm text-muted-foreground">
          {checked ? 'Sim' : 'Não'}
        </span>
      )}
    </div>
  )
}

/* ─── Section Header ─── */
function SectionHeader({ title }: { title: string }) {
  return (
    <p className="col-span-full text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">
      {title}
    </p>
  )
}

/* ─── Main Component ─── */
interface LeadDataCardProps {
  lead: LeadWithAgent
  form: Record<string, unknown>
  onFieldChange: (field: string, value: unknown) => void
  onSave: (fields: string[]) => Promise<void>
  isSaving: boolean
  attachments: LeadAttachment[]
  onDeleteAttachment: (id: string) => void
  onDocumentAnalysisApply: (fields: Record<string, unknown>) => void
  cpLoading: boolean
  onPostalCodeLookup: () => void
  nipcLoading: boolean
  onNipcLookup: () => void
}

export function LeadDataCard({
  lead,
  form,
  onFieldChange,
  onSave,
  isSaving,
  attachments,
  onDeleteAttachment,
  onDocumentAnalysisApply,
  cpLoading,
  onPostalCodeLookup,
  nipcLoading,
  onNipcLookup,
}: LeadDataCardProps) {
  const [isEditing, setIsEditing] = useState(false)

  const val = (field: string) => (form[field] as string) ?? ''
  const boolVal = (field: string) => !!form[field]

  const handleSaveAndExit = async () => {
    // Save all data fields at once
    const allFields = [
      'telemovel', 'telefone_fixo', 'email', 'meio_contacto_preferencial',
      'consentimento_contacto', 'consentimento_webmarketing', 'observacoes',
      'full_name', 'genero', 'data_nascimento', 'tipo_documento',
      'numero_documento', 'data_validade_documento', 'nacionalidade',
      'pais_emissor', 'nif',
      'morada', 'codigo_postal', 'localidade', 'distrito', 'concelho', 'zona', 'pais',
      'tem_empresa', 'nipc', 'empresa', 'morada_empresa',
      'telefone_empresa', 'email_empresa', 'website_empresa',
    ]
    await onSave(allFields)
    setIsEditing(false)
  }

  // Document URL for analyzer
  const docUrl = (lead.documento_identificacao_frente_url || lead.documento_identificacao_url || null) as string | null

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <Tabs defaultValue="contactos">
          {/* Sub-tabs header + edit button */}
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-muted/50 rounded-full p-1 h-auto gap-0">
              <TabsTrigger
                value="contactos"
                className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                📞 Contactos
              </TabsTrigger>
              <TabsTrigger
                value="identificacao"
                className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                🪪 Identificação
              </TabsTrigger>
              <TabsTrigger
                value="morada"
                className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                📍 Morada
              </TabsTrigger>
              <TabsTrigger
                value="empresa"
                className="rounded-full px-4 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                🏢 Empresa
              </TabsTrigger>
            </TabsList>

            {/* Edit / Save button */}
            {isEditing ? (
              <button
                onClick={handleSaveAndExit}
                disabled={isSaving}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                {isSaving ? (
                  <Spinner variant="infinite" size={16} />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* ─── Contactos ─── */}
          <TabsContent value="contactos" className="mt-0">
            <div className="grid grid-cols-2 gap-3">
              {isEditing ? (
                <>
                  <EditField icon="📱" label="Telemóvel" value={val('telemovel')} onChange={(v) => onFieldChange('telemovel', v)} mask={phonePTMask} />
                  <EditField icon="☎️" label="Telefone Fixo" value={val('telefone_fixo')} onChange={(v) => onFieldChange('telefone_fixo', v)} mask={phonePTMask} />
                  <EditField icon="✉️" label="Email" value={val('email')} type="email" onChange={(v) => onFieldChange('email', v)} />
                  <SelectField icon="💬" label="Meio de Contacto Preferencial" value={val('meio_contacto_preferencial')} options={LEAD_MEIOS_CONTACTO} onChange={(v) => onFieldChange('meio_contacto_preferencial', v)} isEditing />
                  <ToggleField icon="✅" label="Consentimento de Contacto" checked={boolVal('consentimento_contacto')} onChange={(v) => onFieldChange('consentimento_contacto', v)} isEditing />
                  <ToggleField icon="📣" label="Consentimento WebMarketing" checked={boolVal('consentimento_webmarketing')} onChange={(v) => onFieldChange('consentimento_webmarketing', v)} isEditing />
                  <div className="col-span-full rounded-lg border px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-1">📝 Observações</p>
                    <Textarea
                      value={val('observacoes')}
                      onChange={(e) => onFieldChange('observacoes', e.target.value)}
                      placeholder="Sem observações..."
                      rows={3}
                      className="border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium resize-y"
                    />
                  </div>
                </>
              ) : (
                <>
                  <DisplayField icon="📱" label="Telemóvel" value={val('telemovel')} />
                  <DisplayField icon="☎️" label="Telefone Fixo" value={val('telefone_fixo')} />
                  <DisplayField icon="✉️" label="Email" value={val('email')} />
                  <DisplayField icon="💬" label="Meio de Contacto Preferencial" value={val('meio_contacto_preferencial')} />
                  <ToggleField icon="✅" label="Consentimento de Contacto" checked={boolVal('consentimento_contacto')} onChange={() => {}} isEditing={false} />
                  <ToggleField icon="📣" label="Consentimento WebMarketing" checked={boolVal('consentimento_webmarketing')} onChange={() => {}} isEditing={false} />
                  <DisplayField icon="📝" label="Observações" value={val('observacoes')} fullWidth />
                </>
              )}
            </div>
          </TabsContent>

          {/* ─── Identificação ─── */}
          <TabsContent value="identificacao" className="mt-0">
            <div className="grid grid-cols-2 gap-3">
              {isEditing ? (
                <>
                  <EditField icon="👤" label="Nome Completo" value={val('full_name')} fullWidth onChange={(v) => onFieldChange('full_name', v)} />
                  <SelectField icon="👤" label="Género" value={val('genero')} options={LEAD_GENEROS} onChange={(v) => onFieldChange('genero', v)} isEditing />
                  <EditField icon="🎂" label="Data de Nascimento" value={val('data_nascimento')} type="date" onChange={(v) => onFieldChange('data_nascimento', v)} />

                  <SectionHeader title="Documento de Identificação" />
                  <SelectField icon="🪪" label="Tipo de Documento" value={val('tipo_documento')} options={LEAD_TIPOS_DOCUMENTO} onChange={(v) => onFieldChange('tipo_documento', v)} isEditing />
                  <EditField icon="🆔" label="Número de Documento" value={val('numero_documento')} onChange={(v) => onFieldChange('numero_documento', v)} />
                  <EditField icon="📅" label="Data de Validade" value={val('data_validade_documento')} type="date" onChange={(v) => onFieldChange('data_validade_documento', v)} />
                  <EditField icon="🌍" label="Nacionalidade" value={val('nacionalidade')} onChange={(v) => onFieldChange('nacionalidade', v)} />
                  <EditField icon="🌐" label="País Emissor" value={val('pais_emissor')} onChange={(v) => onFieldChange('pais_emissor', v)} />
                  <EditField icon="🏛️" label="NIF" value={val('nif')} onChange={(v) => onFieldChange('nif', v)} mask={nifMask} />
                </>
              ) : (
                <>
                  <DisplayField icon="👤" label="Nome Completo" value={val('full_name')} fullWidth />
                  <DisplayField icon="👤" label="Género" value={val('genero')} />
                  <DisplayField icon="🎂" label="Data de Nascimento" value={val('data_nascimento')} />

                  <SectionHeader title="Documento de Identificação" />
                  <DisplayField icon="🪪" label="Tipo de Documento" value={val('tipo_documento')} />
                  <DisplayField icon="🆔" label="Número de Documento" value={val('numero_documento')} />
                  <DisplayField icon="📅" label="Data de Validade" value={val('data_validade_documento')} />
                  <DisplayField icon="🌍" label="Nacionalidade" value={val('nacionalidade')} />
                  <DisplayField icon="🌐" label="País Emissor" value={val('pais_emissor')} />
                  <DisplayField icon="🏛️" label="NIF" value={val('nif')} />
                </>
              )}

              {/* Document file section */}
              {docUrl && (
                <>
                  <SectionHeader title="Ficheiro do Documento" />
                  <div className="col-span-full rounded-lg border px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Documento carregado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DocumentAnalyzer
                        leadId={lead.id}
                        documentUrl={docUrl}
                        onApply={(fields) => onDocumentAnalysisApply(fields as Record<string, unknown>)}
                      />
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ─── Morada ─── */}
          <TabsContent value="morada" className="mt-0">
            <div className="grid grid-cols-2 gap-3">
              {isEditing ? (
                <>
                  <EditField icon="🏠" label="Morada" value={val('morada')} fullWidth placeholder="Rua, número, andar..." onChange={(v) => onFieldChange('morada', v)} />
                  <div className="rounded-lg border px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-1">📮 Código Postal</p>
                    <div className="flex gap-2">
                      <Input
                        value={val('codigo_postal')}
                        onChange={(e) => onFieldChange('codigo_postal', e.target.value)}
                        placeholder="XXXX-XXX"
                        className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={onPostalCodeLookup}
                        disabled={cpLoading}
                      >
                        {cpLoading ? <Spinner variant="infinite" size={12} /> : 'Auto'}
                      </Button>
                    </div>
                  </div>
                  <EditField icon="🏘️" label="Localidade" value={val('localidade')} onChange={(v) => onFieldChange('localidade', v)} />
                  <EditField icon="🏙️" label="Distrito" value={val('distrito')} onChange={(v) => onFieldChange('distrito', v)} />
                  <EditField icon="🏛️" label="Concelho" value={val('concelho')} onChange={(v) => onFieldChange('concelho', v)} />
                  <EditField icon="📍" label="Zona" value={val('zona')} onChange={(v) => onFieldChange('zona', v)} />
                  <EditField icon="🌍" label="País" value={val('pais')} placeholder="Portugal" onChange={(v) => onFieldChange('pais', v)} />
                </>
              ) : (
                <>
                  <DisplayField icon="🏠" label="Morada" value={val('morada')} fullWidth />
                  <DisplayField icon="📮" label="Código Postal" value={val('codigo_postal')} />
                  <DisplayField icon="🏘️" label="Localidade" value={val('localidade')} />
                  <DisplayField icon="🏙️" label="Distrito" value={val('distrito')} />
                  <DisplayField icon="🏛️" label="Concelho" value={val('concelho')} />
                  <DisplayField icon="📍" label="Zona" value={val('zona')} />
                  <DisplayField icon="🌍" label="País" value={val('pais')} />
                </>
              )}
            </div>
          </TabsContent>

          {/* ─── Empresa ─── */}
          <TabsContent value="empresa" className="mt-0">
            <div className="grid grid-cols-2 gap-3">
              {/* Tem Empresa toggle - always shown */}
              <div className="col-span-full rounded-lg border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>🏢</span>
                  <span className="text-sm font-medium">Tem Empresa</span>
                </div>
                {isEditing ? (
                  <Switch
                    checked={boolVal('tem_empresa')}
                    onCheckedChange={(v) => onFieldChange('tem_empresa', v)}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {boolVal('tem_empresa') ? 'Sim' : 'Não'}
                  </span>
                )}
              </div>

              {boolVal('tem_empresa') && (
                <>
                  {isEditing ? (
                    <>
                      <div className="rounded-lg border px-4 py-3">
                        <p className="text-xs text-muted-foreground mb-1">🔢 NIPC</p>
                        <div className="flex gap-2">
                          <Input
                            value={val('nipc')}
                            onChange={(e) => onFieldChange('nipc', e.target.value)}
                            placeholder="000000000"
                            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={onNipcLookup}
                            disabled={nipcLoading}
                          >
                            {nipcLoading ? <Spinner variant="infinite" size={12} /> : 'Pesquisar'}
                          </Button>
                        </div>
                      </div>
                      <EditField icon="🏢" label="Nome da Empresa" value={val('empresa')} onChange={(v) => onFieldChange('empresa', v)} />
                      <EditField icon="📍" label="Morada da Empresa" value={val('morada_empresa')} fullWidth onChange={(v) => onFieldChange('morada_empresa', v)} />
                      <EditField icon="📞" label="Telefone" value={val('telefone_empresa')} onChange={(v) => onFieldChange('telefone_empresa', v)} mask={phonePTMask} />
                      <EditField icon="✉️" label="Email" value={val('email_empresa')} type="email" onChange={(v) => onFieldChange('email_empresa', v)} />
                      <EditField icon="🌐" label="Website" value={val('website_empresa')} placeholder="https://" onChange={(v) => onFieldChange('website_empresa', v)} />
                    </>
                  ) : (
                    <>
                      <DisplayField icon="🔢" label="NIPC" value={val('nipc')} />
                      <DisplayField icon="🏢" label="Nome da Empresa" value={val('empresa')} />
                      <DisplayField icon="📍" label="Morada da Empresa" value={val('morada_empresa')} fullWidth />
                      <DisplayField icon="📞" label="Telefone" value={val('telefone_empresa')} />
                      <DisplayField icon="✉️" label="Email" value={val('email_empresa')} />
                      <DisplayField icon="🌐" label="Website" value={val('website_empresa')} />
                    </>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
