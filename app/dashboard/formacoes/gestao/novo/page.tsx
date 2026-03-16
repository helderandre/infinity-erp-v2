// @ts-nocheck
'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
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
import type { TrainingCategory } from '@/types/training'

export default function NovoCursoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <NovoCursoContent />
    </Suspense>
  )
}

function NovoCursoContent() {
  const router = useRouter()
  const [categories, setCategories] = useState<TrainingCategory[]>([])
  const [isSaving, setIsSaving] = useState(false)

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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/formacoes/gestao"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nova Formação</h1>
          <p className="text-muted-foreground">Criar um novo curso de formação</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem>
              <FormLabel>Título *</FormLabel>
              <FormControl><Input placeholder="Ex: Qualificação de Compradores" {...field} /></FormControl>
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
                <FormControl><Input placeholder="Ex: Isabel Silva" {...field} /></FormControl>
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
  )
}
