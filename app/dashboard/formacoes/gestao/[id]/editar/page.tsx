'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Globe, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import type { TrainingCourse, TrainingCategory } from '@/types/training'
import type { z } from 'zod'

type UpdateCourseInput = z.infer<typeof updateCourseSchema>

export default function EditarCursoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EditarCursoContent />
    </Suspense>
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

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (!course) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Formação não encontrada</p>
      <Button className="mt-4" asChild><Link href="/dashboard/formacoes/gestao">Voltar</Link></Button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/formacoes/gestao"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Editar: {course.title}</h1>
            <p className="text-muted-foreground text-sm">Estado: {course.status === 'published' ? 'Publicado' : course.status === 'draft' ? 'Rascunho' : 'Arquivado'}</p>
          </div>
        </div>
        {course.status === 'draft' && (
          <Button onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
            Publicar
          </Button>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
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
                  <FormControl><Input {...field} /></FormControl>
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
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Detalhes
              </Button>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="content" className="mt-4">
          <CourseBuilder
            courseId={courseId}
            modules={course.modules || []}
            onRefresh={fetchCourse}
          />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <div className="max-w-2xl space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <FormLabel>Duração Estimada (minutos)</FormLabel>
                    <FormControl>
                      <Input type="number" value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="is_mandatory" render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Formação Obrigatória</FormLabel>
                      <FormDescription>Consultores devem completar</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="has_certificate" render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Emitir Certificado</FormLabel>
                      <FormDescription>Gerar certificado ao concluir</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar Configuração
                </Button>
              </form>
            </Form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
