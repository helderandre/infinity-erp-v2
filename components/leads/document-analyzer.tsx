'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Sparkles, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { DocumentAnalysis } from '@/types/lead'

interface DocumentAnalyzerProps {
  leadId: string
  documentUrl: string | null
  onApply: (fields: Partial<DocumentAnalysis>) => void
}

const fieldLabels: Record<string, string> = {
  tipo_documento: 'Tipo de Documento',
  numero_documento: 'Número',
  full_name: 'Nome Completo',
  nif: 'NIF',
  data_nascimento: 'Data de Nascimento',
  data_validade_documento: 'Data de Validade',
  nacionalidade: 'Nacionalidade',
  pais_emissor: 'País Emissor',
  genero: 'Género',
}

export function DocumentAnalyzer({ leadId, documentUrl, onApply }: DocumentAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<DocumentAnalysis | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const handleAnalyze = async () => {
    if (!documentUrl) {
      toast.error('Nenhum documento de identificação encontrado')
      return
    }

    setIsAnalyzing(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/analyze-document`, {
        method: 'POST',
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro na análise')
      }

      const data = await res.json()
      setResult(data)
      setShowPreview(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao analisar documento')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApply = () => {
    if (!result) return
    // Filtrar campos com valor
    const fields: Partial<DocumentAnalysis> = {}
    for (const [key, value] of Object.entries(result)) {
      if (value !== null && value !== undefined) {
        (fields as Record<string, unknown>)[key] = value
      }
    }
    onApply(fields)
    setShowPreview(false)
    toast.success('Dados aplicados com sucesso')
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleAnalyze}
        disabled={isAnalyzing || !documentUrl}
      >
        {isAnalyzing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        Analisar com IA
      </Button>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados Extraídos do Documento</DialogTitle>
          </DialogHeader>
          {result && (
            <Card>
              <CardContent className="space-y-2 pt-4">
                {Object.entries(result).map(([key, value]) => {
                  if (value === null || value === undefined) return null
                  return (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {fieldLabels[key] || key}
                      </span>
                      <span className="font-medium">{value}</span>
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
    </>
  )
}
