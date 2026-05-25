'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Card colapsado por defeito com pretty-print do payload jsonb cru recebido
 * do meta-api. Útil para debug — mostra a verdade subjacente quando as
 * colunas espelho não são suficientes.
 */
export function RawPayloadCard({
  payload,
  title = 'Payload bruto',
}: {
  payload: unknown
  title?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(payload, null, 2)

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // silent
    }
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsOpen((v) => !v)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {title}
          </span>
          {isOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                void copyToClipboard()
              }}
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  Copiar
                </>
              )}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent>
          <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-[11px] leading-relaxed">
            {json}
          </pre>
        </CardContent>
      )}
    </Card>
  )
}
