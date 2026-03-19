// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { TRAINING_DIFFICULTY_OPTIONS } from '@/lib/constants'
import { toast } from 'sonner'
import { z } from 'zod'
import type { TrainingCategory } from '@/types/training'

const quickCreateSchema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres'),
  category_id: z.string().min(1, 'Seleccione uma categoria'),
  difficulty_level: z.string().default('beginner'),
  instructor_name: z.string().optional(),
})

type QuickCreateInput = z.infer<typeof quickCreateSchema>

interface CourseCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CourseCreateDialog({ open, onOpenChange }: CourseCreateDialogProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<TrainingCategory[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<QuickCreateInput>({
    resolver: zodResolver(quickCreateSchema),
    defaultValues: {
      title: '',
      category_id: '',
      difficulty_level: 'beginner',
      instructor_name: '',
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

  const onSubmit = async (data: QuickCreateInput) => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Formação</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl><Input placeholder="Ex: Qualificação de Compradores" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

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

            <FormField control={form.control} name="instructor_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Formador</FormLabel>
                <FormControl><Input placeholder="Ex: Isabel Silva" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar e Editar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
