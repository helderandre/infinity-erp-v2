import { z } from 'zod'

// Schema para uma subtarefa do template
export const subtaskSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
  description: z.string().optional(),
  is_mandatory: z.boolean().default(true),
  order_index: z.number().int().min(0),
  config: z
    .object({
      check_type: z.enum(['field', 'document', 'manual']),
      field_name: z.string().optional(),
      doc_type_id: z.string().optional(),
    })
    .default({ check_type: 'manual' }),
})

// Schema para uma tarefa do template
export const taskSchema = z
  .object({
    title: z.string().min(1, 'O título é obrigatório'),
    description: z.string().optional(),
    action_type: z.enum(['UPLOAD', 'EMAIL', 'GENERATE_DOC', 'MANUAL', 'FORM'], {
      message: 'Tipo de acção inválido',
    }),
    is_mandatory: z.boolean().default(true),
    sla_days: z.number().int().positive().optional(),
    assigned_role: z.string().optional(),
    config: z.record(z.string(), z.any()).default({}),
    order_index: z.number().int().min(0),
    subtasks: z.array(subtaskSchema).optional(),
  })
  .refine(
    (task) => {
      // UPLOAD: doc_type_id obrigatório
      if (task.action_type === 'UPLOAD') {
        return !!task.config?.doc_type_id
      }
      // FORM: owner_type obrigatório no config
      if (task.action_type === 'FORM') {
        return !!task.config?.owner_type
      }
      // EMAIL e GENERATE_DOC: config opcional no MVP (bibliotecas vazias)
      // Será obrigatório quando M13 estiver implementado
      return true
    },
    {
      message: 'Config inválido para o tipo de acção',
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
export type SubtaskFormData = z.infer<typeof subtaskSchema>
export type TaskFormData = z.infer<typeof taskSchema>
export type StageFormData = z.infer<typeof stageSchema>
export type TemplateFormData = z.infer<typeof templateSchema>
