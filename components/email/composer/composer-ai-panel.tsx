'use client'

import { useCallback, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Mic, Square, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { FullMessage } from '@/hooks/use-email-inbox'

interface Props {
  editor: Editor | null
  replyTo?: FullMessage | null
  forwardMessage?: FullMessage | null
  currentSubject: string
  onSubjectChange: (subject: string) => void
}

const CLOSING_PATTERNS: RegExp[] = [
  /Com os melhores cumprimentos[,.]?\s*$/i,
  /Os meus cumprimentos[,.]?\s*$/i,
  /Atenciosamente[,.]?\s*$/i,
  /Melhores cumprimentos[,.]?\s*$/i,
  /Cumprimentos[,.]?\s*$/i,
]

function stripTrailingClosing(text: string): string {
  let cleaned = text.trim()
  for (let i = 0; i < 2; i++) {
    const match = CLOSING_PATTERNS.some((p) => p.test(cleaned))
    if (!match) break
    cleaned = cleaned
      .replace(
        /\s*\n?\s*(Com os melhores cumprimentos|Os meus cumprimentos|Atenciosamente|Melhores cumprimentos|Cumprimentos)[,.]?\s*$/i,
        ''
      )
      .trim()
  }
  return cleaned
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function textToHtml(text: string): string {
  const cleaned = stripTrailingClosing(text)
  if (!cleaned) return '<p></p>'
  return cleaned
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

export function ComposerAIPanel({
  editor,
  replyTo,
  forwardMessage,
  currentSubject,
  onSubjectChange,
}: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isPolishing, setIsPolishing] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const sourceMessage = replyTo || forwardMessage

  const insertTranscriptionIntoBody = useCallback(
    (text: string) => {
      if (!editor || !text.trim()) return
      if (editor.isEmpty) {
        editor.commands.setContent(`<p>${escapeHtml(text.trim())}</p>`, true)
      } else {
        const safe = escapeHtml(text.trim())
        // Insert as a fresh paragraph at the end to avoid running on from existing content.
        editor.chain().focus('end').insertContent(`<p>${safe}</p>`).run()
      }
      editor.commands.focus('end')
    },
    [editor]
  )

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (!res.ok) throw new Error('Erro ao transcrever')
          const { text } = await res.json()
          if (text && text.trim()) {
            insertTranscriptionIntoBody(text)
          } else {
            toast.info('Nada foi transcrito.')
          }
        } catch {
          toast.error('Erro ao transcrever áudio')
        } finally {
          setIsTranscribing(false)
        }
      }
      recorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
  }, [insertTranscriptionIntoBody])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const polishDraft = useCallback(async () => {
    if (!editor) return
    const currentText = editor.getText().trim()
    if (!currentText && !sourceMessage) {
      toast.info('Escreva ou dite algo primeiro.')
      return
    }
    setIsPolishing(true)
    try {
      const payload: Record<string, unknown> = {
        tone: 'professional',
      }
      if (currentText) {
        payload.existing_draft = currentText
      }
      if (sourceMessage) {
        payload.subject = sourceMessage.subject
        payload.from_name = sourceMessage.from[0]?.name
        payload.from_email = sourceMessage.from[0]?.address
        payload.body_text = sourceMessage.text
        payload.body_html = sourceMessage.html
      }
      const res = await fetch('/api/email/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Erro ao polir o rascunho')
      }
      const data = await res.json()
      const body = (data.body ?? data.draft ?? '') as string
      const suggestedSubject = (data.subject as string) || ''
      if (!body) throw new Error('A IA não devolveu conteúdo.')

      editor.commands.setContent(textToHtml(body), true)
      editor.commands.focus('end')

      if (suggestedSubject && !currentSubject.trim()) {
        onSubjectChange(suggestedSubject)
      }
      toast.success('Texto melhorado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao polir o rascunho')
    } finally {
      setIsPolishing(false)
    }
  }, [editor, sourceMessage, currentSubject, onSubjectChange])

  const micDisabled = isPolishing || isTranscribing
  const sparkleDisabled = isPolishing || isRecording || isTranscribing || !editor

  return (
    <>
      {/* Microphone — records, transcribes, inserts into body */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 w-7 p-0',
              isRecording && 'animate-pulse'
            )}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={micDisabled}
            aria-label={isRecording ? 'Parar gravação' : 'Ditar por voz'}
          >
            {isTranscribing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isRecording ? (
              <Square className="h-3 w-3 fill-current" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {isRecording ? 'Parar e transcrever' : 'Ditar por voz'}
        </TooltipContent>
      </Tooltip>

      {/* Sparkle — polishes the existing body with AI and suggests a subject */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={polishDraft}
            disabled={sparkleDisabled}
            aria-label="Melhorar com IA"
          >
            {isPolishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Melhorar com IA{sourceMessage ? ' (com contexto do email)' : ''}
        </TooltipContent>
      </Tooltip>
    </>
  )
}
