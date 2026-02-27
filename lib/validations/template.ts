import { z } from 'zod'

// Schema para uma subtarefa do template (novo modelo com type)
export const subtaskSchema = z
  .object({
    title: z.string().min(1, 'O título é obrigatório'),
    description: z.string().optional(),
    is_mandatory: z.boolean().default(true),
    order_index: z.number().int().min(0),
    type: z.enum(['upload', 'checklist', 'email', 'generate_doc'], {
      message: 'Tipo de subtarefa inválido',
    }),
    config: z
      .object({
        doc_type_id: z.string().optional(),
        email_library_id: z.string().optional(),
        doc_library_id: z.string().optional(),
      })
      .default({}),
  })
  .refine(
    (subtask) => {
      // upload: doc_type_id obrigatório
      if (subtask.type === 'upload') return !!subtask.config?.doc_type_id
      // email: email_library_id obrigatório
      if (subtask.type === 'email') return !!subtask.config?.email_library_id
      // generate_doc: doc_library_id obrigatório
      if (subtask.type === 'generate_doc') return !!subtask.config?.doc_library_id
      return true
    },
    { message: 'Configuração inválida para o tipo de subtarefa', path: ['config'] }
  )

// Schema para uma tarefa do template (sem action_type — derivado como COMPOSITE no backend)
export const taskSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
  description: z.string().optional(),
  is_mandatory: z.boolean().default(true),
  priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
  sla_days: z.number().int().positive().optional(),
  assigned_role: z.string().optional(),
  order_index: z.number().int().min(0),
  subtasks: z.array(subtaskSchema).default([]),
})

// Schema para uma fase do template
export const stageSchema = z.object({
  name: z.string().min(1, 'O nome da fase é obrigatório'),
  description: z.string().optional(),
  order_index: z.number().int().min(0),
  tasks: z.array(taskSchema).min(1, 'A fase deve ter pelo menos uma tarefa'),
})

// Schema para o template completo
export const templateSchema = z.object({
  name: z.string().min(1, 'O nome do template é obrigatório'),
  description: z.string().optional(),
  stages: z
    .array(stageSchema)
    .min(1, 'O template deve ter pelo menos uma fase'),
})

// Types inferidos
export type SubtaskFormData = z.infer<typeof subtaskSchema>
export type TaskFormData = z.infer<typeof taskSchema>
export type StageFormData = z.infer<typeof stageSchema>
export type TemplateFormData = z.infer<typeof templateSchema>
