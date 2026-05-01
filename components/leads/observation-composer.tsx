'use client'

import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VoiceInputButton } from '@/components/shared/voice-input-button'
import { Phone, Mail, MessageCircle, StickyNote, MapPin, CalendarDays, Loader2, Pin, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ACTIVITY_TYPE_LABELS } from '@/lib/constants-leads-crm'
import type { ActivityType } from '@/types/leads-crm'

const TYPE_OPTIONS: { value: ActivityType; label: string; icon: React.ElementType }[] = [
  { value: 'note', label: 'Observação', icon: StickyNote },
  { value: 'call', label: 'Chamada', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'visit', label: 'Visita', icon: MapPin },
]

const TYPE_ICON: Record<string, React.ElementType> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  visit: MapPin,
}

interface ObservationComposerProps {
  /** Lead/contact id — POSTs to /api/leads/[id]/activities */
  contactId: string
  /** When set, the observation is scoped to this negocio (still surfaces on the contact timeline) */
  negocioId?: string | null
  /** Negocio reference label to show in the composer pill ("Negócio: VND-2026-XX") */
  negocioLabel?: string | null
  onSaved?: () => void
  placeholder?: string
}

export function ObservationComposer({
  contactId,
  negocioId,
  negocioLabel,
  onSaved,
  placeholder = 'O que aconteceu? (chamada, encontro, observação…)',
}: ObservationComposerProps) {
  const [text, setText] = useState('')
  const [type, setType] = useState<ActivityType>('note')
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [time, setTime] = useState<string>(format(new Date(), 'HH:mm'))
  const [pinned, setPinned] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Anchor of where dictation began in `text`. The live (interim) transcript
  // replaces everything from this anchor to the end. On final, Whisper's
  // result also lands at this anchor for the same reason.
  const dictationAnchorRef = useRef<number | null>(null)

  function reset() {
    setText('')
    setType('note')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setTime(format(new Date(), 'HH:mm'))
    setPinned(false)
  }

  async function handleSave() {
    if (!text.trim()) {
      toast.error('Escreva o conteúdo da observação')
      return
    }

    setSubmitting(true)
    try {
      // Build occurred_at as ISO with the user's local timezone offset
      const occurred = new Date(`${date}T${time || '00:00'}`)
      const body: Record<string, unknown> = {
        activity_type: type,
        description: text.trim(),
        occurred_at: occurred.toISOString(),
        is_pinned: pinned,
      }
      if (negocioId) body.negocio_id = negocioId

      const res = await fetch(`/api/leads/${contactId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao guardar')
      }

      reset()
      onSaved?.()
      toast.success('Observação guardada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar')
    } finally {
      setSubmitting(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSave()
    }
  }

  const SelectedTypeIcon = TYPE_ICON[type] ?? StickyNote

  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-3 space-y-2.5">
      {/* Top row: textarea with voice button overlay */}
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={3}
          className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:outline-none pr-10 text-sm"
        />
        <div className="absolute top-1.5 right-1.5">
          <VoiceInputButton
            mode="append"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onInterimText={(live) => {
              // Lazily set the anchor on the first interim event of this session
              setText((prev) => {
                if (dictationAnchorRef.current == null) {
                  dictationAnchorRef.current = prev.length
                }
                const head = prev.slice(0, dictationAnchorRef.current)
                const sep = head.length > 0 && !/\s$/.test(head) ? ' ' : ''
                return head + sep + live
              })
            }}
            onTranscribe={(finalText) => {
              setText((prev) => {
                const anchor = dictationAnchorRef.current
                if (anchor == null) {
                  // No interim ever fired (browser without SpeechRecognition).
                  // Append normally.
                  return prev.trim() ? `${prev.trim()} ${finalText}` : finalText
                }
                const head = prev.slice(0, anchor)
                const sep = head.length > 0 && !/\s$/.test(head) ? ' ' : ''
                return head + sep + finalText
              })
              dictationAnchorRef.current = null
            }}
          />
        </div>
      </div>

      {/* Bottom row: pills (type, date, pin) + save */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Type picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border border-border/40 bg-background/40 hover:bg-background/70 transition-colors"
            >
              <SelectedTypeIcon className="h-3 w-3" />
              {ACTIVITY_TYPE_LABELS[type] ?? type}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-xl">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className="text-xs gap-2"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date+time picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border border-border/40 bg-background/40 hover:bg-background/70 transition-colors"
              title="Quando aconteceu"
            >
              <CalendarDays className="h-3 w-3" />
              {format(new Date(`${date}T${time || '00:00'}`), 'd MMM, HH:mm')}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 rounded-xl space-y-2" align="start">
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Data</p>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Hora</p>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Pin toggle */}
        <button
          type="button"
          onClick={() => setPinned(!pinned)}
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-colors',
            pinned
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'border-border/40 bg-background/40 text-muted-foreground hover:bg-background/70'
          )}
          title="Fixar no topo do histórico"
        >
          <Pin className={cn('h-3 w-3', pinned && 'fill-current')} />
          {pinned ? 'Fixado' : 'Fixar'}
        </button>

        {negocioLabel && (
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400">
            {negocioLabel}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] text-muted-foreground/70">
            ⌘ + Enter para guardar
          </span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!text.trim() || submitting}
            className="rounded-full h-7 px-3 text-xs"
          >
            {submitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}
