'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createGoalActivitySchema, type CreateGoalActivityInput } from '@/lib/validations/goal'
import { GOAL_ACTIVITY_TYPES, GOAL_ORIGINS } from '@/lib/constants'

interface GoalActivityFormProps {
  goalId: string
  onSuccess: () => void
  onCancel: () => void
}

export function GoalActivityForm({ goalId, onSuccess, onCancel }: GoalActivityFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateGoalActivityInput>({
    resolver: zodResolver(createGoalActivitySchema),
    defaultValues: {
      activity_date: new Date().toISOString().split('T')[0],
      activity_type: 'call',
      origin: 'sellers',
      revenue_amount: null,
      notes: null,
    },
  })

  async function onSubmit(data: CreateGoalActivityInput) {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/goals/${goalId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao registar actividade')
      }

      toast.success('Actividade registada com sucesso')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registar actividade')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="activity_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="origin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origem</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(GOAL_ORIGINS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="activity_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Actividade</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(GOAL_ACTIVITY_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="revenue_amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (€) — opcional</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas — opcional</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Detalhes da actividade..."
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registar
          </Button>
        </div>
      </form>
    </Form>
  )
}
