import { z } from 'zod'

export const emailTemplateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  subject: z.string().min(1, 'Assunto é obrigatório'),
  description: z.string().optional(),
  body_html: z.string().min(1, 'Corpo do email é obrigatório'),
  editor_state: z.any().optional(),
})

export const emailTemplateUpdateSchema = emailTemplateSchema.partial()

export type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>
