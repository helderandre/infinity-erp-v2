'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Mic, MicOff, FileText, Check } from 'lucide-react'
import { toast } from 'sonner'

interface QuickFillProps {
  negocioId: string
  onApply: (fields: Record<string, unknown>) => void
}

const fieldLabels: Record<string, string> = {
  tipo_imovel: 'Tipo de Imóvel',
  localizacao: 'Localização',
  estado_imovel: 'Estado do Imóvel',
  orcamento: 'Orçamento Mínimo',
  orcamento_max: 'Orçamento Máximo',
  quartos_min: 'Quartos Mínimos',
  area_min_m2: 'Área Mínima',
  preco_venda: 'Preço de Venda',
  renda_max_mensal: 'Renda Máxima',
  renda_pretendida: 'Renda Pretendida',
  motivacao_compra: 'Motivação',
  prazo_compra: 'Prazo',
  observacoes: 'Observações',
}

export function QuickFill({ negocioId, onApply }: QuickFillProps) {
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

  const handleApply = () => {
    if (!extractedFields) return
    onApply(extractedFields)
    setShowPreview(false)
    setText('')
    toast.success('Dados aplicados com sucesso')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Cole aqui um texto descritivo do que o cliente pretende...&#10;&#10;Exemplo: 'Procuro um T3 em Lisboa até 350 mil euros, de preferência com garagem e perto do metro.'"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleExtract}
          disabled={!text.trim() || isExtracting}
        >
          {isExtracting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          Extrair Dados
        </Button>

        <Button
          variant={isRecording ? 'destructive' : 'outline'}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <>
              <MicOff className="mr-2 h-4 w-4" />
              Parar Gravação
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" />
              Gravar Áudio
            </>
          )}
        </Button>

        {isRecording && (
          <span className="flex items-center gap-2 text-sm text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            A gravar...
          </span>
        )}
      </div>

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados Extraídos</DialogTitle>
          </DialogHeader>
          {extractedFields && (
            <Card>
              <CardContent className="space-y-2 pt-4">
                {Object.entries(extractedFields).map(([key, value]) => {
                  if (value === null || value === undefined) return null
                  return (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {fieldLabels[key] || key}
                      </span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
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
