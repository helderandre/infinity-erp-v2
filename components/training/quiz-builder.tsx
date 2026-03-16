// @ts-nocheck
'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  X,
  HelpCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createQuizSchema,
  createQuestionSchema,
} from '@/lib/validations/training'
import type { QuizQuestionType } from '@/types/training'

interface QuizBuilderProps {
  quizId?: string
  moduleId?: string
  courseId?: string
  onSave: () => void
  onCancel: () => void
}

// Combined form schema
const quizBuilderSchema = createQuizSchema.extend({
  questions: z.array(
    createQuestionSchema
  ),
})

type QuizBuilderFormData = z.infer<typeof quizBuilderSchema>

const QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  single_choice: 'Escolha Unica',
  multiple_choice: 'Escolha Multipla',
  true_false: 'Verdadeiro / Falso',
}

function generateId() {
  return crypto.randomUUID()
}

function getDefaultOptions(type: QuizQuestionType) {
  if (type === 'true_false') {
    return [
      { id: generateId(), text: 'Verdadeiro', is_correct: false },
      { id: generateId(), text: 'Falso', is_correct: false },
    ]
  }
  return [
    { id: generateId(), text: '', is_correct: false },
    { id: generateId(), text: '', is_correct: false },
  ]
}

export function QuizBuilder({
  quizId,
  moduleId,
  courseId,
  onSave,
  onCancel,
}: QuizBuilderProps) {
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<QuizBuilderFormData>({
    resolver: zodResolver(quizBuilderSchema),
    defaultValues: {
      module_id: moduleId || '',
      course_id: courseId || '',
      title: '',
      description: '',
      passing_score: 70,
      max_attempts: 0,
      time_limit_minutes: null,
      shuffle_questions: false,
      show_correct_answers: true,
      questions: [],
    },
  })

  const {
    fields: questionFields,
    append: appendQuestion,
    remove: removeQuestion,
  } = useFieldArray({
    control: form.control,
    name: 'questions',
  })

  const addQuestion = () => {
    appendQuestion({
      question_text: '',
      question_type: 'single_choice',
      options: getDefaultOptions('single_choice'),
      explanation: '',
      points: 1,
      order_index: questionFields.length,
    })
  }

  const handleQuestionTypeChange = (
    index: number,
    type: QuizQuestionType
  ) => {
    form.setValue(`questions.${index}.question_type`, type)
    form.setValue(`questions.${index}.options`, getDefaultOptions(type))
  }

  const addOption = (questionIndex: number) => {
    const current = form.getValues(`questions.${questionIndex}.options`)
    form.setValue(`questions.${questionIndex}.options`, [
      ...current,
      { id: generateId(), text: '', is_correct: false },
    ])
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const current = form.getValues(`questions.${questionIndex}.options`)
    if (current.length <= 2) {
      toast.error('Minimo de 2 opcoes por pergunta.')
      return
    }
    form.setValue(
      `questions.${questionIndex}.options`,
      current.filter((_, i) => i !== optionIndex)
    )
  }

  const toggleOptionCorrect = (
    questionIndex: number,
    optionIndex: number
  ) => {
    const questionType = form.getValues(
      `questions.${questionIndex}.question_type`
    )
    const options = form.getValues(`questions.${questionIndex}.options`)

    if (questionType === 'single_choice' || questionType === 'true_false') {
      // Only one correct
      const updated = options.map((opt, i) => ({
        ...opt,
        is_correct: i === optionIndex,
      }))
      form.setValue(`questions.${questionIndex}.options`, updated)
    } else {
      // Multiple correct
      const updated = [...options]
      updated[optionIndex] = {
        ...updated[optionIndex],
        is_correct: !updated[optionIndex].is_correct,
      }
      form.setValue(`questions.${questionIndex}.options`, updated)
    }
  }

  const handleSubmit = async (data: QuizBuilderFormData) => {
    setIsSaving(true)
    try {
      const { questions, ...quizData } = data

      // Create or update quiz
      const quizUrl = quizId
        ? `/api/training/quizzes/${quizId}`
        : '/api/training/quizzes'
      const quizMethod = quizId ? 'PUT' : 'POST'

      const quizRes = await fetch(quizUrl, {
        method: quizMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizData),
      })

      if (!quizRes.ok) {
        throw new Error('Erro ao guardar o quiz')
      }

      const savedQuiz = await quizRes.json()
      const savedQuizId = quizId || savedQuiz.id

      // Save questions
      for (let i = 0; i < questions.length; i++) {
        const q = { ...questions[i], order_index: i }
        await fetch(`/api/training/quizzes/${savedQuizId}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(q),
        })
      }

      toast.success('Quiz guardado com sucesso!')
      onSave()
    } catch (error) {
      toast.error('Erro ao guardar o quiz. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="mx-auto max-w-4xl space-y-8"
      >
        {/* Quiz settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Definicoes do Quiz
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titulo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Quiz do Modulo 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descricao</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descricao do quiz..."
                      rows={3}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="passing_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nota de Aprovacao (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_attempts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. Tentativas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0 = ilimitado"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>0 = ilimitado</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time_limit_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite de Tempo (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Sem limite"
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

            <div className="flex gap-8">
              <FormField
                control={form.control}
                name="shuffle_questions"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">
                      Baralhar perguntas
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="show_correct_answers"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">
                      Mostrar respostas correctas
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Perguntas ({questionFields.length})
            </h3>
          </div>

          {questionFields.map((field, qIndex) => {
            const questionType = form.watch(
              `questions.${qIndex}.question_type`
            )
            const options = form.watch(`questions.${qIndex}.options`) || []

            return (
              <Card key={field.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary">
                        Pergunta {qIndex + 1}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeQuestion(qIndex)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Question text */}
                  <FormField
                    control={form.control}
                    name={`questions.${qIndex}.question_text`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pergunta *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Escreva a pergunta..."
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    {/* Question type */}
                    <FormField
                      control={form.control}
                      name={`questions.${qIndex}.question_type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Pergunta</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(val) =>
                              handleQuestionTypeChange(
                                qIndex,
                                val as QuizQuestionType
                              )
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(QUESTION_TYPE_LABELS).map(
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

                    {/* Points */}
                    <FormField
                      control={form.control}
                      name={`questions.${qIndex}.points`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pontos</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 1)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    <Label>
                      Opcoes{' '}
                      <span className="text-xs text-muted-foreground">
                        (assinale a(s) correcta(s))
                      </span>
                    </Label>
                    {options.map((option, oIndex) => (
                      <div
                        key={option.id}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          checked={option.is_correct}
                          onCheckedChange={() =>
                            toggleOptionCorrect(qIndex, oIndex)
                          }
                          className="shrink-0"
                        />
                        <Input
                          value={option.text}
                          onChange={(e) => {
                            const updated = [...options]
                            updated[oIndex] = {
                              ...updated[oIndex],
                              text: e.target.value,
                            }
                            form.setValue(
                              `questions.${qIndex}.options`,
                              updated
                            )
                          }}
                          placeholder={`Opcao ${oIndex + 1}`}
                          disabled={questionType === 'true_false'}
                          className="flex-1"
                        />
                        {questionType !== 'true_false' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => removeOption(qIndex, oIndex)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {questionType !== 'true_false' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addOption(qIndex)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Adicionar Opcao
                      </Button>
                    )}
                  </div>

                  {/* Explanation */}
                  <FormField
                    control={form.control}
                    name={`questions.${qIndex}.explanation`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Explicacao (opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explicacao da resposta correcta..."
                            rows={2}
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )
          })}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addQuestion}
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar Pergunta
          </Button>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                <Save className="mr-1 h-4 w-4" />
                Guardar Quiz
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
