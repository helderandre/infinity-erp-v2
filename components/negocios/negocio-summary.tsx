'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Sparkles, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface NegocioSummaryProps {
  negocioId: string
}

export function NegocioSummary({ negocioId }: NegocioSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/summary`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar resumo')
      }
      const data = await res.json()
      setSummary(data.summary)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar resumo')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!summary) return
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    toast.success('Resumo copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        Gerar Resumo
      </Button>

      {summary && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="prose prose-sm max-w-none">
              {summary.split('\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
