// @ts-nocheck
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
} from 'lucide-react'
import { toast } from 'sonner'
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
  external_link: 'Link Externo',
}

const CONTENT_TYPE_ICONS: Record<LessonContentType, typeof Video> = {
  video: Video,
  pdf: FileText,
  text: Type,
  external_link: ExternalLink,
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

  const openLessonDialog = (moduleId: string, lesson?: TrainingLesson) => {
    setActiveModuleId(moduleId)
    if (lesson) {
      setEditingLesson(lesson)
      lessonForm.reset({
        title: lesson.title,
        description: lesson.description || '',
        content_type: lesson.content_type,
        video_url: lesson.video_url || '',
        video_provider: lesson.video_provider || undefined,
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
        video_provider: undefined,
        video_duration_seconds: null,
        pdf_url: '',
        text_content: '',
        external_url: '',
        order_index: mod?.lessons?.length || 0,
        estimated_minutes: null,
      })
    }
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
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-muted-foreground">
              Este curso ainda nao tem modulos.
            </p>
            <p className="text-sm text-muted-foreground">
              Adicione o primeiro modulo para comecar a construir o curso.
            </p>
          </CardContent>
        </Card>
      )}

      {modules.map((mod) => {
        const isExpanded = expandedModules.has(mod.id)
        const lessons = mod.lessons || []

        return (
          <Card key={mod.id}>
            <Collapsible
              open={isExpanded}
              onOpenChange={() => toggleModule(mod.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <CardTitle className="text-base">{mod.title}</CardTitle>
                    <Badge variant="secondary" className="ml-2">
                      {lessons.length}{' '}
                      {lessons.length === 1 ? 'licao' : 'licoes'}
                    </Badge>
                    {mod.quiz && (
                      <Badge variant="outline" className="ml-1 gap-1">
                        <HelpCircle className="h-3 w-3" />
                        Quiz
                      </Badge>
                    )}
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        openModuleDialog(mod)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={deletingId === mod.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteModule(mod.id)
                      }}
                    >
                      {deletingId === mod.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  {lessons.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Nenhuma licao neste modulo.
                    </p>
                  )}

                  {lessons.map((lesson) => {
                    const Icon =
                      CONTENT_TYPE_ICONS[lesson.content_type] || FileText
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {lesson.title}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {CONTENT_TYPE_LABELS[lesson.content_type]}
                          </Badge>
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
                            onClick={() =>
                              openLessonDialog(mod.id, lesson)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
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
                    className="w-full"
                    onClick={() => openLessonDialog(mod.id)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Adicionar Licao
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )
      })}

      {/* Add module button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => openModuleDialog()}
      >
        <Plus className="mr-1 h-4 w-4" />
        Adicionar Modulo
      </Button>

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingModule ? 'Editar Modulo' : 'Novo Modulo'}
            </DialogTitle>
          </DialogHeader>
          <Form {...moduleForm}>
            <form
              onSubmit={moduleForm.handleSubmit(handleSaveModule)}
              className="space-y-4"
            >
              <FormField
                control={moduleForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titulo *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Introducao ao Modulo"
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
                    <FormLabel>Descricao</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descricao do modulo..."
                        rows={3}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModuleDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      A guardar...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLesson ? 'Editar Licao' : 'Nova Licao'}
            </DialogTitle>
          </DialogHeader>
          <Form {...lessonForm}>
            <form
              onSubmit={lessonForm.handleSubmit(handleSaveLesson)}
              className="space-y-4"
            >
              <FormField
                control={lessonForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titulo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Titulo da licao" {...field} />
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
                    <FormLabel>Tipo de Conteudo *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(CONTENT_TYPE_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conditional content fields */}
              {watchContentType === 'video' && (
                <>
                  <FormField
                    control={lessonForm.control}
                    name="video_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL do Video *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://youtube.com/watch?v=..."
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={lessonForm.control}
                      name="video_provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plataforma</FormLabel>
                          <Select
                            value={field.value || ''}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="youtube">YouTube</SelectItem>
                              <SelectItem value="vimeo">Vimeo</SelectItem>
                              <SelectItem value="r2">R2</SelectItem>
                              <SelectItem value="other">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={lessonForm.control}
                      name="video_duration_seconds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duracao (segundos)</FormLabel>
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
                  </div>
                </>
              )}

              {watchContentType === 'pdf' && (
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
              )}

              {watchContentType === 'text' && (
                <FormField
                  control={lessonForm.control}
                  name="text_content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conteudo de Texto *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Escreva o conteudo da licao..."
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

              <FormField
                control={lessonForm.control}
                name="estimated_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duracao Estimada (minutos)</FormLabel>
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLessonDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      A guardar...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
