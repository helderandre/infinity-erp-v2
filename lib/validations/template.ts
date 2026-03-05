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
        // Campos de multiplicação por proprietário
        owner_scope: z.enum(['none', 'all_owners', 'main_contact_only']).optional(),
        person_type_filter: z.enum(['all', 'singular', 'coletiva']).optional(),
        has_person_type_variants: z.boolean().optional(),
        singular_config: z
          .object({
            doc_type_id: z.string().optional(),
            email_library_id: z.string().optional(),
            doc_library_id: z.string().optional(),
          })
          .optional(),
        coletiva_config: z
          .object({
            doc_type_id: z.string().optional(),
            email_library_id: z.string().optional(),
            doc_library_id: z.string().optional(),
          })
          .optional(),
      })
      .default({}),
  })
  .refine(
    (subtask) => {
      // Se tem variantes por tipo, a config base não é obrigatória
      if (subtask.config?.has_person_type_variants && subtask.config?.owner_scope && subtask.config.owner_scope !== 'none') {
        return true
      }
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
  .refine(
    (subtask) => {
      // Se has_person_type_variants está activo, validar que as variantes têm a config necessária por tipo
      if (!subtask.config?.has_person_type_variants) return true
      if (!subtask.config?.owner_scope || subtask.config.owner_scope === 'none') return true

      const type = subtask.type
      if (type === 'upload') {
        return (
          !!subtask.config.singular_config?.doc_type_id ||
          !!subtask.config.coletiva_config?.doc_type_id
        )
      }
      if (type === 'email') {
        return (
          !!subtask.config.singular_config?.email_library_id ||
          !!subtask.config.coletiva_config?.email_library_id
        )
      }
      if (type === 'generate_doc') {
        return (
          !!subtask.config.singular_config?.doc_library_id ||
          !!subtask.config.coletiva_config?.doc_library_id
        )
      }
      return true
    },
    {
      message: 'Quando variantes por tipo de pessoa estão activas, configure pelo menos uma variante',
      path: ['config'],
    }
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
