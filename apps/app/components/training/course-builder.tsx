// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LessonMaterialUpload } from './lesson-material-upload'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Video,
  FileText,
  Type,
  ExternalLink,
  HelpCircle,
  Loader2,
  Paperclip,
  BookOpen,
  Layers,
  X,
  Upload,
  LinkIcon,
  CheckCircle2,
  Youtube,
  Play,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  createModuleSchema,
  createLessonSchema,
  type CreateModuleInput,
  type CreateLessonInput,
} from '@/lib/validations/training'
import type {
  TrainingModule,
  TrainingLesson,
  LessonContentType,
} from '@/types/training'

interface CourseBuilderProps {
  courseId: string
  modules: TrainingModule[]
  onRefresh: () => void
}

const CONTENT_TYPE_LABELS: Record<LessonContentType, string> = {
  video: 'Video',
  pdf: 'PDF',
  text: 'Texto',
  external_link: 'Link',
  quiz: 'Quiz',
}

const CONTENT_TYPE_ICONS: Record<LessonContentType, typeof Video> = {
  video: Video,
  pdf: FileText,
  text: Type,
  external_link: ExternalLink,
  quiz: HelpCircle,
}

export function CourseBuilder({
  courseId,
  modules,
  onRefresh,
}: CourseBuilderProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.map((m) => m.id))
  )
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false)
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(
    null
  )
  const [editingLesson, setEditingLesson] = useState<TrainingLesson | null>(
    null
  )
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDetectingDuration, setIsDetectingDuration] = useState(false)
  const [durationDetected, setDurationDetected] = useState(false)
  const [lessonTab, setLessonTab] = useState<'conteudo' | 'materiais'>('conteudo')
  const [pdfMode, setPdfMode] = useState<'link' | 'upload'>('link')
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)

  const handleVideoUpload = async (file: File) => {
    if (!editingLesson) return
    setIsUploadingVideo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/training/lessons/${editingLesson.id}/upload-video`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao fazer upload')
      }
      const { url } = await res.json()
      lessonForm.setValue('video_url', url)
      toast.success('Vídeo enviado com sucesso')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsUploadingVideo(false)
    }
  }

  const handlePdfUpload = async (file: File) => {
    if (!editingLesson) return
    setIsUploadingPdf(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/training/lessons/${editingLesson.id}/upload-pdf`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao fazer upload')
      }
      const { url } = await res.json()
      lessonForm.setValue('pdf_url', url)
      toast.success('PDF enviado com sucesso')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsUploadingPdf(false)
    }
  }

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // --- Module CRUD ---

  const moduleForm = useForm<CreateModuleInput>({
    resolver: zodResolver(createModuleSchema),
    defaultValues: { title: '', description: '', order_index: 0 },
  })

  const openModuleDialog = (mod?: TrainingModule) => {
    if (mod) {
      setEditingModule(mod)
      moduleForm.reset({
        title: mod.title,
        description: mod.description || '',
        order_index: mod.order_index,
      })
    } else {
      setEditingModule(null)
      moduleForm.reset({
        title: '',
        description: '',
        order_index: modules.length,
      })
    }
    setModuleDialogOpen(true)
  }

  const handleSaveModule = async (data: CreateModuleInput) => {
    setIsSubmitting(true)
    try {
      const url = editingModule
        ? `/api/training/modules/${editingModule.id}`
        : `/api/training/courses/${courseId}/modules`
      const method = editingModule ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error()

      toast.success(
        editingModule
          ? 'Modulo actualizado com sucesso!'
          : 'Modulo criado com sucesso!'
      )
      setModuleDialogOpen(false)
      onRefresh()
    } catch {
      toast.error('Erro ao guardar o modulo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    setDeletingId(moduleId)
    try {
      const res = await fetch(`/api/training/modules/${moduleId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast.success('Modulo eliminado com sucesso!')
      onRefresh()
    } catch {
      toast.error('Erro ao eliminar o modulo.')
    } finally {
      setDeletingId(null)
    }
  }

  // --- Lesson CRUD ---

  const lessonForm = useForm<CreateLessonInput>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: {
      title: '',
      description: '',
      content_type: 'video',
      video_url: '',
      video_provider: undefined,
      video_duration_seconds: null,
      pdf_url: '',
      text_content: '',
      external_url: '',
      order_index: 0,
      estimated_minutes: null,
    },
  })

  const watchContentType = lessonForm.watch('content_type')
  const watchVideoUrl = lessonForm.watch('video_url')
  const watchVideoProvider = lessonForm.watch('video_provider')

  // Auto-detect YouTube provider and duration
  useEffect(() => {
    if (!watchVideoUrl || watchContentType !== 'video') return
    setDurationDetected(false)

    const timer = setTimeout(async () => {
      // Auto-detect provider
      if (watchVideoUrl.includes('youtube') || watchVideoUrl.includes('youtu.be')) {
        lessonForm.setValue('video_provider', 'youtube')
      } else if (watchVideoUrl.includes('vimeo')) {
        lessonForm.setValue('video_provider', 'vimeo')
      }

      // Detect YouTube duration
      if (watchVideoUrl.includes('youtube') || watchVideoUrl.includes('youtu.be')) {
        setIsDetectingDuration(true)
        try {
          const res = await fetch(`/api/training/youtube-duration?url=${encodeURIComponent(watchVideoUrl)}`)
          const data = await res.json()
          if (data.duration_seconds) {
            lessonForm.setValue('video_duration_seconds', data.duration_seconds)
            setDurationDetected(true)
          }
        } catch {} finally {
          setIsDetectingDuration(false)
        }
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [watchVideoUrl])

  const openLessonDialog = (moduleId: string, lesson?: TrainingLesson) => {
    setActiveModuleId(moduleId)
    if (lesson) {
      setEditingLesson(lesson)
      lessonForm.reset({
        title: lesson.title,
        description: lesson.description || '',
        content_type: lesson.content_type,
        video_url: lesson.video_url || '',
        video_provider: lesson.video_provider || 'youtube',
        video_duration_seconds: lesson.video_duration_seconds || null,
        pdf_url: lesson.pdf_url || '',
        text_content: lesson.text_content || '',
        external_url: lesson.external_url || '',
        order_index: lesson.order_index,
        estimated_minutes: lesson.estimated_minutes || null,
      })
    } else {
      setEditingLesson(null)
      const mod = modules.find((m) => m.id === moduleId)
      lessonForm.reset({
        title: '',
        description: '',
        content_type: 'video',
        video_url: '',
        video_provider: 'youtube',
        video_duration_seconds: null,
        pdf_url: '',
        text_content: '',
        external_url: '',
        order_index: mod?.lessons?.length || 0,
        estimated_minutes: null,
      })
    }
    setLessonTab('conteudo')
    setPdfMode('link')
    setLessonDialogOpen(true)
  }

  const handleSaveLesson = async (data: CreateLessonInput) => {
    setIsSubmitting(true)
    try {
      const url = editingLesson
        ? `/api/training/lessons/${editingLesson.id}`
        : `/api/training/modules/${activeModuleId}/lessons`
      const method = editingLesson ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error()

      toast.success(
        editingLesson
          ? 'Licao actualizada com sucesso!'
          : 'Licao criada com sucesso!'
      )
      setLessonDialogOpen(false)
      onRefresh()
    } catch {
      toast.error('Erro ao guardar a licao.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteLesson = async (lessonId: string) => {
    setDeletingId(lessonId)
    try {
      const res = await fetch(`/api/training/lessons/${lessonId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      toast.success('Licao eliminada com sucesso!')
      onRefresh()
    } catch {
      toast.error('Erro ao eliminar a licao.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Modules list */}
      {modules.length === 0 && (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            Este curso ainda não tem módulos.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione o primeiro módulo para começar a construir o curso.
          </p>
        </div>
      )}

      {modules.map((mod) => {
        const isExpanded = expandedModules.has(mod.id)
        const lessons = mod.lessons || []

        return (
          <div key={mod.id} className="rounded-2xl border overflow-hidden bg-card/30 backdrop-blur-sm">
            <Collapsible
              open={isExpanded}
              onOpenChange={() => toggleModule(mod.id)}
            >
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-base font-semibold">{mod.title}</span>
                    <Badge variant="secondary" className="ml-2 rounded-full text-[10px] px-2 py-0.5">
                      {lessons.length}{' '}
                      {lessons.length === 1 ? 'lição' : 'lições'}
                    </Badge>
                    {mod.quiz && (
                      <Badge variant="outline" className="ml-1 gap-1 rounded-full text-[10px] px-2 py-0.5">
                        <HelpCircle className="h-3 w-3" />
                        Quiz
                      </Badge>
                    )}
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        openModuleDialog(mod)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={deletingId === mod.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteModule(mod.id)
                      }}
                    >
                      {deletingId === mod.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <CollapsibleContent>
                <div className="px-5 pb-4 space-y-2">
                  {lessons.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Nenhuma lição neste módulo.
                    </p>
                  )}

                  {lessons.map((lesson) => {
                    const Icon =
                      CONTENT_TYPE_ICONS[lesson.content_type] || FileText
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between rounded-xl border p-3 transition-colors duration-200 hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {lesson.title}
                          </span>
                          <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5">
                            {CONTENT_TYPE_LABELS[lesson.content_type]}
                          </Badge>
                          {(lesson.material_count ?? 0) > 0 && (
                            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5 gap-1">
                              <Paperclip className="h-3 w-3" />
                              {lesson.material_count}
                            </Badge>
                          )}
                          {lesson.estimated_minutes && (
                            <span className="text-xs text-muted-foreground">
                              {lesson.estimated_minutes} min
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() =>
                              openLessonDialog(mod.id, lesson)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={deletingId === lesson.id}
                            onClick={() => handleDeleteLesson(lesson.id)}
                          >
                            {deletingId === lesson.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={() => openLessonDialog(mod.id)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Adicionar Lição
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )
      })}

      {/* Add module button */}
      <Button
        variant="outline"
        className="w-full rounded-xl"
        onClick={() => openModuleDialog()}
      >
        <Plus className="mr-1 h-4 w-4" />
        Adicionar Módulo
      </Button>

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[460px] rounded-2xl p-0 flex flex-col overflow-hidden gap-0">
          {/* Dark Header */}
          <div className="relative bg-neutral-900 px-5 py-4">
            <button
              type="button"
              title="Fechar"
              onClick={() => setModuleDialogOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                <Layers className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-white">
                  {editingModule ? 'Editar Módulo' : 'Novo Módulo'}
                </DialogTitle>
                <p className="text-xs text-neutral-400">
                  {editingModule ? 'Altere os dados do módulo' : 'Adicione um novo módulo ao curso'}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <Form {...moduleForm}>
            <form
              onSubmit={moduleForm.handleSubmit(handleSaveModule)}
              className="flex flex-1 flex-col"
            >
              <div className="space-y-4 px-5 py-4">
                <FormField
                  control={moduleForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Introdução ao Módulo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={moduleForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição do módulo..."
                          rows={3}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setModuleDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      A guardar...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[540px] h-[80vh] rounded-2xl p-0 flex flex-col overflow-hidden gap-0">
          {/* Dark Header */}
          <div className="relative bg-neutral-900 px-5 py-4">
            <button
              type="button"
              title="Fechar"
              onClick={() => setLessonDialogOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-white">
                  {editingLesson ? 'Editar Lição' : 'Nova Lição'}
                </DialogTitle>
                <p className="text-xs text-neutral-400">
                  {editingLesson ? 'Altere os dados da lição' : 'Adicione uma nova lição ao módulo'}
                </p>
              </div>
            </div>

            {/* Pill Tabs in Header */}
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setLessonTab('conteudo')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  lessonTab === 'conteudo'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <FileText className="h-3 w-3" />
                Conteúdo
              </button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => editingLesson && setLessonTab('materiais')}
                      disabled={!editingLesson}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                        lessonTab === 'materiais'
                          ? 'bg-white text-neutral-900 shadow-sm'
                          : 'text-neutral-400 hover:text-white',
                        !editingLesson && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <Paperclip className="h-3 w-3" />
                      Materiais
                    </button>
                  </TooltipTrigger>
                  {!editingLesson && (
                    <TooltipContent>
                      Guarde a lição primeiro para adicionar materiais.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {lessonTab === 'conteudo' && (
              <>
                <Form {...lessonForm}>
                  <form
                    id="lesson-form"
                    onSubmit={lessonForm.handleSubmit(handleSaveLesson)}
                    className="space-y-4"
                  >
                    <FormField
                      control={lessonForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título *</FormLabel>
                          <FormControl>
                            <Input placeholder="Título da lição" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={lessonForm.control}
                      name="content_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Conteúdo *</FormLabel>
                          <div className="grid grid-cols-5 gap-2">
                            {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => {
                              const Icon = CONTENT_TYPE_ICONS[value as LessonContentType]
                              const isSelected = field.value === value
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => field.onChange(value)}
                                  className={cn(
                                    'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all duration-200',
                                    isSelected
                                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                                      : 'border-border bg-card hover:border-primary/30 hover:bg-muted/50 text-muted-foreground'
                                  )}
                                >
                                  <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Conditional content fields */}
                    {watchContentType === 'video' && (
                      <>
                        <FormField
                          control={lessonForm.control}
                          name="video_provider"
                          render={({ field }) => {
                            const providers = [
                              { value: 'youtube', label: 'YouTube', icon: Youtube },
                              { value: 'vimeo', label: 'Vimeo', icon: Play },
                              { value: 'r2', label: 'Upload', icon: Upload },
                              { value: 'other', label: 'Embed', icon: Globe },
                            ]
                            return (
                              <FormItem>
                                <FormLabel>Plataforma</FormLabel>
                                <div className="grid grid-cols-4 gap-2">
                                  {providers.map(({ value, label, icon: Icon }) => {
                                    const isSelected = field.value === value
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        onClick={() => field.onChange(value)}
                                        className={cn(
                                          'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all duration-200',
                                          isSelected
                                            ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                                            : 'border-border bg-card hover:border-primary/30 hover:bg-muted/50 text-muted-foreground'
                                        )}
                                      >
                                        <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                                        {label}
                                      </button>
                                    )
                                  })}
                                </div>
                                <FormMessage />
                              </FormItem>
                            )
                          }}
                        />

                        {/* YouTube / Vimeo: URL input */}
                        {(watchVideoProvider === 'youtube' || watchVideoProvider === 'vimeo') && (
                          <FormField
                            control={lessonForm.control}
                            name="video_url"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>URL do Vídeo *</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={
                                      watchVideoProvider === 'youtube'
                                        ? 'https://youtube.com/watch?v=...'
                                        : 'https://vimeo.com/...'
                                    }
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* R2 Upload: file upload */}
                        {watchVideoProvider === 'r2' && (
                          <div className="space-y-2">
                            <FormLabel>Ficheiro de Vídeo *</FormLabel>
                            {lessonForm.watch('video_url') && (
                              <div className="flex items-center gap-2 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span className="truncate text-emerald-700 dark:text-emerald-400">Vídeo enviado</span>
                              </div>
                            )}
                            <label
                              className={cn(
                                'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:border-primary/40 hover:bg-muted/30',
                                isUploadingVideo && 'pointer-events-none opacity-60'
                              )}
                            >
                              {isUploadingVideo ? (
                                <>
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">A enviar...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="h-6 w-6 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">
                                    Clique para seleccionar um vídeo
                                  </span>
                                  <span className="text-xs text-muted-foreground/60">MP4, WebM, MOV — Máx. 500MB</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept=".mp4,.webm,.mov,.avi,.mkv"
                                className="hidden"
                                disabled={isUploadingVideo || !editingLesson}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleVideoUpload(file)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                            {!editingLesson && (
                              <p className="text-xs text-muted-foreground">
                                Guarde a lição primeiro para enviar um ficheiro.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Embed: textarea for embed code */}
                        {watchVideoProvider === 'other' && (
                          <FormField
                            control={lessonForm.control}
                            name="video_url"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Código Embed *</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder={'<iframe src="https://..." ...></iframe>'}
                                    rows={4}
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {/* Duration — hide for R2 upload, auto-detect for YouTube */}
                        {watchVideoProvider !== 'r2' && (
                          <FormField
                            control={lessonForm.control}
                            name="video_duration_seconds"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center gap-2">
                                  <FormLabel>Duração (segundos)</FormLabel>
                                  {isDetectingDuration && (
                                    <Badge variant="secondary" className="rounded-full text-[10px]">
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      A detectar...
                                    </Badge>
                                  )}
                                  {durationDetected && (
                                    <Badge variant="secondary" className="rounded-full text-[10px] text-emerald-700">
                                      ✓ Detectado
                                    </Badge>
                                  )}
                                </div>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    placeholder="Ex: 300"
                                    value={field.value ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      field.onChange(val ? parseInt(val) : null)
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </>
                    )}

                    {watchContentType === 'pdf' && (
                      <div className="space-y-3">
                        {/* Toggle link / upload */}
                        <div className="inline-flex items-center gap-1 rounded-full bg-muted/50 p-1">
                          <button
                            type="button"
                            onClick={() => setPdfMode('link')}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                              pdfMode === 'link'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <LinkIcon className="h-3 w-3" />
                            Link
                          </button>
                          <button
                            type="button"
                            onClick={() => setPdfMode('upload')}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                              pdfMode === 'upload'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Upload className="h-3 w-3" />
                            Enviar ficheiro
                          </button>
                        </div>

                        {pdfMode === 'link' ? (
                          <FormField
                            control={lessonForm.control}
                            name="pdf_url"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>URL do PDF *</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="https://..."
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <div className="space-y-2">
                            <FormLabel>Ficheiro PDF *</FormLabel>
                            {lessonForm.watch('pdf_url') && (
                              <div className="flex items-center gap-2 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span className="truncate text-emerald-700 dark:text-emerald-400">PDF enviado</span>
                              </div>
                            )}
                            <label
                              className={cn(
                                'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:border-primary/40 hover:bg-muted/30',
                                isUploadingPdf && 'pointer-events-none opacity-60'
                              )}
                            >
                              {isUploadingPdf ? (
                                <>
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">A enviar...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="h-6 w-6 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">
                                    Clique para seleccionar um PDF
                                  </span>
                                  <span className="text-xs text-muted-foreground/60">Máx. 50MB</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                disabled={isUploadingPdf || !editingLesson}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handlePdfUpload(file)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                            {!editingLesson && (
                              <p className="text-xs text-muted-foreground">
                                Guarde a lição primeiro para enviar um ficheiro.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {watchContentType === 'text' && (
                      <FormField
                        control={lessonForm.control}
                        name="text_content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Conteúdo de Texto *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Escreva o conteúdo da lição..."
                                rows={8}
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {watchContentType === 'external_link' && (
                      <FormField
                        control={lessonForm.control}
                        name="external_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL Externo *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://..."
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {watchContentType === 'quiz' && (
                      <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
                        <HelpCircle className="h-8 w-8 text-primary/60 mx-auto mb-2" />
                        <p className="text-sm font-medium">Lição do tipo Quiz</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Guarde a lição e depois configure o quiz no separador de Quiz do módulo.
                        </p>
                      </div>
                    )}

                    <FormField
                      control={lessonForm.control}
                      name="estimated_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duração Estimada (minutos)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="Ex: 15"
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                field.onChange(val ? parseInt(val) : null)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>

              </>
            )}

            {lessonTab === 'materiais' && editingLesson && (
              <LessonMaterialUpload lessonId={editingLesson.id} />
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setLessonDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="lesson-form"
              className="rounded-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
