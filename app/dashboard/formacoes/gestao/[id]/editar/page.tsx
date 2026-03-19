// @ts-nocheck
'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Globe, Loader2, GraduationCap, BookOpen, FileText, Upload, ImageIcon, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from '@/components/ui/form'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { CourseBuilder } from '@/components/training/course-builder'
import { updateCourseSchema } from '@/lib/validations/training'
import { TRAINING_DIFFICULTY_OPTIONS } from '@/lib/constants'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { TrainingCourse, TrainingCategory } from '@/types/training'
import type { z } from 'zod'

type UpdateCourseInput = z.infer<typeof updateCourseSchema>

const TABS = [
  { key: 'details' as const, label: 'Detalhes', icon: FileText },
  { key: 'content' as const, label: 'Conteúdo', icon: BookOpen },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function EditarCursoPage() {
  return (
    <Suspense fallback={<EditarSkeleton />}>
      <EditarCursoContent />
    </Suspense>
  )
}

function EditarSkeleton() {
  return (
    <div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="mt-6">
        <Skeleton className="h-10 w-60 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}

function EditarCursoContent() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const [course, setCourse] = useState<TrainingCourse | null>(null)
  const [categories, setCategories] = useState<TrainingCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('details')

  const form = useForm<UpdateCourseInput>({
    resolver: zodResolver(updateCourseSchema),
  })

  const fetchCourse = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/training/courses/${courseId}`)
      if (!res.ok) throw new Error('Erro')
      const data = await res.json()
      setCourse(data)
      form.reset({
        title: data.title,
        description: data.description || '',
        summary: data.summary || '',
        category_id: data.category_id,
        difficulty_level: data.difficulty_level,
        instructor_name: data.instructor_name || '',
        estimated_duration_minutes: data.estimated_duration_minutes,
        is_mandatory: data.is_mandatory,
        has_certificate: data.has_certificate,
        passing_score: data.passing_score,
      })
    } catch {
      toast.error('Erro ao carregar formação')
    } finally {
      setIsLoading(false)
    }
  }, [courseId, form])

  useEffect(() => {
    fetchCourse()
    fetch('/api/training/categories')
      .then(r => r.json())
      .then(d => setCategories(d.data || []))
      .catch(() => {})
  }, [fetchCourse])

  const onSubmit = async (data: UpdateCourseInput) => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/training/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Erro ao guardar')
      toast.success('Formação guardada com sucesso')
      fetchCourse()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCoverUpload = async (file: File) => {
    setIsUploadingCover(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/training/courses/${courseId}/upload-cover`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao enviar imagem')
      }
      toast.success('Imagem de capa enviada com sucesso')
      fetchCourse()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsUploadingCover(false)
    }
  }

  const handleRemoveCover = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/training/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_image_url: null }),
      })
      if (!res.ok) throw new Error('Erro ao remover capa')
      toast.success('Imagem de capa removida')
      fetchCourse()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const res = await fetch(`/api/training/courses/${courseId}/publish`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao publicar')
      }
      toast.success('Formação publicada com sucesso!')
      fetchCourse()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsPublishing(false)
    }
  }

  if (isLoading) return <EditarSkeleton />
  if (!course) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Formação não encontrada</p>
      <Button className="mt-4" asChild><Link href="/dashboard/formacoes/gestao">Voltar</Link></Button>
    </div>
  )

  const statusLabel = course.status === 'published' ? 'Publicado' : course.status === 'draft' ? 'Rascunho' : 'Arquivado'
  const statusColor = course.status === 'published' ? 'bg-emerald-500/15 text-emerald-600' : course.status === 'draft' ? 'bg-slate-500/15 text-slate-500' : 'bg-amber-500/15 text-amber-600'

  return (
    <div>
      {/* ─── Hero Card ─── */}
      <div className="relative overflow-hidden bg-neutral-900 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
        <div className="relative z-10 px-8 py-10 sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-neutral-400 hover:text-white hover:bg-white/10"
              asChild
            >
              <Link href="/dashboard/formacoes/gestao">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <GraduationCap className="h-5 w-5 text-neutral-400" />
            <p className="text-neutral-400 text-xs font-medium tracking-widest uppercase">
              Editar Formação
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {course.title}
          </h2>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className={cn('rounded-full text-[10px] px-2 py-0.5 border-white/20', statusColor)}>
              {statusLabel}
            </Badge>
            {course.category && (
              <span className="text-neutral-400 text-sm">{(course.category as any).name}</span>
            )}
          </div>
        </div>
        {/* Action buttons */}
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          {course.status === 'draft' && (
            <Button
              size="sm"
              className="rounded-full bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
              Publicar
            </Button>
          )}
        </div>
      </div>

      {/* ─── Pill Toggle Navigation (2 tabs) ─── */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                type="button"
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors duration-300',
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="mt-6 pb-6">
        <div key={activeTab} className="animate-in fade-in duration-300">

          {/* ═══════ DETALHES TAB — 2-column layout ═══════ */}
          {activeTab === 'details' && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* ── Main Column (2/3) ── */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Cover Image Upload */}
                    <div className="space-y-2">
                      <FormLabel>Imagem de Capa</FormLabel>
                      {course.cover_image_url ? (
                        <div className="relative group rounded-xl overflow-hidden border">
                          <img
                            src={course.cover_image_url}
                            alt="Capa do curso"
                            className="w-full h-48 object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            <label className="cursor-pointer rounded-full bg-white/90 text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-white transition-colors flex items-center gap-1.5">
                              <Upload className="h-3.5 w-3.5" />
                              Alterar
                              <input
                                type="file"
                                accept=".png,.jpg,.jpeg,.webp,.gif"
                                className="hidden"
                                disabled={isUploadingCover}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleCoverUpload(file)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={handleRemoveCover}
                              className="rounded-full bg-white/90 text-red-600 px-4 py-2 text-sm font-medium hover:bg-white transition-colors flex items-center gap-1.5"
                            >
                              <X className="h-3.5 w-3.5" />
                              Remover
                            </button>
                          </div>
                          {isUploadingCover && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <label
                          className={cn(
                            'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/40 hover:bg-muted/30',
                            isUploadingCover && 'pointer-events-none opacity-60'
                          )}
                        >
                          {isUploadingCover ? (
                            <>
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">A enviar...</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="h-8 w-8 text-muted-foreground" />
                              <div>
                                <span className="text-sm font-medium">Clique para enviar uma imagem de capa</span>
                                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — Máx. 5MB</p>
                              </div>
                            </>
                          )}
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.gif"
                            className="hidden"
                            disabled={isUploadingCover}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleCoverUpload(file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="summary" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resumo</FormLabel>
                        <FormControl><Input placeholder="Resumo curto (até 300 caracteres)" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl><Textarea rows={5} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="category_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="difficulty_level" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dificuldade</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {TRAINING_DIFFICULTY_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="instructor_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Formador</FormLabel>
                        <FormControl><Input placeholder="Ex: Isabel Silva" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Save button (main column) */}
                    <Button type="submit" disabled={isSaving}>
                      {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Guardar
                    </Button>
                  </div>

                  {/* ── Sidebar Column (1/3) ── */}
                  <div className="space-y-6">
                    {/* Status + Publish card */}
                    <div className="rounded-xl border bg-card p-5 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Estado</p>
                        <Badge variant="outline" className={cn('rounded-full text-xs px-3 py-1', statusColor)}>
                          {statusLabel}
                        </Badge>
                      </div>
                      {course.status === 'draft' && (
                        <Button
                          className="w-full"
                          onClick={handlePublish}
                          disabled={isPublishing}
                        >
                          {isPublishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
                          Publicar Formação
                        </Button>
                      )}
                    </div>

                    {/* Configuration fields */}
                    <div className="rounded-xl border bg-card p-5 space-y-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Configuração</p>

                      <FormField control={form.control} name="passing_score" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nota Mínima (%)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={100} value={field.value ?? 70} onChange={e => field.onChange(Number(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="estimated_duration_minutes" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duração Estimada (min)</FormLabel>
                          <FormControl>
                            <Input type="number" value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="is_mandatory" render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel className="text-sm">Obrigatória</FormLabel>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="has_certificate" render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel className="text-sm">Certificado</FormLabel>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </div>
                </div>
              </form>
            </Form>
          )}

          {/* ═══════ CONTEÚDO TAB ═══════ */}
          {activeTab === 'content' && (
            <CourseBuilder
              courseId={courseId}
              modules={course.modules || []}
              onRefresh={fetchCourse}
            />
          )}

        </div>
      </div>
    </div>
  )
}
