'use client'

import { useEffect, useState } from 'react'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CalendarDays, Clock, MapPin, Image as ImageIcon, ListChecks,
  Eye, Users, X, Mic, MicOff, Sparkles, Loader2, FileText,
  Link2, Video, Plus, Trash2, Bell, ClipboardCheck,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useImageCompress } from '@/hooks/use-image-compress'
import { CalendarRichEditor } from './calendar-rich-editor'

interface CalendarEventFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CalendarEventFormData) => Promise<void>
  initialData?: Partial<CalendarEventFormData>
  users?: { id: string; name: string }[]
}

export function CalendarEventForm({
  open,
  onClose,
  onSubmit,
  initialData,
  users,
}: CalendarEventFormProps) {
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
        ...initialData,
      })
    }
  }, [open, initialData, reset])

  useEffect(() => { if (category === 'birthday') { setValue('all_day', true); setValue('is_recurring', true); setValue('recurrence_rule', 'yearly'); setValue('item_type', 'event') } }, [category, setValue])
  useEffect(() => { if (category === 'vacation') { setValue('all_day', true); setValue('item_type', 'event') } }, [category, setValue])
  useEffect(() => { if (itemType === 'task') { setValue('requires_rsvp', false) } }, [itemType, setValue])

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

  /** Build an ISO string with the local timezone offset so Supabase stores the correct instant */
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
    setValue('visibility_user_ids', c.includes(userId) ? c.filter((id) => id !== userId) : [...c, userId])
  }
  const toggleVisibilityRole = (role: string) => {
    const c = visibilityRoleNames ?? []
    setValue('visibility_role_names', c.includes(role) ? c.filter((r) => r !== role) : [...c, role])
  }

  const startVoiceRecording = async () => {
    if (isRecording && mediaRecorderRef) { mediaRecorderRef.stop(); setIsRecording(false); return }
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
          const fd = new FormData(); fd.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = await res.json()
            const current = description ?? ''
            const append = current ? `${current}<p>${text}</p>` : `<p>${text}</p>`
            setValue('description', append)
            toast.success('Transcrição adicionada')
          } else { toast.error('Erro na transcrição') }
        } catch { toast.error('Erro na transcrição') }
        finally { setIsTranscribing(false) }
      }
      recorder.start(); setMediaRecorderRef(recorder); setIsRecording(true)
    } catch { toast.error('Não foi possível aceder ao microfone') }
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
      if (res.ok) { const { text } = await res.json(); setValue('description', text); toast.success('Descrição melhorada com IA') }
      else { toast.error('Erro ao melhorar texto') }
    } catch { toast.error('Erro ao melhorar texto') }
    finally { setIsImproving(false) }
  }

  /** Merge AI-extracted data into form — only overwrite fields the AI returned */
  const mergeAiData = (data: Record<string, unknown>) => {
    const fieldMap: Record<string, string> = {
      title: 'title', description: 'description', category: 'category',
      item_type: 'item_type', start_date: 'start_date', end_date: 'end_date',
      all_day: 'all_day', location: 'location', livestream_url: 'livestream_url',
      registration_url: 'registration_url', requires_rsvp: 'requires_rsvp',
    }
    for (const [aiKey, formKey] of Object.entries(fieldMap)) {
      if (data[aiKey] !== undefined && data[aiKey] !== null) {
        setValue(formKey as any, data[aiKey] as any, { shouldValidate: true })
      }
    }
  }

  const handleAiFill = async (text: string) => {
    if (!text.trim()) return
    setIsAiFilling(true)
    try {
      const res = await fetch('/api/calendar/fill-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
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
    if (isAiRecording && aiRecorderRef) { aiRecorderRef.stop(); setIsAiRecording(false); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setIsAiTranscribing(true)
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const fd = new FormData(); fd.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = await res.json()
            // Immediately fill from the transcribed text
            await handleAiFill(text)
          } else { toast.error('Erro na transcrição') }
        } catch { toast.error('Erro na transcrição') }
        finally { setIsAiTranscribing(false) }
      }
      recorder.start(); setAiRecorderRef(recorder); setIsAiRecording(true)
    } catch { toast.error('Não foi possível aceder ao microfone') }
  }

  const isEditing = !!initialData?.title
  const isRsvpCategory = category === 'company_event' || category === 'meeting'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-hidden w-[calc(100%-2rem)] rounded-xl sm:w-full flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? (itemType === 'task' ? 'Editar Tarefa' : 'Editar Evento') : (itemType === 'task' ? 'Nova Tarefa' : 'Novo Evento')}
          </DialogTitle>
          <DialogDescription>Preencha os detalhes.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit as any)} className="flex flex-col flex-1 min-h-0">
          {/* Item type toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit mb-3">
            {CALENDAR_ITEM_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value} type="button"
                className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  itemType === opt.value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                onClick={() => setValue('item_type', opt.value)}
              >
                {opt.value === 'task' && <ListChecks className="inline h-3.5 w-3.5 mr-1.5" />}
                {opt.label}
              </button>
            ))}
          </div>

          {/* AI Quick Fill */}
          <div className="flex items-center gap-1.5 mb-3 rounded-lg border bg-muted/20 p-1.5">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
            <Input
              placeholder={isAiFilling ? 'A processar...' : 'Descreva o evento por texto ou voz...'}
              className="h-7 border-0 bg-transparent text-xs focus-visible:ring-0 shadow-none px-1"
              value={aiFillText}
              disabled={isAiFilling || isAiTranscribing}
              onChange={(e) => setAiFillText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAiFill(aiFillText) } }}
            />
            <Button
              type="button" variant="ghost" size="icon"
              className={cn('h-7 w-7 shrink-0', isAiRecording && 'text-red-500')}
              disabled={isAiFilling || isAiTranscribing}
              onClick={startAiVoiceRecording}
            >
              {isAiTranscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : isAiRecording ? <MicOff className="h-3.5 w-3.5" />
                : <Mic className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button" variant="ghost" size="icon"
              className="h-7 w-7 shrink-0"
              disabled={isAiFilling || !aiFillText.trim()}
              onClick={() => handleAiFill(aiFillText)}
            >
              {isAiFilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid grid-cols-5 w-full h-8">
              <TabsTrigger value="detalhes" className="text-xs h-6">Detalhes</TabsTrigger>
              <TabsTrigger value="descricao" className="text-xs h-6">
                <FileText className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Descrição</span>
              </TabsTrigger>
              <TabsTrigger value="media" className="text-xs h-6">
                <ImageIcon className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Media</span>
              </TabsTrigger>
              <TabsTrigger value="links" className="text-xs h-6">
                <Link2 className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Links</span>
              </TabsTrigger>
              <TabsTrigger value="visibilidade" className="text-xs h-6">
                <Eye className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Acesso</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-3 pb-4">
              {/* ==================== TAB: Detalhes ==================== */}
              <TabsContent value="detalhes" className="m-0 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Título *</Label>
                  <Input id="title" placeholder={itemType === 'task' ? 'Ex: Enviar contrato' : 'Ex: Reunião de equipa'} {...register('title')} />
                  {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Categoria *</Label>
                  <Select value={category} onValueChange={(v) => setValue('category', v as any)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {CALENDAR_CATEGORY_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={allDay} onCheckedChange={(v) => setValue('all_day', !!v)} disabled={category === 'birthday' || category === 'vacation'} />
                    <span className="text-sm">Todo o dia</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={isRecurring} onCheckedChange={(v) => { setValue('is_recurring', !!v); if (!v) setValue('recurrence_rule', null) }} disabled={category === 'birthday'} />
                    <span className="text-sm">Recorrente</span>
                  </label>
                  {isRsvpCategory && itemType === 'event' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={requiresRsvp} onCheckedChange={(v) => setValue('requires_rsvp', !!v)} />
                      <span className="text-sm">Pedir presença</span>
                    </label>
                  )}
                </div>

                {isRecurring && (
                  <div className="space-y-1.5 pl-6">
                    <Label>Frequência</Label>
                    <Select value={watch('recurrence_rule') ?? ''} onValueChange={(v) => setValue('recurrence_rule', v as any)} disabled={category === 'birthday'}>
                      <SelectTrigger className="w-[180px]"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {CALENDAR_RECURRENCE_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Location */}
                {itemType === 'event' && (
                  <div className="space-y-1.5">
                    <Label><MapPin className="inline h-3.5 w-3.5 mr-1" />Localização</Label>
                    <Input placeholder="Ex: Escritório, Sala 2, Online..." {...register('location')} />
                  </div>
                )}

                {/* Start date + time */}
                <div className="space-y-1.5">
                  <Label>Início *</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('flex-1 justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {startDate ? format(parseISO(startDate), 'PPP', { locale: ptBR }) : 'Data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={parseDateValue(startDate)} onSelect={(d) => {
                          if (d) {
                            const time = startDate ? startDate.split('T')[1]?.slice(0, 8) || '09:00:00' : '09:00:00'
                            setValue('start_date', toLocalISO(format(d, 'yyyy-MM-dd'), time), { shouldValidate: true })
                          }
                        }} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                    {!allDay && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input type="time" className="w-[110px]" value={startDate ? format(parseISO(startDate), 'HH:mm') : ''} onChange={(e) => {
                          const base = startDate ? startDate.split('T')[0] : format(new Date(), 'yyyy-MM-dd')
                          setValue('start_date', toLocalISO(base, `${e.target.value}:00`), { shouldValidate: true })
                        }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* End date + time */}
                <div className="space-y-1.5">
                  <Label>Fim</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('flex-1 justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                          <CalendarDays className="mr-2 h-4 w-4" />{endDate ? format(parseISO(endDate), 'PPP', { locale: ptBR }) : 'Opcional'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={parseDateValue(endDate)} onSelect={(d) => {
                          if (d) {
                            const time = endDate ? endDate.split('T')[1]?.slice(0, 8) || '10:00:00' : '10:00:00'
                            const c = toLocalISO(format(d, 'yyyy-MM-dd'), time)
                            if (startDate && new Date(c) <= new Date(startDate)) { toast.error('A data/hora de fim deve ser posterior à de início.'); return }
                            setValue('end_date', c, { shouldValidate: true })
                          }
                        }} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                    {!allDay && endDate && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input type="time" className="w-[110px]" value={endDate ? format(parseISO(endDate), 'HH:mm') : ''} onChange={(e) => {
                          const base = endDate ? endDate.split('T')[0] : (startDate ? startDate.split('T')[0] : format(new Date(), 'yyyy-MM-dd'))
                          const c = toLocalISO(base, `${e.target.value}:00`)
                          if (startDate && new Date(c) <= new Date(startDate)) { toast.error('A data/hora de fim deve ser posterior à de início.'); return }
                          setValue('end_date', c, { shouldValidate: true })
                        }} />
                      </div>
                    )}
                    {endDate && (
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => setValue('end_date', null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

              </TabsContent>

              {/* ==================== TAB: Descrição ==================== */}
              <TabsContent value="descricao" className="m-0 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Descrição</Label>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" className={cn('h-7 px-2 text-xs', isRecording && 'text-red-500')} disabled={isTranscribing} onClick={startVoiceRecording}>
                      {isTranscribing ? (<><Loader2 className="h-3 w-3 mr-1 animate-spin" />A transcrever...</>)
                        : isRecording ? (<><MicOff className="h-3 w-3 mr-1" />Parar</>)
                        : (<><Mic className="h-3 w-3 mr-1" />Voz</>)}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={isImproving || !description} onClick={improveWithAI}>
                      {isImproving ? (<><Loader2 className="h-3 w-3 mr-1 animate-spin" />A melhorar...</>)
                        : (<><Sparkles className="h-3 w-3 mr-1" />IA</>)}
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <CalendarRichEditor
                    value={description ?? ''}
                    onChange={(html) => setValue('description', html)}
                    placeholder="Detalhes do evento... Escreva, dite por voz, ou use a IA para melhorar."
                  />
                  {isRecording && (
                    <div className="absolute top-10 right-2 flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 z-10">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] text-red-500 font-medium">A gravar...</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ==================== TAB: Media ==================== */}
              <TabsContent value="media" className="m-0 space-y-3">
                <Label><ImageIcon className="inline h-3.5 w-3.5 mr-1" />Imagem de capa</Label>
                {coverImageUrl ? (
                  <div className="relative rounded-lg overflow-hidden h-40 bg-muted group">
                    <img src={coverImageUrl} alt="Capa" className="w-full h-full object-cover" />
                    <button type="button" className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setValue('cover_image_url', null)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className={cn('flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
                    isUploading ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30')}>
                    <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
                      try {
                        setIsUploading(true)
                        const compressed = await compressImage(file)
                        const fd = new FormData(); fd.append('file', compressed)
                        const res = await fetch('/api/calendar/upload-cover', { method: 'POST', body: fd })
                        if (!res.ok) throw new Error(); const { url } = await res.json(); setValue('cover_image_url', url)
                      } catch { toast.error('Erro ao carregar imagem.') }
                      finally { setIsUploading(false) }
                    }} />
                    {isUploading ? (<span className="text-xs text-muted-foreground">A comprimir e carregar...</span>)
                      : (<><ImageIcon className="h-6 w-6 text-muted-foreground" /><span className="text-xs text-muted-foreground">Clique para adicionar imagem</span></>)}
                  </label>
                )}
              </TabsContent>

              {/* ==================== TAB: Links ==================== */}
              <TabsContent value="links" className="m-0 space-y-4">
                {/* Livestream URL */}
                <div className="space-y-1.5">
                  <Label>
                    <Video className="inline h-3.5 w-3.5 mr-1" />
                    Link de Livestream
                  </Label>
                  <Input
                    placeholder="https://zoom.us/... ou https://meet.google.com/..."
                    {...register('livestream_url')}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Se preenchido, aparece um botão de câmara no evento.
                  </p>
                </div>

                {/* Registration URL */}
                <div className="space-y-1.5">
                  <Label>
                    <ClipboardCheck className="inline h-3.5 w-3.5 mr-1" />
                    Link de Inscrição
                  </Label>
                  <Input
                    placeholder="https://forms.google.com/... ou https://eventbrite.com/..."
                    {...register('registration_url')}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Link externo para inscrição no evento.
                  </p>
                </div>

                {/* Custom links */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      <Link2 className="inline h-3.5 w-3.5 mr-1" />
                      Links adicionais
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const current = watch('links') ?? []
                        setValue('links', [...current, { name: '', url: '' }])
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {(watch('links') ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Sem links adicionais. Clique em &quot;Adicionar&quot; para juntar um.
                    </p>
                  )}

                  {(watch('links') ?? []).map((link, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1.5">
                        <Input
                          placeholder="Nome (ex: Apresentação)"
                          value={link.name}
                          onChange={(e) => {
                            const updated = [...(watch('links') ?? [])]
                            updated[idx] = { ...updated[idx], name: e.target.value }
                            setValue('links', updated)
                          }}
                        />
                        <Input
                          placeholder="https://..."
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
                        className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          const updated = (watch('links') ?? []).filter((_, i) => i !== idx)
                          setValue('links', updated)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* ==================== TAB: Visibilidade ==================== */}
              <TabsContent value="visibilidade" className="m-0 space-y-4">
                {/* User */}
                {users && users.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Pessoa associada</Label>
                    <Select value={watch('user_id') ?? 'none'} onValueChange={(v) => setValue('user_id', v === 'none' ? null : v)}>
                      <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Visibility */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label><Eye className="inline h-3.5 w-3.5 mr-1" />Visibilidade</Label>
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowAdvancedVisibility(!showAdvancedVisibility)}>
                      {showAdvancedVisibility ? 'Simples' : 'Avançado'}
                    </button>
                  </div>
                  {!showAdvancedVisibility ? (
                    <Select value={watch('visibility')} onValueChange={(v) => { setValue('visibility', v as any); setValue('visibility_mode', 'all'); setValue('visibility_user_ids', []); setValue('visibility_role_names', []) }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CALENDAR_VISIBILITY_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                      <Select value={visibilityMode} onValueChange={(v) => setValue('visibility_mode', v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CALENDAR_VISIBILITY_MODE_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                      </Select>
                      {visibilityMode !== 'all' && (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Cargos</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {CALENDAR_ROLE_OPTIONS.map((role) => (
                                <button key={role.value} type="button" className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                                  visibilityRoleNames.includes(role.value) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50')}
                                  onClick={() => toggleVisibilityRole(role.value)}>{role.label}</button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Pessoas específicas</Label>
                            {users && users.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                                {users.map((user) => (
                                  <button key={user.id} type="button" className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                                    visibilityUserIds.includes(user.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50')}
                                    onClick={() => toggleVisibilityUser(user.id)}>{user.name}</button>
                                ))}
                              </div>
                            ) : (<p className="text-xs text-muted-foreground">A carregar pessoas...</p>)}
                          </div>
                          {(visibilityRoleNames.length > 0 || visibilityUserIds.length > 0) && (
                            <p className="text-[11px] text-muted-foreground">
                              {visibilityMode === 'include' ? 'Visível apenas para' : 'Todos excepto'}{': '}
                              {visibilityRoleNames.length > 0 && `${visibilityRoleNames.length} cargo(s)`}
                              {visibilityRoleNames.length > 0 && visibilityUserIds.length > 0 && ', '}
                              {visibilityUserIds.length > 0 && `${visibilityUserIds.length} pessoa(s)`}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Reminders */}
                <Separator className="my-2" />
                <div className="space-y-3 pt-1">
                  <Label><Bell className="inline h-3.5 w-3.5 mr-1" />Lembretes</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Notificações push e in-app antes do evento. Apenas visíveis para quem tem acesso ao evento.
                  </p>

                  {/* Preset options */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { minutes: 5, label: '5 min' },
                      { minutes: 15, label: '15 min' },
                      { minutes: 30, label: '30 min' },
                      { minutes: 60, label: '1 hora' },
                      { minutes: 120, label: '2 horas' },
                      { minutes: 1440, label: '1 dia' },
                    ].map((opt) => {
                      const reminders = watch('reminders') ?? []
                      const active = reminders.some((r) => r.minutes_before === opt.minutes)
                      return (
                        <button
                          key={opt.minutes}
                          type="button"
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-muted-foreground border-border hover:border-primary/50',
                          )}
                          onClick={() => {
                            if (active) {
                              setValue('reminders', reminders.filter((r) => r.minutes_before !== opt.minutes))
                            } else {
                              setValue('reminders', [...reminders, { minutes_before: opt.minutes }])
                            }
                          }}
                        >
                          <Bell className="inline h-3 w-3 mr-1" />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom reminder */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Minutos"
                      className="w-24 h-8 text-xs"
                      id="custom-reminder-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const input = e.target as HTMLInputElement
                          const val = parseInt(input.value)
                          if (!val || val <= 0) return
                          const reminders = watch('reminders') ?? []
                          if (reminders.some((r) => r.minutes_before === val)) { toast.error('Lembrete já existe.'); return }
                          setValue('reminders', [...reminders, { minutes_before: val }])
                          input.value = ''
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">min antes</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const input = document.getElementById('custom-reminder-input') as HTMLInputElement
                        const val = parseInt(input?.value)
                        if (!val || val <= 0) { toast.error('Insira um valor em minutos.'); return }
                        const reminders = watch('reminders') ?? []
                        if (reminders.some((r) => r.minutes_before === val)) { toast.error('Lembrete já existe.'); return }
                        setValue('reminders', [...reminders, { minutes_before: val }])
                        if (input) input.value = ''
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />Adicionar
                    </Button>
                  </div>

                  {/* Active reminders list */}
                  {(() => {
                    const reminders = watch('reminders') ?? []
                    const presets = [5, 15, 30, 60, 120, 1440]
                    const custom = reminders.filter((r) => !presets.includes(r.minutes_before))
                    if (custom.length === 0 && reminders.length === 0) return null

                    const formatMin = (m: number) => {
                      if (m < 60) return `${m} min`
                      if (m === 60) return '1 hora'
                      if (m < 1440) return `${Math.round(m / 60)}h`
                      if (m === 1440) return '1 dia'
                      return `${Math.round(m / 1440)} dia(s)`
                    }

                    return (
                      <div className="space-y-1">
                        {custom.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {custom.map((r) => (
                              <span key={r.minutes_before} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary text-primary-foreground">
                                <Bell className="h-3 w-3" />
                                {formatMin(r.minutes_before)}
                                <button type="button" onClick={() => setValue('reminders', reminders.filter((x) => x.minutes_before !== r.minutes_before))}>
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {reminders.length} lembrete(s) configurado(s)
                        </p>
                      </div>
                    )
                  })()}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="pt-3 shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'A guardar...' : isEditing ? 'Guardar' : itemType === 'task' ? 'Criar Tarefa' : 'Criar Evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
