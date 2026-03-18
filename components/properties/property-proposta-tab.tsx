'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, Download } from 'lucide-react'
import { toast } from 'sonner'

interface Lead {
  id: string
  nome: string
  email?: string
  telemovel?: string
}

interface PropertyPropostaTabProps {
  propertyId: string
  listingPrice?: number
  onGenerated?: () => void
}

export function PropertyPropostaTab({ propertyId, listingPrice, onGenerated }: PropertyPropostaTabProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [leadId, setLeadId] = useState('')
  const [preco, setPreco] = useState(listingPrice?.toString() || '')
  const [valorContrato, setValorContrato] = useState('')
  const [valorConclusao, setValorConclusao] = useState('')
  const [natureza, setNatureza] = useState('propriedade_plena')
  const [naturezaOutro, setNaturezaOutro] = useState('')
  const [temFinanciamento, setTemFinanciamento] = useState(false)
  const [valorFinanciamento, setValorFinanciamento] = useState('')
  const [valorReforco1, setValorReforco1] = useState('')
  const [dataReforco1, setDataReforco1] = useState('')
  const [valorReforco2, setValorReforco2] = useState('')
  const [dataReforco2, setDataReforco2] = useState('')
  const [condicoes, setCondicoes] = useState('')

  useEffect(() => {
    fetch('/api/leads?limit=100')
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((result) => {
        const list = Array.isArray(result) ? result : result?.data || []
        setLeads(list)
      })
      .catch(() => setLeads([]))
      .finally(() => setLeadsLoading(false))
  }, [])

  async function handleGenerate() {
    if (!leadId) {
      toast.error('Seleccione um lead (proponente)')
      return
    }
    if (!preco) {
      toast.error('Indique o preço da proposta')
      return
    }

    setGenerating(true)
    try {
      const body: Record<string, unknown> = {
        property_id: propertyId,
        lead_id: leadId,
        preco: Number(preco),
        valor_contrato: Number(valorContrato) || 0,
        valor_conclusao: Number(valorConclusao) || 0,
        natureza,
        tem_financiamento: temFinanciamento,
      }

      if (natureza === 'outro' && naturezaOutro) body.natureza_outro = naturezaOutro
      if (temFinanciamento && valorFinanciamento) body.valor_financiamento = Number(valorFinanciamento)
      if (valorReforco1 && dataReforco1) {
        body.valor_reforco_1 = Number(valorReforco1)
        body.data_reforco_1 = dataReforco1
      }
      if (valorReforco2 && dataReforco2) {
        body.valor_reforco_2 = Number(valorReforco2)
        body.data_reforco_2 = dataReforco2
      }
      if (condicoes) body.condicoes_complementares = condicoes

      const res = await fetch('/api/propostas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao gerar proposta')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposta-${propertyId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      // Save record to DB
      try {
        const selectedLead = leads.find(l => l.id === leadId)
        await fetch(`/api/properties/${propertyId}/propostas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            proponente_nome: selectedLead?.nome || '',
            natureza,
            preco: Number(preco),
            valor_contrato: Number(valorContrato) || 0,
            valor_conclusao: Number(valorConclusao) || 0,
            tem_financiamento: temFinanciamento,
            valor_financiamento: temFinanciamento ? Number(valorFinanciamento) || null : null,
            valor_reforco_1: valorReforco1 ? Number(valorReforco1) : null,
            data_reforco_1: dataReforco1 || null,
            valor_reforco_2: valorReforco2 ? Number(valorReforco2) : null,
            data_reforco_2: dataReforco2 || null,
            condicoes_complementares: condicoes || null,
            status: 'rascunho',
          }),
        })
      } catch { /* best effort */ }

      toast.success('Proposta gerada com sucesso')
      onGenerated?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar proposta')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerar Proposta de Compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lead selection */}
          <div className="space-y-2">
            <Label>Proponente (Lead) *</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder={leadsLoading ? 'A carregar...' : 'Seleccionar lead'} />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.nome} {lead.email ? `— ${lead.email}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Natureza */}
          <div className="space-y-2">
            <Label>Natureza da Transacção</Label>
            <Select value={natureza} onValueChange={setNatureza}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="propriedade_plena">Propriedade Plena</SelectItem>
                <SelectItem value="arrendamento">Arrendamento</SelectItem>
                <SelectItem value="cedencia_posicao">Cedência de Posição</SelectItem>
                <SelectItem value="superficie">Superfície</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            {natureza === 'outro' && (
              <Input
                placeholder="Especifique..."
                value={naturezaOutro}
                onChange={(e) => setNaturezaOutro(e.target.value)}
              />
            )}
          </div>

          {/* Valores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Preço proposto *</Label>
              <Input
                type="number"
                placeholder="350000"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor no contrato</Label>
              <Input
                type="number"
                placeholder="35000"
                value={valorContrato}
                onChange={(e) => setValorContrato(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor na conclusão</Label>
              <Input
                type="number"
                placeholder="315000"
                value={valorConclusao}
                onChange={(e) => setValorConclusao(e.target.value)}
              />
            </div>
          </div>

          {/* Financiamento */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={temFinanciamento} onCheckedChange={setTemFinanciamento} />
              <Label>Com financiamento</Label>
            </div>
            {temFinanciamento && (
              <Input
                type="number"
                placeholder="Valor do financiamento"
                value={valorFinanciamento}
                onChange={(e) => setValorFinanciamento(e.target.value)}
              />
            )}
          </div>

          {/* Reforços */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reforço 1 — Valor</Label>
              <Input
                type="number"
                placeholder="Valor"
                value={valorReforco1}
                onChange={(e) => setValorReforco1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reforço 1 — Data (DD/MM/AAAA)</Label>
              <Input
                placeholder="15/06/2026"
                value={dataReforco1}
                onChange={(e) => setDataReforco1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reforço 2 — Valor</Label>
              <Input
                type="number"
                placeholder="Valor"
                value={valorReforco2}
                onChange={(e) => setValorReforco2(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reforço 2 — Data (DD/MM/AAAA)</Label>
              <Input
                placeholder="15/09/2026"
                value={dataReforco2}
                onChange={(e) => setDataReforco2(e.target.value)}
              />
            </div>
          </div>

          {/* Condições */}
          <div className="space-y-2">
            <Label>Condições complementares</Label>
            <Textarea
              placeholder="Ex: Sujeito a aprovação de crédito bancário."
              value={condicoes}
              onChange={(e) => setCondicoes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Generate */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !leadId || !preco}
            className="w-full md:w-auto"
            size="lg"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {generating ? 'A gerar...' : 'Gerar Proposta PDF'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
