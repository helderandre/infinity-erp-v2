import { z } from 'zod'

// Schema para uma subtarefa do template (novo modelo com type)
export const subtaskSchema = z
  .object({
    _local_id: z.string().optional(), // ID local para mapeamento de dependências
    title: z.string().min(1, 'O título é obrigatório'),
    description: z.string().optional(),
    is_mandatory: z.boolean().default(true),
    order_index: z.number().int().min(0),
    type: z.enum(['upload', 'checklist', 'email', 'generate_doc', 'form', 'field'], {
      message: 'Tipo de subtarefa inválido',
    }),
    // Prazo, responsável, prioridade
    sla_days: z.number().int().positive().optional(),
    assigned_role: z.string().optional(),
    priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
    // Dependências (bloqueio)
    dependency_type: z.enum(['none', 'subtask', 'task']).default('none'),
    dependency_subtask_id: z.string().nullable().optional(),
    dependency_task_id: z.string().nullable().optional(),
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
        // Form config (type === 'form')
        form_template_id: z.string().optional(),
        form_title: z.string().optional(),
        sections: z.array(z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          order_index: z.number().int().min(0),
          fields: z.array(z.object({
            field_name: z.string().min(1),
            label: z.string().min(1),
            field_type: z.enum([
              'text', 'textarea', 'rich_text', 'number', 'currency', 'percentage',
              'select', 'multiselect', 'checkbox', 'date', 'email', 'phone',
              'address_map', 'media_upload',
            ]),
            target_entity: z.enum([
              'property', 'property_specs', 'property_internal',
              'owner', 'property_owner',
            ]),
            required: z.boolean().optional(),
            help_text: z.string().optional(),
            placeholder: z.string().optional(),
            options: z.array(z.object({
              value: z.string(),
              label: z.string(),
            })).optional(),
            options_from_constant: z.string().optional(),
            min: z.number().optional(),
            max: z.number().optional(),
            width: z.enum(['full', 'half', 'third']).optional(),
            order_index: z.number().int().min(0),
          })).min(1),
        })).optional(),
        // Field config (type === 'field')
        field: z.object({
          field_name: z.string().min(1),
          label: z.string().min(1),
          field_type: z.enum([
            'text', 'textarea', 'rich_text', 'number', 'currency', 'percentage',
            'select', 'multiselect', 'checkbox', 'date', 'email', 'phone',
            'address_map', 'media_upload',
          ]),
          target_entity: z.enum([
            'property', 'property_specs', 'property_internal',
            'owner', 'property_owner',
          ]),
          required: z.boolean().optional(),
          help_text: z.string().optional(),
          placeholder: z.string().optional(),
          options: z.array(z.object({
            value: z.string(),
            label: z.string(),
          })).optional(),
          options_from_constant: z.string().optional(),
          min: z.number().optional(),
          max: z.number().optional(),
          width: z.enum(['full', 'half', 'third']).optional(),
          order_index: z.number().int().min(0),
        }).optional(),
        show_current_value: z.boolean().optional(),
        auto_complete_on_save: z.boolean().optional(),
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
      // Form: precisa de form_template_id OU sections com pelo menos 1 campo
      // Nota: aceita form_template_id vazio (pending selection) ou sections vazias (config em progresso)
      if (subtask.type === 'form') {
        if (subtask.config?.form_template_id !== undefined) return true
        const sections = subtask.config?.sections
        if (!sections || sections.length === 0) return true // permitir guardar sem config (será configurado depois)
        return sections.every(s => s.fields.length > 0)
      }
      // Field: precisa de campo com field_name e target_entity (ou vazio — será configurado depois)
      if (subtask.type === 'field') {
        const field = subtask.config?.field
        if (!field) return true // permitir guardar sem config (será configurado depois)
        return !!field.field_name && !!field.target_entity && !!field.field_type
      }
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
  _local_id: z.string().optional(), // ID local para mapeamento de dependências
  title: z.string().min(1, 'O título é obrigatório'),
  description: z.string().optional(),
  is_mandatory: z.boolean().default(true),
  priority: z.enum(['urgent', 'normal', 'low']).default('normal'),
  sla_days: z.number().int().positive().optional(),
  assigned_role: z.string().optional(),
  order_index: z.number().int().min(0),
  subtasks: z.array(subtaskSchema).default([]),
  // Dependência entre tarefas (bloqueio)
  dependency_task_id: z.string().nullable().optional(),
  // Config da tarefa (alertas, etc.)
  config: z.record(z.string(), z.unknown()).optional(),
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
  process_type: z.enum(['angariacao', 'negocio'], {
    message: 'Tipo de processo obrigatório',
  }),
  stages: z
    .array(stageSchema)
    .min(1, 'O template deve ter pelo menos uma fase'),
})

// Types inferidos
export type SubtaskFormData = z.infer<typeof subtaskSchema>
export type TaskFormData = z.infer<typeof taskSchema>
export type StageFormData = z.infer<typeof stageSchema>
export type TemplateFormData = z.infer<typeof templateSchema>
