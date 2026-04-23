'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { calendarEventSchema, type CalendarEventFormData } from '@/lib/validations/calendar'
import {
  CALENDAR_CATEGORY_OPTIONS,
  CALENDAR_RECURRENCE_OPTIONS,
  CALENDAR_VISIBILITY_OPTIONS,
  CALENDAR_VISIBILITY_MODE_OPTIONS,
  CALENDAR_ROLE_OPTIONS,
  CALENDAR_ITEM_TYPE_OPTIONS,
} from '@/lib/constants'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CalendarDays,
  Clock,
  MapPin,
  Image as ImageIcon,
  X,
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  Link2,
  Video,
  Plus,
  Trash2,
  Bell,
  ClipboardCheck,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useImageCompress } from '@/hooks/use-image-compress'
import { useIsMobile } from '@/hooks/use-mobile'
import { CalendarRichEditor } from './calendar-rich-editor'

interface CalendarEventFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CalendarEventFormData) => Promise<void>
  initialData?: Partial<CalendarEventFormData>
  users?: { id: string; name: string }[]
}

const REMINDER_PRESETS = [
  { minutes: 5, label: '5 min' },
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hora' },
  { minutes: 120, label: '2 horas' },
  { minutes: 1440, label: '1 dia' },
]
const REMINDER_PRESET_MINUTES = REMINDER_PRESETS.map((p) => p.minutes)

export function CalendarEventForm({
  open,
  onClose,
  onSubmit,
  initialData,
  users,
}: CalendarEventFormProps) {
  const isMobile = useIsMobile()
  const [showAdvancedVisibility, setShowAdvancedVisibility] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isImproving, setIsImproving] = useState(false)
  const [mediaRecorderRef, setMediaRecorderRef] = useState<MediaRecorder | null>(null)
  const [activeTab, setActiveTab] = useState('detalhes')
  const [aiFillText, setAiFillText] = useState('')
  const [isAiFilling, setIsAiFilling] = useState(false)
  const [isAiRecording, setIsAiRecording] = useState(false)
  const [isAiTranscribing, setIsAiTranscribing] = useState(false)
  const [aiRecorderRef, setAiRecorderRef] = useState<MediaRecorder | null>(null)
  const aiRecognitionRef = useRef<any>(null)
  const aiInputRef = useRef<HTMLTextAreaElement>(null)
  const { compressImage } = useImageCompress()

  const form = useForm<CalendarEventFormData>({
    resolver: zodResolver(calendarEventSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      category: 'meeting',
      item_type: 'event',
      start_date: '',
      end_date: '',
      all_day: false,
      is_recurring: false,
      recurrence_rule: null,
      user_id: null,
      visibility: 'all',
      visibility_mode: 'all',
      visibility_user_ids: [],
      visibility_role_names: [],
      color: null,
      cover_image_url: null,
      location: null,
      requires_rsvp: false,
      priority: 4,
      ...initialData,
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = form

  const category = watch('category')
  const itemType = watch('item_type')
  const allDay = watch('all_day')
  const isRecurring = watch('is_recurring')
  const startDate = watch('start_date')
  const endDate = watch('end_date')
  const visibilityMode = watch('visibility_mode')
  const visibilityUserIds = watch('visibility_user_ids') ?? []
  const visibilityRoleNames = watch('visibility_role_names') ?? []
  const requiresRsvp = watch('requires_rsvp')
  const coverImageUrl = watch('cover_image_url')
  const description = watch('description')

  useEffect(() => {
    if (open) {
      setActiveTab('detalhes')
      const hasAdvanced = initialData?.visibility_mode && initialData.visibility_mode !== 'all'
      setShowAdvancedVisibility(!!hasAdvanced)
      reset({
        title: '', description: '', category: 'meeting', item_type: 'event',
        start_date: '', end_date: '', all_day: false, is_recurring: false,
        recurrence_rule: null, user_id: null, visibility: 'all',
        visibility_mode: 'all', visibility_user_ids: [], visibility_role_names: [],
        color: null, cover_image_url: null, location: null, requires_rsvp: false,
        priority: 4,
        ...initialData,
      })
    }
  }, [open, initialData, reset])

  useEffect(() => {
    if (category === 'birthday') {
      setValue('all_day', true)
      setValue('is_recurring', true)
      setValue('recurrence_rule', 'yearly')
      setValue('item_type', 'event')
    }
  }, [category, setValue])
  useEffect(() => {
    if (category === 'vacation') {
      setValue('all_day', true)
      setValue('item_type', 'event')
    }
  }, [category, setValue])
  useEffect(() => {
    if (itemType === 'task') {
      setValue('requires_rsvp', false)
      setValue('end_date', null)
    }
  }, [itemType, setValue])


  // Stop any active live speech recognition when the sheet closes.
  useEffect(() => {
    if (!open && aiRecognitionRef.current) {
      try { aiRecognitionRef.current.stop() } catch {}
      aiRecognitionRef.current = null
      setIsAiRecording(false)
    }
  }, [open])

  // Auto-grow the AI Quick Fill textarea as text (typed or transcribed) expands.
  useEffect(() => {
    const el = aiInputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [aiFillText])

  const handleFormSubmit = async (data: CalendarEventFormData) => {
    if (data.end_date && data.start_date && new Date(data.end_date) <= new Date(data.start_date)) {
      toast.error('A data/hora de fim deve ser posterior à data/hora de início.')
      setActiveTab('detalhes')
      return
    }
    try {
      await onSubmit(data)
      onClose()
      toast.success(itemType === 'task' ? 'Tarefa guardada com sucesso' : 'Evento guardado com sucesso')
    } catch {
      toast.error('Erro ao guardar. Tente novamente.')
    }
  }

  const parseDateValue = (value: string | null | undefined): Date | undefined => {
    if (!value) return undefined
    try { return parseISO(value) } catch { return undefined }
  }

  const toLocalISO = (dateStr: string, timeStr: string) => {
    const d = new Date(`${dateStr}T${timeStr}`)
    const off = -d.getTimezoneOffset()
    const sign = off >= 0 ? '+' : '-'
    const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
    const mm = String(Math.abs(off) % 60).padStart(2, '0')
    return `${dateStr}T${timeStr}${sign}${hh}:${mm}`
  }

  const toggleVisibilityUser = (userId: string) => {
    const c = visibilityUserIds ?? []
    setValue(
      'visibility_user_ids',
      c.includes(userId) ? c.filter((id) => id !== userId) : [...c, userId],
    )
  }
  const toggleVisibilityRole = (role: string) => {
    const c = visibilityRoleNames ?? []
    setValue(
      'visibility_role_names',
      c.includes(role) ? c.filter((r) => r !== role) : [...c, role],
    )
  }

  const startVoiceRecording = async () => {
    if (isRecording && mediaRecorderRef) {
      mediaRecorderRef.stop()
      setIsRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setIsTranscribing(true)
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const fd = new FormData()
          fd.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = await res.json()
            const current = description ?? ''
            const append = current ? `${current}<p>${text}</p>` : `<p>${text}</p>`
            setValue('description', append)
            toast.success('Transcrição adicionada')
          } else {
            toast.error('Erro na transcrição')
          }
        } catch {
          toast.error('Erro na transcrição')
        } finally {
          setIsTranscribing(false)
        }
      }
      recorder.start()
      setMediaRecorderRef(recorder)
      setIsRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
  }

  const improveWithAI = async () => {
    if (!description) return
    setIsImproving(true)
    try {
      const res = await fetch('/api/calendar/improve-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: description,
          title: watch('title'),
          start_date: startDate,
          end_date: endDate,
          location: watch('location'),
          category,
        }),
      })
      if (res.ok) {
        const { text } = await res.json()
        setValue('description', text)
        toast.success('Descrição melhorada com IA')
      } else {
        toast.error('Erro ao melhorar texto')
      }
    } catch {
      toast.error('Erro ao melhorar texto')
    } finally {
      setIsImproving(false)
    }
  }

  const mergeAiData = (data: Record<string, unknown>) => {
    const fieldMap: Record<string, string> = {
      title: 'title', description: 'description', category: 'category',
      item_type: 'item_type', start_date: 'start_date', end_date: 'end_date',
      all_day: 'all_day', location: 'location', livestream_url: 'livestream_url',
      registration_url: 'registration_url', requires_rsvp: 'requires_rsvp',
      reminders: 'reminders', user_id: 'user_id', visibility: 'visibility',
      visibility_mode: 'visibility_mode',
      visibility_role_names: 'visibility_role_names',
      visibility_user_ids: 'visibility_user_ids',
    }
    for (const [aiKey, formKey] of Object.entries(fieldMap)) {
      if (data[aiKey] !== undefined && data[aiKey] !== null) {
        setValue(formKey as any, data[aiKey] as any, { shouldValidate: true })
      }
    }
    // If the AI returned advanced visibility filters, surface the advanced UI.
    if (data.visibility_mode && data.visibility_mode !== 'all') {
      setShowAdvancedVisibility(true)
    }
    // If the AI assigned someone but didn't specify visibility, default to private.
    if (
      data.user_id &&
      data.visibility === undefined &&
      data.visibility_mode === undefined &&
      watch('visibility') === 'all' &&
      (watch('visibility_mode') ?? 'all') === 'all'
    ) {
      setValue('visibility', 'private')
    }
  }

  const handleAiFill = async (text: string) => {
    if (!text.trim()) return
    setIsAiFilling(true)
    try {
      const res = await fetch('/api/calendar/fill-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          users: users ?? [],
          roles: CALENDAR_ROLE_OPTIONS.map((r) => r.value),
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        mergeAiData(data)
        setAiFillText('')
        toast.success('Dados preenchidos com IA')
      } else {
        toast.error('Erro ao interpretar texto')
      }
    } catch {
      toast.error('Erro ao interpretar texto')
    } finally {
      setIsAiFilling(false)
    }
  }

  const startAiVoiceRecording = async () => {
    // Stop an active session.
    if (isAiRecording) {
      if (aiRecognitionRef.current) {
        aiRecognitionRef.current.stop()
      } else if (aiRecorderRef) {
        aiRecorderRef.stop()
      }
      return
    }

    // Prefer the browser's live SpeechRecognition — shows text as user speaks.
    const SR =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null

    if (SR) {
      try {
        const recognition = new SR()
        recognition.lang = 'pt-PT'
        recognition.continuous = true
        recognition.interimResults = true

        let finalText = ''
        setAiFillText('')

        recognition.onresult = (e: any) => {
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript
            if (e.results[i].isFinal) {
              finalText += transcript
            } else {
              interim += transcript
            }
          }
          setAiFillText((finalText + interim).trim())
        }
        recognition.onerror = (e: any) => {
          if (e.error && e.error !== 'aborted' && e.error !== 'no-speech') {
            toast.error('Erro na transcrição de voz')
          }
        }
        recognition.onend = async () => {
          aiRecognitionRef.current = null
          setIsAiRecording(false)
          const text = finalText.trim()
          if (text) await handleAiFill(text)
        }

        aiRecognitionRef.current = recognition
        recognition.start()
        setIsAiRecording(true)
        return
      } catch {
        // If SR fails to start (e.g. already started, permissions), fall through to MediaRecorder.
        aiRecognitionRef.current = null
      }
    }

    // Fallback: record audio → upload to Whisper → fill on completion.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setIsAiRecording(false)
        setIsAiTranscribing(true)
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const fd = new FormData()
          fd.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = await res.json()
            setAiFillText(text)
            await handleAiFill(text)
          } else {
            toast.error('Erro na transcrição')
          }
        } catch {
          toast.error('Erro na transcrição')
        } finally {
          setIsAiTranscribing(false)
        }
      }
      recorder.start()
      setAiRecorderRef(recorder)
      setIsAiRecording(true)
    } catch {
      toast.error('Não foi possível aceder ao microfone')
    }
  }

  const isEditing = !!initialData?.title
  const isRsvpCategory = category === 'company_event' || category === 'meeting'

  const headingTitle = isEditing
    ? itemType === 'task' ? 'Editar tarefa' : 'Editar evento'
    : itemType === 'task' ? 'Nova tarefa' : 'Novo evento'

  const tabTriggerClass =
    'rounded-full text-xs h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-colors'

  const formatReminderMin = (m: number) => {
    if (m < 60) return `${m} min`
    if (m === 60) return '1 hora'
    if (m < 1440) return `${Math.round(m / 60)}h`
    if (m === 1440) return '1 dia'
    return `${Math.round(m / 1440)} dia(s)`
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <form
          onSubmit={handleSubmit(handleFormSubmit as any)}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Header */}
          <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
            <SheetHeader className="p-0 gap-0">
              <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
                {headingTitle}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Preencha os detalhes do {itemType === 'task' ? 'tarefa' : 'evento'}.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-2.5">
              {/* Item type segmented control */}
              <div className="flex w-fit p-0.5 rounded-full bg-muted/60 border border-border/30">
                {CALENDAR_ITEM_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'px-4 py-1 rounded-full text-xs font-medium transition-all',
                      itemType === opt.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setValue('item_type', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* AI Quick Fill */}
              <div className="flex items-end gap-0.5 rounded-3xl border border-border/40 bg-background/40 pl-3 pr-0.5 py-0.5 backdrop-blur-sm transition-[border-radius]">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0 self-center" />
                <textarea
                  ref={aiInputRef}
                  rows={1}
                  placeholder={isAiFilling ? 'A processar...' : 'Descreva por texto ou voz...'}
                  className="flex-1 min-h-7 max-h-[180px] resize-none border-0 bg-transparent text-xs focus-visible:outline-none shadow-none px-2 py-1.5 leading-relaxed overflow-y-auto placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  value={aiFillText}
                  disabled={isAiFilling || isAiTranscribing}
                  onChange={(e) => setAiFillText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAiFill(aiFillText)
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7 rounded-full shrink-0 self-center',
                    isAiRecording && 'text-red-500',
                  )}
                  disabled={isAiFilling || isAiTranscribing}
                  onClick={startAiVoiceRecording}
                >
                  {isAiTranscribing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isAiRecording ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full shrink-0 self-center"
                  disabled={isAiFilling || !aiFillText.trim()}
                  onClick={() => handleAiFill(aiFillText)}
                >
                  {isAiFilling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="shrink-0 px-6">
              <TabsList className="grid w-full grid-cols-3 h-9 p-0.5 rounded-full bg-muted/50 border border-border/30">
                <TabsTrigger value="detalhes" className={tabTriggerClass}>
                  Detalhes
                </TabsTrigger>
                <TabsTrigger value="conteudo" className={tabTriggerClass}>
                  Conteúdo
                </TabsTrigger>
                <TabsTrigger value="opcoes" className={tabTriggerClass}>
                  Extras
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-5 pb-20">
              {/* ================= DETALHES ================= */}
              <TabsContent value="detalhes" className="m-0 space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs font-medium text-muted-foreground">
                    Título
                  </Label>
                  <Input
                    id="title"
                    placeholder={
                      itemType === 'task'
                        ? 'Ex: Enviar contrato'
                        : 'Ex: Reunião de equipa'
                    }
                    className="rounded-xl"
                    {...register('title')}
                  />
                  {errors.title && (
                    <p className="text-xs text-destructive">{errors.title.message}</p>
                  )}
                </div>

                {itemType === 'event' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
                    <Select value={category} onValueChange={(v) => setValue('category', v as any)}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {CALENDAR_CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Prioridade</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { value: 1, label: 'Urgente', cls: 'data-[active=true]:bg-red-500/90 data-[active=true]:text-white data-[active=true]:border-red-500/70' },
                        { value: 2, label: 'Alta',    cls: 'data-[active=true]:bg-orange-500/90 data-[active=true]:text-white data-[active=true]:border-orange-500/70' },
                        { value: 3, label: 'Média',   cls: 'data-[active=true]:bg-blue-500/90 data-[active=true]:text-white data-[active=true]:border-blue-500/70' },
                        { value: 4, label: 'Normal',  cls: 'data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:border-foreground' },
                      ].map((opt) => {
                        const active = (watch('priority') ?? 4) === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            data-active={active}
                            onClick={() => setValue('priority', opt.value)}
                            className={cn(
                              'px-3 py-1 rounded-full text-xs font-medium border border-border/40 bg-background/40 text-muted-foreground transition-colors hover:border-border/70',
                              opt.cls,
                            )}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Date(s) — task has a single Prazo; event has Início + Fim */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {itemType === 'task' ? 'Prazo' : 'Início'}
                  </Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'flex-1 justify-start text-left font-normal rounded-xl',
                            !startDate && 'text-muted-foreground',
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {startDate
                            ? format(parseISO(startDate), 'PPP', { locale: ptBR })
                            : 'Data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseDateValue(startDate)}
                          onSelect={(d) => {
                            if (d) {
                              const time = startDate
                                ? startDate.split('T')[1]?.slice(0, 8) || '09:00:00'
                                : '09:00:00'
                              setValue(
                                'start_date',
                                toLocalISO(format(d, 'yyyy-MM-dd'), time),
                                { shouldValidate: true },
                              )
                            }
                          }}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    {!allDay && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          type="time"
                          className="w-[110px] rounded-xl"
                          value={startDate ? format(parseISO(startDate), 'HH:mm') : ''}
                          onChange={(e) => {
                            const base = startDate
                              ? startDate.split('T')[0]
                              : format(new Date(), 'yyyy-MM-dd')
                            setValue(
                              'start_date',
                              toLocalISO(base, `${e.target.value}:00`),
                              { shouldValidate: true },
                            )
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* End — events only */}
                {itemType === 'event' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Fim</Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'flex-1 justify-start text-left font-normal rounded-xl',
                              !endDate && 'text-muted-foreground',
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {endDate
                              ? format(parseISO(endDate), 'PPP', { locale: ptBR })
                              : 'Opcional'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parseDateValue(endDate)}
                            onSelect={(d) => {
                              if (d) {
                                const time = endDate
                                  ? endDate.split('T')[1]?.slice(0, 8) || '10:00:00'
                                  : '10:00:00'
                                const c = toLocalISO(format(d, 'yyyy-MM-dd'), time)
                                setValue('end_date', c, { shouldValidate: true })
                              }
                            }}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      {!allDay && endDate && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Input
                            type="time"
                            className="w-[110px] rounded-xl"
                            value={endDate ? format(parseISO(endDate), 'HH:mm') : ''}
                            onChange={(e) => {
                              const base = endDate
                                ? endDate.split('T')[0]
                                : startDate
                                ? startDate.split('T')[0]
                                : format(new Date(), 'yyyy-MM-dd')
                              const c = toLocalISO(base, `${e.target.value}:00`)
                              setValue('end_date', c, { shouldValidate: true })
                            }}
                          />
                        </div>
                      )}
                      {endDate && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-9 w-9 rounded-full"
                          onClick={() => setValue('end_date', null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Location — events only (tasks table has no location field) */}
                {itemType === 'event' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    <MapPin className="inline h-3.5 w-3.5 mr-1" />
                    Localização <span className="text-muted-foreground/60 font-normal">(opcional)</span>
                  </Label>
                  <Input
                    placeholder="Ex: Escritório, Sala 2, Online..."
                    className="rounded-xl"
                    {...register('location')}
                  />
                </div>
                )}

                {/* Toggles */}
                <div className="rounded-2xl border border-border/40 bg-background/40 px-4 py-3 backdrop-blur-sm space-y-3">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-sm">Todo o dia</span>
                    <Checkbox
                      checked={allDay}
                      onCheckedChange={(v) => setValue('all_day', !!v)}
                      disabled={category === 'birthday' || category === 'vacation'}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-sm">Recorrente</span>
                    <Checkbox
                      checked={isRecurring}
                      onCheckedChange={(v) => {
                        setValue('is_recurring', !!v)
                        if (!v) setValue('recurrence_rule', null)
                      }}
                      disabled={category === 'birthday'}
                    />
                  </label>
                  {isRsvpCategory && itemType === 'event' && (
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="text-sm">Pedir confirmação de presença</span>
                      <Checkbox
                        checked={requiresRsvp}
                        onCheckedChange={(v) => setValue('requires_rsvp', !!v)}
                      />
                    </label>
                  )}
                </div>

                {isRecurring && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Frequência
                    </Label>
                    <Select
                      value={watch('recurrence_rule') ?? ''}
                      onValueChange={(v) => setValue('recurrence_rule', v as any)}
                      disabled={category === 'birthday'}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {CALENDAR_RECURRENCE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Atribuído a */}
                {users && users.length > 0 && (
                  <section className="space-y-2 pt-2">
                    <p className="text-xs font-medium text-muted-foreground/80">
                      Atribuído a
                    </p>
                    <Select
                      value={watch('user_id') ?? 'none'}
                      onValueChange={(v) => {
                        const newId = v === 'none' ? null : v
                        setValue('user_id', newId)
                        if (
                          newId &&
                          watch('visibility') === 'all' &&
                          (watch('visibility_mode') ?? 'all') === 'all'
                        ) {
                          setValue('visibility', 'private')
                        }
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </section>
                )}

                {/* Visibilidade — events only */}
                {itemType === 'event' && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground/80 inline-flex items-center gap-1">
                      Visibilidade
                    </p>
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline"
                      onClick={() => setShowAdvancedVisibility(!showAdvancedVisibility)}
                    >
                      {showAdvancedVisibility ? 'Simples' : 'Avançado'}
                    </button>
                  </div>

                  {!showAdvancedVisibility ? (
                    <Select
                      value={watch('visibility')}
                      onValueChange={(v) => {
                        setValue('visibility', v as any)
                        setValue('visibility_mode', 'all')
                        setValue('visibility_user_ids', [])
                        setValue('visibility_role_names', [])
                      }}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALENDAR_VISIBILITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-3 rounded-2xl border border-border/40 bg-background/40 p-3 backdrop-blur-sm">
                      <Select
                        value={visibilityMode}
                        onValueChange={(v) => setValue('visibility_mode', v as any)}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CALENDAR_VISIBILITY_MODE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {visibilityMode !== 'all' && (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground">Cargos</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {CALENDAR_ROLE_OPTIONS.map((role) => (
                                <button
                                  key={role.value}
                                  type="button"
                                  className={cn(
                                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                                    visibilityRoleNames.includes(role.value)
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-background/50 text-muted-foreground border-border/40 hover:border-border/70',
                                  )}
                                  onClick={() => toggleVisibilityRole(role.value)}
                                >
                                  {role.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] text-muted-foreground">
                              Pessoas específicas
                            </Label>
                            {users && users.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
                                {users.map((user) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    className={cn(
                                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                                      visibilityUserIds.includes(user.id)
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background/50 text-muted-foreground border-border/40 hover:border-border/70',
                                    )}
                                    onClick={() => toggleVisibilityUser(user.id)}
                                  >
                                    {user.name}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                A carregar pessoas...
                              </p>
                            )}
                          </div>

                          {(visibilityRoleNames.length > 0 ||
                            visibilityUserIds.length > 0) && (
                            <p className="text-[11px] text-muted-foreground">
                              {visibilityMode === 'include'
                                ? 'Visível apenas para'
                                : 'Todos excepto'}
                              {': '}
                              {visibilityRoleNames.length > 0 &&
                                `${visibilityRoleNames.length} cargo(s)`}
                              {visibilityRoleNames.length > 0 &&
                                visibilityUserIds.length > 0 &&
                                ', '}
                              {visibilityUserIds.length > 0 &&
                                `${visibilityUserIds.length} pessoa(s)`}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </section>
                )}
              </TabsContent>

              {/* ================= CONTEÚDO ================= */}
              <TabsContent value="conteudo" className="m-0 space-y-5">
                {/* Cover image — events only */}
                {itemType === 'event' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Imagem de capa
                  </Label>
                  {coverImageUrl ? (
                    <div className="relative overflow-hidden rounded-2xl border border-border/40 h-40 bg-muted group">
                      <img
                        src={coverImageUrl}
                        alt="Capa"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setValue('cover_image_url', null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border border-dashed cursor-pointer transition-colors',
                        isUploading
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border/50 hover:border-primary/40 hover:bg-muted/30',
                      )}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          e.target.value = ''
                          try {
                            setIsUploading(true)
                            const compressed = await compressImage(file)
                            const fd = new FormData()
                            fd.append('file', compressed)
                            const res = await fetch('/api/calendar/upload-cover', {
                              method: 'POST',
                              body: fd,
                            })
                            if (!res.ok) throw new Error()
                            const { url } = await res.json()
                            setValue('cover_image_url', url)
                          } catch {
                            toast.error('Erro ao carregar imagem.')
                          } finally {
                            setIsUploading(false)
                          }
                        }}
                      />
                      {isUploading ? (
                        <span className="text-xs text-muted-foreground">
                          A comprimir e carregar...
                        </span>
                      ) : (
                        <>
                          <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
                          <span className="text-xs text-muted-foreground">
                            Clique para adicionar imagem
                          </span>
                        </>
                      )}
                    </label>
                  )}
                </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Descrição
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-7 px-2.5 rounded-full text-xs',
                          isRecording && 'text-red-500',
                        )}
                        disabled={isTranscribing}
                        onClick={startVoiceRecording}
                      >
                        {isTranscribing ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            A transcrever...
                          </>
                        ) : isRecording ? (
                          <>
                            <MicOff className="h-3 w-3 mr-1" />
                            Parar
                          </>
                        ) : (
                          <>
                            <Mic className="h-3 w-3 mr-1" />
                            Voz
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 rounded-full text-xs"
                        disabled={isImproving || !description}
                        onClick={improveWithAI}
                      >
                        {isImproving ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            A melhorar...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            IA
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="relative rounded-2xl border border-border/40 bg-background/40 overflow-hidden [&_.ProseMirror]:max-h-[260px] [&_.ProseMirror]:overflow-y-auto">
                    <CalendarRichEditor
                      value={description ?? ''}
                      onChange={(html) => setValue('description', html)}
                      placeholder="Detalhes... Escreva, dite por voz, ou use a IA para melhorar."
                    />
                    {isRecording && (
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 z-10">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] text-red-500 font-medium">
                          A gravar...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* ================= OPÇÕES ================= */}
              <TabsContent value="opcoes" className="m-0 space-y-7">
                {/* Links — events only */}
                {itemType === 'event' && (
                <section className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground/80">
                    Ligações externas
                  </p>

                  <div className="space-y-2">
                    {/* Livestream */}
                    <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-background/40 px-3 py-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                        <Video className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium text-muted-foreground">Livestream</p>
                        <Input
                          placeholder="https://zoom.us/... ou https://meet.google.com/..."
                          className="h-6 border-0 bg-transparent text-xs focus-visible:ring-0 shadow-none px-0"
                          {...register('livestream_url')}
                        />
                      </div>
                    </div>

                    {/* Registration */}
                    <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-background/40 px-3 py-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <ClipboardCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium text-muted-foreground">Inscrição</p>
                        <Input
                          placeholder="https://forms.google.com/... ou https://eventbrite.com/..."
                          className="h-6 border-0 bg-transparent text-xs focus-visible:ring-0 shadow-none px-0"
                          {...register('registration_url')}
                        />
                      </div>
                    </div>

                    {/* Custom links list */}
                    {(watch('links') ?? []).map((link, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-background/40 px-3 py-2"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                          <Link2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <Input
                            placeholder="Nome (ex: Apresentação)"
                            className="h-5 border-0 bg-transparent text-xs font-medium focus-visible:ring-0 shadow-none px-0"
                            value={link.name}
                            onChange={(e) => {
                              const updated = [...(watch('links') ?? [])]
                              updated[idx] = { ...updated[idx], name: e.target.value }
                              setValue('links', updated)
                            }}
                          />
                          <Input
                            placeholder="https://..."
                            className="h-5 border-0 bg-transparent text-[11px] text-muted-foreground focus-visible:ring-0 shadow-none px-0"
                            value={link.url}
                            onChange={(e) => {
                              const updated = [...(watch('links') ?? [])]
                              updated[idx] = { ...updated[idx], url: e.target.value }
                              setValue('links', updated)
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const updated = (watch('links') ?? []).filter(
                              (_, i) => i !== idx,
                            )
                            setValue('links', updated)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}

                    {/* Add custom link */}
                    <button
                      type="button"
                      className="flex items-center gap-3 w-full rounded-2xl border border-dashed border-border/50 px-3 py-2 text-muted-foreground hover:border-border/80 hover:bg-muted/30 transition-colors"
                      onClick={() => {
                        const current = watch('links') ?? []
                        setValue('links', [...current, { name: '', url: '' }])
                      }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                        <Plus className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium">Adicionar outro link</span>
                    </button>
                  </div>
                </section>
                )}

                {/* Reminders */}
                <section className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground/80">Lembretes</p>

                  <div className="flex flex-wrap gap-1.5">
                    {REMINDER_PRESETS.map((opt) => {
                      const reminders = watch('reminders') ?? []
                      const active = reminders.some((r) => r.minutes_before === opt.minutes)
                      return (
                        <button
                          key={opt.minutes}
                          type="button"
                          className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background/40 text-muted-foreground border-border/40 hover:border-border/70',
                          )}
                          onClick={() => {
                            if (active) {
                              setValue(
                                'reminders',
                                reminders.filter((r) => r.minutes_before !== opt.minutes),
                              )
                            } else {
                              setValue('reminders', [
                                ...reminders,
                                { minutes_before: opt.minutes },
                              ])
                            }
                          }}
                        >
                          <Bell className="inline h-3 w-3 mr-1" />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Minutos"
                      className="w-24 h-8 text-xs rounded-full"
                      id="custom-reminder-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const input = e.target as HTMLInputElement
                          const val = parseInt(input.value)
                          if (!val || val <= 0) return
                          const reminders = watch('reminders') ?? []
                          if (reminders.some((r) => r.minutes_before === val)) {
                            toast.error('Lembrete já existe.')
                            return
                          }
                          setValue('reminders', [
                            ...reminders,
                            { minutes_before: val },
                          ])
                          input.value = ''
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">min antes</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-full"
                      onClick={() => {
                        const input = document.getElementById(
                          'custom-reminder-input',
                        ) as HTMLInputElement | null
                        const val = parseInt(input?.value ?? '')
                        if (!val || val <= 0) {
                          toast.error('Insira um valor em minutos.')
                          return
                        }
                        const reminders = watch('reminders') ?? []
                        if (reminders.some((r) => r.minutes_before === val)) {
                          toast.error('Lembrete já existe.')
                          return
                        }
                        setValue('reminders', [...reminders, { minutes_before: val }])
                        if (input) input.value = ''
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {(() => {
                    const reminders = watch('reminders') ?? []
                    const custom = reminders.filter(
                      (r) => !REMINDER_PRESET_MINUTES.includes(r.minutes_before),
                    )
                    if (custom.length === 0) return null
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {custom.map((r) => (
                          <span
                            key={r.minutes_before}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary text-primary-foreground"
                          >
                            <Bell className="h-3 w-3" />
                            {formatReminderMin(r.minutes_before)}
                            <button
                              type="button"
                              onClick={() =>
                                setValue(
                                  'reminders',
                                  reminders.filter(
                                    (x) => x.minutes_before !== r.minutes_before,
                                  ),
                                )
                              }
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </section>

              </TabsContent>
            </div>
          </Tabs>

          {/* Footer */}
          <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="rounded-full flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  A guardar...
                </>
              ) : isEditing ? (
                'Guardar'
              ) : itemType === 'task' ? (
                'Criar Tarefa'
              ) : (
                'Criar Evento'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
