'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Mic, MicOff, FileText, Check } from 'lucide-react'
import { toast } from 'sonner'
import { TagsInput } from '@/components/ui/tags-input'
import { LOCALIZACOES_PT } from '@/lib/constants'

interface QuickFillProps {
  negocioId: string
  tipo?: string
  onApply: (fields: Record<string, unknown>) => void
}

const fieldLabels: Record<string, string> = {
  tipo_imovel: 'Tipo de Imóvel',
  localizacao: 'Localização',
  estado_imovel: 'Estado do Imóvel',
  orcamento: 'Orçamento Mínimo',
  orcamento_max: 'Orçamento Máximo',
  quartos_min: 'Quartos Mínimos',
  num_wc: 'Nº de WC',
  area_min_m2: 'Área Mínima',
  preco_venda: 'Preço de Venda',
  tipo_imovel_venda: 'Tipo de Imóvel',
  localizacao_venda: 'Localização',
  quartos: 'Quartos',
  casas_banho: 'Casas de Banho',
  area_m2: 'Área',
  total_divisoes: 'Total Divisões',
  distrito: 'Distrito',
  concelho: 'Concelho',
  freguesia: 'Freguesia',
  renda_max_mensal: 'Renda Máxima',
  renda_pretendida: 'Renda Pretendida',
  motivacao_compra: 'Motivação',
  prazo_compra: 'Prazo',
  observacoes: 'Observações',
}

const LOCATION_FIELDS = new Set(['localizacao', 'localizacao_venda'])
const NUMBER_FIELDS = new Set([
  'orcamento', 'orcamento_max', 'quartos_min', 'num_wc', 'area_min_m2',
  'preco_venda', 'quartos', 'casas_banho', 'area_m2', 'total_divisoes',
  'renda_max_mensal', 'renda_pretendida',
])

const COMPRA_FIELDS = new Set([
  'tipo_imovel', 'localizacao', 'estado_imovel',
  'orcamento', 'orcamento_max', 'quartos_min', 'num_wc',
  'area_min_m2', 'motivacao_compra', 'prazo_compra',
])

const VENDA_FIELDS = new Set([
  'preco_venda', 'tipo_imovel_venda', 'localizacao_venda',
  'quartos', 'casas_banho', 'area_m2', 'total_divisoes',
  'distrito', 'concelho', 'freguesia',
])

/* ─── Editable field row ─── */
function EditableRow({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  const label = fieldLabels[fieldKey] || fieldKey

  if (LOCATION_FIELDS.has(fieldKey)) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="rounded-md border px-2.5 py-1.5">
          <TagsInput
            value={String(value ?? '')}
            onChange={(v) => onChange(v)}
            placeholder="Adicionar zona..."
            suggestions={LOCALIZACOES_PT}
          />
        </div>
      </div>
    )
  }

  if (fieldKey === 'observacoes') {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          rows={3}
          className="text-sm"
        />
      </div>
    )
  }

  if (NUMBER_FIELDS.has(fieldKey)) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Input
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="h-8 text-sm"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 text-sm"
      />
    </div>
  )
}

export function QuickFill({ negocioId, tipo, onApply }: QuickFillProps) {
  const isCompraEVenda = tipo === 'Compra e Venda'
  const [text, setText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [extractedFields, setExtractedFields] = useState<Record<string, unknown> | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const handleExtract = async () => {
    if (!text.trim()) return
    setIsExtracting(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/fill-from-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro na extracção')
      }

      const data = await res.json()
      setExtractedFields(data)
      setShowPreview(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao extrair dados')
    } finally {
      setIsExtracting(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        await transcribeAudio(blob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('audio', blob)

      const res = await fetch(`/api/negocios/${negocioId}/transcribe`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Erro na transcrição')
      }

      const data = await res.json()
      setText((prev) => (prev ? prev + '\n' + data.text : data.text))
      toast.success('Áudio transcrito com sucesso')
    } catch {
      toast.error('Erro ao transcrever áudio')
    } finally {
      setIsTranscribing(false)
    }
  }

  const updateField = (key: string, value: unknown) => {
    setExtractedFields((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const handleApply = () => {
    if (!extractedFields) return
    // Filter out null/empty values
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(extractedFields)) {
      if (v != null && v !== '') cleaned[k] = v
    }
    onApply(cleaned)
    setShowPreview(false)
    setText('')
    toast.success('Dados aplicados com sucesso')
  }

  /* ─── Render field rows for a given set of keys ─── */
  const renderFields = (fields: Set<string>) => {
    if (!extractedFields) return null
    const entries = Object.entries(extractedFields).filter(([k]) => fields.has(k))
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground py-4 text-center">Nenhum campo extraído</p>
    }
    return (
      <div className="grid grid-cols-2 gap-3">
        {entries.map(([key, value]) => {
          const isFullWidth = LOCATION_FIELDS.has(key) || key === 'observacoes'
          return (
            <div key={key} className={isFullWidth ? 'col-span-2' : ''}>
              <EditableRow
                fieldKey={key}
                value={value}
                onChange={(v) => updateField(key, v)}
              />
            </div>
          )
        })}
      </div>
    )
  }

  const renderAllFields = () => {
    if (!extractedFields) return null
    const entries = Object.entries(extractedFields).filter(([, v]) => v != null)
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground py-4 text-center">Nenhum campo extraído</p>
    }
    return (
      <div className="grid grid-cols-2 gap-3">
        {entries.map(([key, value]) => {
          const isFullWidth = LOCATION_FIELDS.has(key) || key === 'observacoes'
          return (
            <div key={key} className={isFullWidth ? 'col-span-2' : ''}>
              <EditableRow
                fieldKey={key}
                value={value}
                onChange={(v) => updateField(key, v)}
              />
            </div>
          )
        })}
      </div>
    )
  }

  const COMMON_FIELDS = new Set(['observacoes'])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Descreve o que o cliente pretende...&#10;Ex: 'T3 em Lisboa até 350k com garagem'"
          className="text-xs"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleExtract}
          disabled={!text.trim() || isExtracting}
          className="text-xs h-8"
        >
          {isExtracting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="mr-1.5 h-3.5 w-3.5" />
          )}
          Extrair
        </Button>

        <Button
          size="sm"
          variant={isRecording ? 'destructive' : 'outline'}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
          className="text-xs h-8"
        >
          {isTranscribing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : isRecording ? (
            <>
              <MicOff className="mr-1.5 h-3.5 w-3.5" />
              Parar
            </>
          ) : (
            <>
              <Mic className="mr-1.5 h-3.5 w-3.5" />
              Gravar
            </>
          )}
        </Button>

        {isRecording && (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            A gravar...
          </span>
        )}
      </div>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Dados Extraídos</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {extractedFields && isCompraEVenda ? (
              <Tabs defaultValue="tab-compra">
                <TabsList className="bg-muted/50 rounded-full p-1 h-auto gap-0 mb-4 w-full">
                  <TabsTrigger value="tab-compra" className="rounded-full flex-1 px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    O que procura
                  </TabsTrigger>
                  <TabsTrigger value="tab-venda" className="rounded-full flex-1 px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    O que vende
                  </TabsTrigger>
                  <TabsTrigger value="tab-outros" className="rounded-full flex-1 px-3 py-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Outros
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="tab-compra" className="mt-0">
                  {renderFields(COMPRA_FIELDS)}
                </TabsContent>
                <TabsContent value="tab-venda" className="mt-0">
                  {renderFields(VENDA_FIELDS)}
                </TabsContent>
                <TabsContent value="tab-outros" className="mt-0">
                  {renderFields(COMMON_FIELDS)}
                </TabsContent>
              </Tabs>
            ) : extractedFields ? (
              renderAllFields()
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApply}>
              <Check className="mr-2 h-4 w-4" />
              Aplicar Dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
