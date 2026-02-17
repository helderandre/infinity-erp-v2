import { z } from 'zod'

// Schema para uma tarefa do template
export const taskSchema = z
  .object({
    title: z.string().min(1, 'O título é obrigatório'),
    description: z.string().optional(),
    action_type: z.enum(['UPLOAD', 'EMAIL', 'GENERATE_DOC', 'MANUAL'], {
      message: 'Tipo de acção inválido',
    }),
    is_mandatory: z.boolean().default(true),
    sla_days: z.number().int().positive().optional(),
    assigned_role: z.string().optional(),
    config: z.record(z.string(), z.any()).default({}),
    order_index: z.number().int().min(0),
  })
  .refine(
    (task) => {
      // Validar config baseado no action_type
      if (task.action_type === 'UPLOAD') {
        return !!task.config?.doc_type_id
      }
      if (task.action_type === 'EMAIL') {
        return !!task.config?.email_library_id
      }
      if (task.action_type === 'GENERATE_DOC') {
        return !!task.config?.doc_library_id
      }
      return true
    },
    {
      message:
        'Config inválido para o tipo de acção (falta doc_type_id, email_library_id ou doc_library_id)',
      path: ['config'],
    }
  )

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
export type TaskFormData = z.infer<typeof taskSchema>
export type StageFormData = z.infer<typeof stageSchema>
export type TemplateFormData = z.infer<typeof templateSchema>
