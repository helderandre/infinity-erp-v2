'use client'

import { useEffect, useState } from 'react'
import { DealToggleGroup } from './deal-toggle-group'
import { DealQuickPick } from './deal-quick-pick'
import {
  AcqFieldWrapper,
  AcqFieldLabel,
  AcqInputField,
  AcqTextareaField,
  AcqSelectField,
} from '@/components/acquisitions/acquisition-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, FileText, X, Building2, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { DEAL_SCENARIOS } from '@/types/deal'
import type { DealScenario } from '@/types/deal'

interface StepPartilhaProps {
  form: any
  errors: Record<string, string>
  dealId: string | null
  /** When true, property is already known — hide angariacao_externa and lock property select */
  fromProperty?: boolean
  /** Called after proposal upload to auto-scan with AI */
  onProposalUploaded?: (fileUrl: string) => void
  /** Whether proposal is being scanned */
  scanningProposal?: boolean
  /** Creates a draft and returns the deal ID */
  ensureDraft?: () => Promise<string | null>
}

export function StepPartilha({ form, errors, dealId, fromProperty, onProposalUploaded, scanningProposal, ensureDraft }: StepPartilhaProps) {
  const isEmpty = (field: string) => {
    const v = form.watch(field)
    return v === undefined || v === null || v === '' || v === 0
  }

  const scenario = form.watch('scenario') as DealScenario | undefined
  const proposalUrl = form.watch('proposal_file_url')
  const proposalName = form.watch('proposal_file_name')
  const propertyId = form.watch('property_id')
  const [uploading, setUploading] = useState(false)
  const [properties, setProperties] = useState<{ value: string; label: string }[]>([])
  const [consultants, setConsultants] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    // Only load properties list if not from property context
    if (!fromProperty) {
      fetch('/api/properties?limit=200&status=active')
        .then((r) => r.json())
        .then((res) => {
          const list = Array.isArray(res) ? res : res.data
          if (Array.isArray(list)) {
            setProperties(list.map((p: { id: string; title: string; external_ref?: string }) => ({
              value: p.id,
              label: p.external_ref ? `${p.external_ref} - ${p.title}` : p.title,
            })))
          }
        })
        .catch(() => {})
    }

    fetch('/api/consultants?per_page=100')
      .then((r) => r.json())
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data
        if (Array.isArray(list)) {
          setConsultants(list.map((c: { id: string; commercial_name: string }) => ({
            value: c.id,
            label: c.commercial_name,
          })))
        }
      })
      .catch(() => {})
  }, [fromProperty])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Create draft if it doesn't exist yet
      let id = dealId
      if (!id && ensureDraft) {
        id = await ensureDraft()
      }
      if (!id) {
        throw new Error('Não foi possível criar rascunho')
      }

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/deals/${id}/proposal-upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.url) {
        form.setValue('proposal_file_url', data.url)
        form.setValue('proposal_file_name', data.name)
        // Auto-scan proposal with AI
        onProposalUploaded?.(data.url)
      }
    } catch {
      // handled by caller
    } finally {
      setUploading(false)
    }
  }

  // Available scenarios — hide angariacao_externa when from property
  const availableScenarios = fromProperty
    ? Object.entries(DEAL_SCENARIOS).filter(([key]) => key !== 'angariacao_externa')
    : Object.entries(DEAL_SCENARIOS)

  const scenarioInfo: Record<DealScenario, { text: string; color: string }> = {
    pleno: { text: 'Angariação e comprador teus', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    comprador_externo: { text: 'Angariação tua e comprador externo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pleno_agencia: { text: 'Angariação interna e comprador teu', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    angariacao_externa: { text: 'Angariação externa e comprador teu', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  }

  // Does this scenario need a property selector?
  const needsPropertySelect = (scenario === 'pleno' || scenario === 'comprador_externo') && !fromProperty

  return (
    <div className="space-y-4">
      {/* Proposal Upload */}
      <AcqFieldWrapper fullWidth isMissing={isEmpty('proposal_file_url')}>
        <AcqFieldLabel required>Faz o upload da proposta</AcqFieldLabel>
        {proposalUrl ? (
          <div className="flex items-center gap-2 mt-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium truncate flex-1">{proposalName}</span>
            {scanningProposal && (
              <span className="flex items-center gap-1.5 text-xs text-violet-600">
                <Spinner variant="infinite" size={12} />
                A analisar...
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                form.setValue('proposal_file_url', '')
                form.setValue('proposal_file_name', '')
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {uploading ? 'A enviar...' : 'Escolher ficheiro...'}
            </span>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        )}
        {errors.proposal_file_url && <p className="text-xs text-destructive mt-1">{errors.proposal_file_url}</p>}
      </AcqFieldWrapper>

      {/* Scenario selection */}
      <AcqFieldWrapper fullWidth isMissing={isEmpty('scenario')}>
        <AcqFieldLabel required>Qual dos cenários se aplica?</AcqFieldLabel>
        <div className="mt-2">
          <DealToggleGroup
            value={scenario}
            onChange={(v) => form.setValue('scenario', v as DealScenario)}
            options={availableScenarios.map(([value, { label }]) => ({ value, label }))}
            error={errors.scenario}
          />
        </div>
      </AcqFieldWrapper>

      {/* Scenario info banner */}
      {scenario && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm ${scenarioInfo[scenario].color}`}>
          {scenarioInfo[scenario].text}
        </div>
      )}

      {/* Property — locked when from property context */}
      {fromProperty && (scenario === 'pleno' || scenario === 'comprador_externo') && (
        <AcqFieldWrapper fullWidth>
          <AcqFieldLabel>Imóvel</AcqFieldLabel>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Imóvel pré-seleccionado a partir da página do imóvel
            </span>
          </div>
        </AcqFieldWrapper>
      )}

      {/* Pleno + Comprador Externo: select own property (only when NOT from property) */}
      {needsPropertySelect && (
        <AcqSelectField
          label="Qual o teu imóvel?"
          value={propertyId}
          onChange={(v) => form.setValue('property_id', v)}
          options={properties}
          placeholder="Seleccionar imóvel..."
          required
          fullWidth
          error={errors.property_id}
          isMissing={isEmpty('property_id')}
        />
      )}

      {/* Pleno de Agencia: colleague + colleague's property */}
      {scenario === 'pleno_agencia' && (
        <div className="grid grid-cols-2 gap-3">
          <AcqSelectField
            label="Colega com a Angariação"
            value={form.watch('internal_colleague_id')}
            onChange={(v) => form.setValue('internal_colleague_id', v)}
            options={consultants}
            placeholder="Seleccionar colega..."
            required
            error={errors.internal_colleague_id}
            isMissing={isEmpty('internal_colleague_id')}
          />
          {!fromProperty && (
            <AcqSelectField
              label="Imóvel do colega"
              value={form.watch('colleague_property_id')}
              onChange={(v) => {
                form.setValue('colleague_property_id', v)
                form.setValue('property_id', v)
              }}
              options={properties}
              placeholder="Seleccionar imóvel..."
              required
              error={errors.colleague_property_id}
              isMissing={isEmpty('colleague_property_id')}
            />
          )}
        </div>
      )}

      {/* Angariacao Externa: link (only when NOT from property) */}
      {scenario === 'angariacao_externa' && !fromProperty && (
        <AcqInputField
          label="Link do imóvel"
          value={form.watch('external_property_link')}
          onChange={(v) => form.setValue('external_property_link', v)}
          placeholder="https://..."
          fullWidth
        />
      )}

      {/* Network type (Comprador Externo + Angariacao Externa) */}
      {(scenario === 'comprador_externo' || scenario === 'angariacao_externa') && (
        <AcqFieldWrapper fullWidth isMissing={isEmpty('share_network_type')}>
          <AcqFieldLabel required>Tipo de Rede</AcqFieldLabel>
          <div className="mt-2">
            <DealToggleGroup
              value={form.watch('share_network_type')}
              onChange={(v) => form.setValue('share_network_type', v)}
              options={[
                { value: 'same_network', label: 'Mesma Rede (Remax)' },
                { value: 'external_network', label: 'Rede Externa' },
              ]}
              error={errors.share_network_type}
            />
          </div>
        </AcqFieldWrapper>
      )}

      {/* External agency fields (Comprador Externo + Angariacao Externa) */}
      {(scenario === 'comprador_externo' || scenario === 'angariacao_externa') && (
        <div className="grid grid-cols-2 gap-3">
          <AcqInputField
            label="Nome da Agência"
            value={form.watch('partner_agency_name')}
            onChange={(v) => form.setValue('partner_agency_name', v)}
            required
            error={errors.partner_agency_name}
            isMissing={isEmpty('partner_agency_name')}
          />
          <AcqInputField
            label="Nome do Consultor"
            value={form.watch('external_consultant_name')}
            onChange={(v) => form.setValue('external_consultant_name', v)}
            required
            error={errors.external_consultant_name}
            isMissing={isEmpty('external_consultant_name')}
          />
          <AcqInputField
            label="Contacto do Consultor"
            value={form.watch('external_consultant_phone')}
            onChange={(v) => form.setValue('external_consultant_phone', v)}
            required
            error={errors.external_consultant_phone}
            isMissing={isEmpty('external_consultant_phone')}
          />
          <AcqInputField
            label="Email do Consultor"
            value={form.watch('external_consultant_email')}
            onChange={(v) => form.setValue('external_consultant_email', v)}
            required
            error={errors.external_consultant_email}
            isMissing={isEmpty('external_consultant_email')}
          />
        </div>
      )}

      {/* Partilha % (all except Pleno) */}
      {scenario && scenario !== 'pleno' && (
        <DealQuickPick
          label="Partilha"
          value={form.watch('share_pct')}
          onChange={(v) => form.setValue('share_pct', parseFloat(v) || 0)}
          quickPicks={[{ value: 50, label: '50%' }]}
          hint="Indica a percentagem atribuída à tua parte (ex: numa partilha atípica em que ficas só com 40%, insere 40. Num cenário comum de 50/50 insere 50)"
          required
          error={errors.share_pct}
        />
      )}

      {/* Notes */}
      <AcqTextareaField
        label="Observações sobre a Partilha"
        value={form.watch('share_notes')}
        onChange={(v) => form.setValue('share_notes', v)}
      />
    </div>
  )
}
