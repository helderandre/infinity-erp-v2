'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface QualifyEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: any | null
  pipelineType: string
  targetStageId?: string
  onQualified?: () => void
}

const PIPELINE_TO_TIPO: Record<string, string[]> = {
  comprador: ['Compra'],
  vendedor: ['Venda'],
  arrendatario: ['Arrendatário'],
  arrendador: ['Arrendador'],
}

const TIPO_LABELS: Record<string, string> = {
  Compra: 'Compra',
  Venda: 'Venda',
  'Compra e Venda': 'Compra e Venda',
  'Arrendatário': 'Arrendamento (procura)',
  'Arrendador': 'Arrendamento (proprietário)',
}

const PROPERTY_TYPES = [
  'Apartamento', 'Moradia', 'Quinta', 'Prédio',
  'Comércio', 'Garagem', 'Terreno Urbano', 'Terreno Rústico',
]

export function QualifyEntryDialog({
  open,
  onOpenChange,
  entry,
  pipelineType,
  targetStageId,
  onQualified,
}: QualifyEntryDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [stages, setStages] = useState<any[]>([])

  const defaultTipo = PIPELINE_TO_TIPO[pipelineType]?.[0] || 'Compra'
  const [form, setForm] = useState({
    tipo: defaultTipo,
    tipo_imovel: '',
    localizacao: '',
    quartos_min: '',
    orcamento: '',
    orcamento_max: '',
    observacoes: '',
  })

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      setForm({
        tipo: PIPELINE_TO_TIPO[pipelineType]?.[0] || 'Compra',
        tipo_imovel: '',
        localizacao: '',
        quartos_min: '',
        orcamento: '',
        orcamento_max: '',
        observacoes: entry.notes || '',
      })
    }
  }, [entry, pipelineType])

  // Fetch pipeline stages
  useEffect(() => {
    if (!open) return
    fetch(`/api/crm/kanban/${pipelineType}`)
      .then((r) => r.json())
      .then((data) => {
        const stageList = (data.columns || [])
          .map((c: any) => c.stage)
          .filter((s: any) => !s.is_terminal)
        setStages(stageList)
      })
      .catch(() => {})
  }, [open, pipelineType])

  const contact = entry?.contact
  const contactId = contact?.id

  const handleSubmit = async () => {
    if (!contactId) {
      toast.error('Contacto não encontrado')
      return
    }

    setSubmitting(true)
    try {
      // Find the target stage: use provided targetStageId, or the second stage (after "Leads")
      const stageId = targetStageId || stages.find((s) => s.order_index === 1)?.id || stages[0]?.id
      if (!stageId) {
        toast.error('Fase de pipeline não encontrada')
        return
      }

      const payload: Record<string, any> = {
        lead_id: contactId,
        entry_id: entry.id,
        tipo: form.tipo,
        pipeline_stage_id: stageId,
        assigned_consultant_id: entry.assigned_consultant?.id || contact?.agent_id || null,
        observacoes: form.observacoes || null,
      }

      if (form.tipo_imovel) payload.tipo_imovel = form.tipo_imovel
      if (form.localizacao) payload.localizacao = form.localizacao
      if (form.quartos_min) payload.quartos_min = parseInt(form.quartos_min)
      if (form.orcamento) payload.expected_value = parseFloat(form.orcamento)
      if (form.orcamento_max) payload.orcamento_max = parseFloat(form.orcamento_max)
      if (form.orcamento) payload.orcamento = parseFloat(form.orcamento)

      const res = await fetch('/api/crm/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao qualificar')
      }

      toast.success('Lead qualificado — negócio criado')
      onOpenChange(false)
      onQualified?.()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao qualificar lead')
    } finally {
      setSubmitting(false)
    }
  }

  const isBuyer = pipelineType === 'comprador' || pipelineType === 'arrendatario'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Qualificar Lead
          </DialogTitle>
        </DialogHeader>

        {entry && (
          <div className="space-y-4">
            {/* Contact summary */}
            <div className="rounded-xl bg-muted/30 p-3 space-y-1">
              <p className="font-semibold text-sm">{contact?.nome || entry.raw_name}</p>
              <div className="flex gap-3 text-xs text-muted-foreground">
                {(contact?.email || entry.raw_email) && (
                  <span>{contact?.email || entry.raw_email}</span>
                )}
                {(contact?.telemovel || entry.raw_phone) && (
                  <span>{contact?.telemovel || entry.raw_phone}</span>
                )}
              </div>
              {entry.has_referral && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 rounded-full gap-0.5 mt-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  Referência{entry.referral_pct ? ` ${entry.referral_pct}%` : ''}
                </Badge>
              )}
            </div>

            {/* Deal type */}
            <div>
              <Label className="text-xs">Tipo de Negócio</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Property criteria */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de Imóvel</Label>
                <Select value={form.tipo_imovel || '_none'} onValueChange={(v) => setForm((p) => ({ ...p, tipo_imovel: v === '_none' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Qualquer</SelectItem>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{isBuyer ? 'Quartos (mín.)' : 'Quartos'}</Label>
                <Input
                  type="number"
                  placeholder="ex: 2"
                  value={form.quartos_min}
                  onChange={(e) => setForm((p) => ({ ...p, quartos_min: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Localização</Label>
              <Input
                placeholder="ex: Lisboa, Cascais, Sintra..."
                value={form.localizacao}
                onChange={(e) => setForm((p) => ({ ...p, localizacao: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{isBuyer ? 'Orçamento mín. (€)' : 'Preço pretendido (€)'}</Label>
                <Input
                  type="number"
                  placeholder="ex: 200000"
                  value={form.orcamento}
                  onChange={(e) => setForm((p) => ({ ...p, orcamento: e.target.value }))}
                />
              </div>
              {isBuyer && (
                <div>
                  <Label className="text-xs">Orçamento máx. (€)</Label>
                  <Input
                    type="number"
                    placeholder="ex: 350000"
                    value={form.orcamento_max}
                    onChange={(e) => setForm((p) => ({ ...p, orcamento_max: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={2}
                placeholder="Notas sobre o que o cliente procura..."
                value={form.observacoes}
                onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-full">
            {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-1.5 h-3.5 w-3.5" />}
            Qualificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
