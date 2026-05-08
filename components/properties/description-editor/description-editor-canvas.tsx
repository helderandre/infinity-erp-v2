'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/kibo-ui/spinner'
import { toast } from 'sonner'
import { Check, Languages, MessageSquare, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  DESCRIPTION_LANGUAGES,
  LANG_LABELS,
  type DescriptionLanguage,
} from '@/lib/properties/description-prompt'
import { useDescriptionStream } from './use-description-stream'
import { DescriptionChatPane } from './description-chat-pane'
import { DescriptionDocumentPane } from './description-document-pane'
import {
  DescriptionFinalizeCard,
  type FinalizeStatus,
} from './description-finalize-card'

interface DescriptionEditorCanvasProps {
  propertyId: string
  /** Quando definido, mostra o botão "X" no header. Em modo embebido (vista
   *  por defeito da tab Descrição) deixa-se vazio para o canvas ficar sempre
   *  montado sem botão de fechar. */
  onClose?: () => void
  /** Callback após o /finalize correr (translation done). Em modo embebido,
   *  usa-o para refrescar o estado externo (ex.: refetch da property). */
  onAfterFinalize?: () => void | Promise<void>
}

export function DescriptionEditorCanvas({
  propertyId,
  onClose,
  onAfterFinalize,
}: DescriptionEditorCanvasProps) {
  const isMobile = useIsMobile()
  const [language, setLanguage] = useState<DescriptionLanguage>('pt')
  const [mobileTab, setMobileTab] = useState<'chat' | 'doc'>('doc')
  const [selectionText, setSelectionText] = useState<string | null>(null)
  const [finalizeStatus, setFinalizeStatus] = useState<FinalizeStatus>('idle')
  const [finalizeTranslated, setFinalizeTranslated] = useState<string[]>([])
  const [finalizeSkipped, setFinalizeSkipped] = useState<
    Array<{ lang: string; reason: string }>
  >([])
  const [finalizeError, setFinalizeError] = useState<string | null>(null)

  const stream = useDescriptionStream({ propertyId, language })

  // Quando trocas de idioma, limpa selecção (refere-se ao doc anterior)
  useEffect(() => {
    setSelectionText(null)
  }, [language])

  const handleFinalize = useCallback(() => {
    if (finalizeStatus === 'loading') return
    setFinalizeStatus('loading')
    setFinalizeTranslated([])
    setFinalizeSkipped([])
    setFinalizeError(null)

    // Fire-and-forget: a tradução corre em background e o cartão flutuante
    // mostra o progresso. O utilizador pode continuar a interagir com a app.
    ;(async () => {
      try {
        const result = await stream.finalize()
        if (result) {
          setFinalizeTranslated(result.translated || [])
          setFinalizeSkipped(result.skipped || [])
          setFinalizeStatus('success')
          if (onAfterFinalize) {
            try {
              await onAfterFinalize()
            } catch {
              // refetch errors don't change the success state
            }
          }
        } else {
          setFinalizeStatus('error')
          setFinalizeError('Não foi possível concluir a tradução.')
        }
      } catch (err) {
        setFinalizeStatus('error')
        setFinalizeError(err instanceof Error ? err.message : 'Erro inesperado.')
      }
    })()

    // Em modo Sheet (com onClose), fecha imediatamente; o cartão fica visível
    // por cima do resto da app a comunicar o progresso.
    if (onClose) onClose()
  }, [finalizeStatus, stream, onAfterFinalize, onClose])

  const dismissFinalizeCard = useCallback(() => {
    setFinalizeStatus('idle')
    setFinalizeTranslated([])
    setFinalizeSkipped([])
    setFinalizeError(null)
  }, [])

  const handleAskAboutSelection = useCallback((selected: string) => {
    setSelectionText(selected)
    if (isMobile) setMobileTab('chat')
  }, [isMobile])

  const documentPane = useMemo(
    () => (
      <DescriptionDocumentPane
        document={stream.document}
        locked={stream.documentLocked}
        onChange={stream.applyManualEdit}
        onAskAboutSelection={handleAskAboutSelection}
      />
    ),
    [stream.document, stream.documentLocked, stream.applyManualEdit, handleAskAboutSelection]
  )

  const chatPane = (
    <DescriptionChatPane
      messages={stream.messages}
      streamingAssistant={stream.streamingAssistant}
      sending={stream.sending}
      loading={stream.loading}
      selectionText={selectionText}
      onClearSelection={() => setSelectionText(null)}
      onSend={stream.sendMessage}
      onRevertTo={stream.revertTo}
      onReset={stream.reset}
    />
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header: language tabs + close ── */}
      <div className="shrink-0 flex items-center justify-between gap-2 pb-3 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Languages className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-muted/50 border border-border/30">
            {DESCRIPTION_LANGUAGES.map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all uppercase',
                  language === l
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title={LANG_LABELS[l]}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={handleFinalize}
            disabled={finalizeStatus === 'loading'}
            className="h-8 px-3 text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full"
          >
            {finalizeStatus === 'loading' ? (
              <>
                <Spinner className="h-3 w-3" />
                Em tradução…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                {onClose ? 'Concluir' : 'Traduzir agora'}
              </>
            )}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
              title="Fechar sem traduzir"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Body: split desktop, tabs mobile ── */}
      {isMobile ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 flex items-center justify-center pt-2 pb-2">
            <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30 w-fit">
              <button
                onClick={() => setMobileTab('doc')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all',
                  mobileTab === 'doc'
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Descrição
              </button>
              <button
                onClick={() => setMobileTab('chat')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all',
                  mobileTab === 'chat'
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Conversa
                {stream.messages.length > 0 && (
                  <span className="text-[9px] tabular-nums opacity-70">
                    {stream.messages.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {mobileTab === 'doc' ? documentPane : chatPane}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(280px,40%)_1fr] gap-4 pt-3">
          <div className="min-h-0 rounded-xl border bg-card overflow-hidden">
            {chatPane}
          </div>
          <div className="min-h-0 rounded-xl border bg-card overflow-hidden">
            {documentPane}
          </div>
        </div>
      )}

      {/* Floating progress card — fica visível mesmo se o canvas for
       *   desmontado (em modo Sheet). Por isso é portal'd em document.body. */}
      <DescriptionFinalizeCard
        status={finalizeStatus}
        translated={finalizeTranslated}
        skipped={finalizeSkipped}
        errorMessage={finalizeError}
        onDismiss={dismissFinalizeCard}
      />
    </div>
  )
}
