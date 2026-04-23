// @ts-nocheck
'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, GraduationCap, Sparkles } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from '@/components/ui/form'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { createCourseSchema, type CreateCourseInput } from '@/lib/validations/training'
import { TRAINING_DIFFICULTY_OPTIONS } from '@/lib/constants'
import { toast } from 'sonner'
import type { TrainingCategory, VoiceFillResponse } from '@/types/training'
import { DictateCourseDialog } from '@/components/training/dictate-course-dialog'
import { VoiceInputButton } from '@/components/shared/voice-input-button'

export default function NovoCursoPage() {
  return (
    <Suspense fallback={<NovoSkeleton />}>
      <NovoCursoContent />
    </Suspense>
  )
}

function NovoSkeleton() {
  return (
    <div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="mt-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}

function NovoCursoContent() {
  const router = useRouter()
  const [categories, setCategories] = useState<TrainingCategory[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [dictateOpen, setDictateOpen] = useState(false)

  const form = useForm<CreateCourseInput>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      title: '',
      description: '',
      summary: '',
      category_id: '',
      difficulty_level: 'beginner',
      tags: [],
      instructor_name: '',
      estimated_duration_minutes: undefined,
      is_mandatory: false,
      has_certificate: false,
      passing_score: 70,
    },
  })

  useEffect(() => {
    fetch('/api/training/categories')
      .then(r => r.json())
      .then(d => setCategories(d.data || []))
      .catch(() => {})
  }, [])

  const handleVoiceApply = (
    fields: Partial<VoiceFillResponse['fields']>,
    categoryMatch: VoiceFillResponse['category_match'],
  ) => {
    // Apply each non-null, non-empty field to the form. Backend already stripped nulls.
    const fieldKeys = [
      'title', 'summary', 'description', 'difficulty_level',
      'instructor_name', 'estimated_duration_minutes',
      'is_mandatory', 'has_certificate', 'passing_score', 'tags',
    ] as const
    for (const key of fieldKeys) {
      const value = (fields as Record<string, unknown>)[key]
      if (value === undefined || value === null) continue
      if (typeof value === 'string' && value.trim() === '') continue
      // @ts-ignore — keys match CreateCourseInput
      form.setValue(key, value, { shouldDirty: true, shouldValidate: false })
    }
    if (categoryMatch) {
      form.setValue('category_id', categoryMatch.id, { shouldDirty: true, shouldValidate: true })
    }
    toast.success('Campos preenchidos a partir da gravação')
  }

  const onSubmit = async (data: CreateCourseInput) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/training/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar formação')
      }
      const { id } = await res.json()
      toast.success('Formação criada com sucesso')
      router.push(`/dashboard/formacoes/gestao/${id}/editar`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

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
              Nova Formação
            </p>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Criar Formação
          </h2>
          <p className="text-neutral-400 mt-1.5 text-sm leading-relaxed max-w-md">
            Preencha os dados para criar um novo curso de formação
          </p>
        </div>
        <div className="absolute top-6 right-6 z-20">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDictateOpen(true)}
            className="rounded-full bg-white/10 backdrop-blur-sm text-white border-white/20 hover:bg-white/20 hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-300" />
            Ditar tudo
          </Button>
        </div>
      </div>

      <DictateCourseDialog
        open={dictateOpen}
        onOpenChange={setDictateOpen}
        onApply={handleVoiceApply}
      />

      {/* ─── Form ─── */}
      <div className="mt-8 max-w-3xl mx-auto pb-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl><Input placeholder="Ex: Qualificação de Compradores" {...field} /></FormControl>
                  <VoiceInputButton
                    label="Ditar título"
                    onTranscribe={(text) => form.setValue('title', text.trim(), { shouldValidate: true, shouldDirty: true })}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="summary" render={({ field }) => (
              <FormItem>
                <FormLabel>Resumo</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl><Input placeholder="Resumo curto (até 300 caracteres)" {...field} /></FormControl>
                  <VoiceInputButton
                    label="Ditar resumo"
                    onTranscribe={(text) => form.setValue('summary', text.trim(), { shouldDirty: true })}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Descrição</FormLabel>
                  <VoiceInputButton
                    label="Ditar descrição"
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full px-2.5 text-xs"
                    onTranscribe={(text) => {
                      const current = (field.value ?? '').toString()
                      const next = current ? `${current}\n${text.trim()}` : text.trim()
                      form.setValue('description', next, { shouldDirty: true })
                    }}
                  />
                </div>
                <FormControl><Textarea rows={5} placeholder="Descrição detalhada do curso..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar categoria" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
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
                      {TRAINING_DIFFICULTY_OPTIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="instructor_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Formador</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl><Input placeholder="Ex: Isabel Silva" {...field} /></FormControl>
                    <VoiceInputButton
                      label="Ditar formador"
                      onTranscribe={(text) => form.setValue('instructor_name', text.trim(), { shouldDirty: true })}
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="estimated_duration_minutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração Estimada (minutos)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Ex: 120"
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="passing_score" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota Mínima (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0} max={100}
                      value={field.value ?? 70}
                      onChange={e => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Percentagem mínima para aprovação nos quizzes</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-semibold">Opções</h3>

              <FormField control={form.control} name="is_mandatory" render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <FormLabel>Formação Obrigatória</FormLabel>
                    <FormDescription>Consultores devem completar esta formação</FormDescription>
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
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard/formacoes/gestao')}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Formação
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
