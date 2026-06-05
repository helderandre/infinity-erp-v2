// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
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
import { AIQuickFillBar } from '@/components/shared/ai-quick-fill-bar'

interface CourseCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CourseCreateDialog({ open, onOpenChange }: CourseCreateDialogProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
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
    if (open) {
      fetch('/api/training/categories')
        .then(r => r.json())
        .then(d => setCategories(d.data || []))
        .catch(() => {})
    }
  }, [open])

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
      const result = await res.json()
      toast.success('Formação criada com sucesso')
      onOpenChange(false)
      form.reset()
      router.push(`/dashboard/formacoes/gestao/${result.id}/editar`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10 space-y-3">
          <SheetHeader className="p-0 gap-0">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
              Nova formação
            </SheetTitle>
            <SheetDescription className="sr-only">
              Preenche os dados para criar um novo curso de formação.
            </SheetDescription>
          </SheetHeader>
          <AIQuickFillBar
            placeholder="Descreve a formação por texto ou voz..."
            onFill={async (text) => {
              try {
                const res = await fetch('/api/training/courses/fill-from-text', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text,
                    categories: categories.map((c) => ({ id: c.id, name: c.name })),
                  }),
                })
                if (!res.ok) {
                  toast.error('Erro ao interpretar texto')
                  return
                }
                const { data } = await res.json()
                const fields = [
                  'title', 'summary', 'description', 'category_id',
                  'difficulty_level', 'instructor_name',
                  'estimated_duration_minutes', 'passing_score',
                  'is_mandatory', 'has_certificate',
                ]
                for (const key of fields) {
                  if (data[key] !== undefined && data[key] !== null) {
                    form.setValue(key as any, data[key], { shouldValidate: true })
                  }
                }
                toast.success('Dados preenchidos com IA')
              } catch {
                toast.error('Erro ao interpretar texto')
              }
            }}
          />
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-1 pb-8 space-y-5">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Qualificação de Compradores" className="rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="summary" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Resumo</FormLabel>
                  <FormControl>
                    <Input placeholder="Resumo curto (até 300 caracteres)" className="rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Descrição detalhada do curso..."
                      className="rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="category_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Seleccionar categoria" />
                        </SelectTrigger>
                      </FormControl>
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
                    <FormLabel className="text-xs font-medium text-muted-foreground">Dificuldade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="instructor_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">Formador</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Isabel Silva" className="rounded-xl" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="estimated_duration_minutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      Duração (min)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 120"
                        className="rounded-xl"
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="passing_score" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">Nota mínima (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="rounded-xl"
                      value={field.value ?? 70}
                      onChange={e => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Percentagem mínima para aprovação nos quizzes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-3 rounded-2xl border border-border/50 p-4">
                <p className="text-xs font-medium text-muted-foreground/80">Opções</p>

                <FormField control={form.control} name="is_mandatory" render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Formação obrigatória</FormLabel>
                      <FormDescription className="text-[11px]">
                        Consultores devem completar esta formação.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="has_certificate" render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Emitir certificado</FormLabel>
                      <FormDescription className="text-[11px]">
                        Gerar certificado ao concluir.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background border-t border-border/50">
              <Button type="button" variant="outline" size="sm" className="rounded-full flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="rounded-full flex-1" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar formação
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
