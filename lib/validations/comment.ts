import { z } from 'zod'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const commentSchema = z.object({
  content: z.string().min(1, 'Comentário não pode estar vazio').max(5000),
  mentions: z
    .array(
      z.object({
        user_id: z.string().regex(uuidRegex, 'UUID inválido'),
        display_name: z.string(),
      })
    )
    .default([]),
})

export type CommentFormData = z.infer<typeof commentSchema>
