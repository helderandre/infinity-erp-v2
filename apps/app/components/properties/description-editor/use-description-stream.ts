'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export type DescriptionLanguage = 'pt' | 'en' | 'fr' | 'es'

export interface DescriptionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  document_snapshot: string | null
  selection_text: string | null
  created_at: string
}

interface SendMessageArgs {
  content: string
  selectionText?: string | null
}

interface UseDescriptionStreamArgs {
  propertyId: string
  language: DescriptionLanguage
}

/**
 * Gere o estado do canvas para um (propertyId, language):
 *  - Carrega thread + mensagens + documento via GET inicial.
 *  - Faz stream SSE quando o utilizador envia uma mensagem.
 *  - Mantém `streamingAssistant` (texto a aparecer token a token) separado
 *    de `messages` (já persistidas). Quando o stream acaba, a mensagem
 *    final entra em `messages` e `streamingAssistant` limpa.
 *  - `documentLocked` sinaliza ao document-pane para suspender edição
 *    enquanto o servidor está a aplicar tools.
 *  - `revertTo(message)` aplica o snapshot dessa mensagem ao documento
 *    actual (apenas client-side; o utilizador depois confirma com auto-save).
 *  - `applyManualEdit(text)` faz auto-save debounced quando o utilizador
 *    edita à mão directamente no documento.
 *  - `finalize()` chama o endpoint de auto-translate (devolve resultado).
 *  - `reset()` apaga as mensagens da thread (mantém documento).
 */
export function useDescriptionStream({ propertyId, language }: UseDescriptionStreamArgs) {
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<DescriptionMessage[]>([])
  const [document, setDocument] = useState('')
  const [streamingAssistant, setStreamingAssistant] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [documentLocked, setDocumentLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Carregar thread inicial ───
  const fetchThread = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/description-thread?lang=${language}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMessages((data.messages || []).filter((m: DescriptionMessage) => !String(m.id).startsWith('seed-')))
      setDocument(data.current_document || '')

      // Se vier uma seed message (thread vazia + documento legado), monta-a
      // como mensagem visível mas não persistida.
      const seed = (data.messages || []).find((m: DescriptionMessage) =>
        String(m.id).startsWith('seed-')
      )
      if (seed) {
        setMessages([seed])
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro a carregar conversa'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [propertyId, language])

  useEffect(() => {
    fetchThread()
    return () => {
      abortRef.current?.abort()
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [fetchThread])

  // ─── Enviar mensagem (stream SSE) ───
  const sendMessage = useCallback(
    async ({ content, selectionText }: SendMessageArgs) => {
      if (sending) return
      setSending(true)
      setStreamingAssistant('')
      setError(null)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(
          `/api/properties/${propertyId}/description-thread/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lang: language,
              content,
              selection_text: selectionText || null,
            }),
            signal: controller.signal,
          }
        )
        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => '')
          throw new Error(errText || `HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let assistantText = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6)
            if (payload === '[DONE]') continue
            let evt: Record<string, unknown>
            try {
              evt = JSON.parse(payload)
            } catch {
              continue
            }
            switch (evt.type) {
              case 'user_message':
                setMessages((prev) => [...prev, evt.message as DescriptionMessage])
                break
              case 'assistant_delta':
                assistantText += String(evt.delta || '')
                setStreamingAssistant(assistantText)
                break
              case 'tool_call':
                setDocumentLocked(true)
                break
              case 'document_updated':
                setDocument(String(evt.document || ''))
                setDocumentLocked(false)
                break
              case 'assistant_message': {
                const msg = evt.message as DescriptionMessage
                setMessages((prev) => [...prev, msg])
                setStreamingAssistant('')
                break
              }
              case 'error':
                toast.error(String(evt.error || 'Erro no servidor'))
                break
            }
          }
        }
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return
        const msg = e instanceof Error ? e.message : 'Erro a enviar mensagem'
        setError(msg)
        toast.error(msg)
      } finally {
        setSending(false)
        setStreamingAssistant('')
        setDocumentLocked(false)
        abortRef.current = null
      }
    },
    [propertyId, language, sending]
  )

  // ─── Edição manual no documento (auto-save debounced) ───
  const applyManualEdit = useCallback(
    (text: string) => {
      setDocument(text)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/properties/${propertyId}/description-thread/save`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lang: language, text }),
            }
          )
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || `HTTP ${res.status}`)
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Erro a guardar')
        }
      }, 1000)
    },
    [propertyId, language]
  )

  // ─── Reverter para snapshot de uma mensagem ───
  const revertTo = useCallback(
    (msg: DescriptionMessage) => {
      if (!msg.document_snapshot) return
      setDocument(msg.document_snapshot)
      applyManualEdit(msg.document_snapshot)
    },
    [applyManualEdit]
  )

  // ─── Reset (apaga mensagens, mantém documento) ───
  const reset = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/description-thread?lang=${language}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setMessages([])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro a apagar')
    }
  }, [propertyId, language])

  // ─── Finalize (auto-translate PT→EN+FR) ───
  const finalize = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/description-thread/finalize`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { translated: string[]; skipped: Array<{ lang: string; reason: string }> }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro na tradução automática')
      return null
    }
  }, [propertyId])

  return {
    loading,
    messages,
    document,
    streamingAssistant,
    sending,
    documentLocked,
    error,
    sendMessage,
    applyManualEdit,
    revertTo,
    reset,
    finalize,
  }
}
