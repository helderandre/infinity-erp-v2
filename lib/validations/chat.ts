import { z } from 'zod'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const chatMessageSchema = z.object({
  // Conteúdo pode ser vazio — mensagens só com imagem/anexo têm content=''.
  // O bubble esconde o bloco de texto quando content é falsy. O schema
  // de edição (em [messageId]/route.ts) mantém min(1) — não suportamos
  // editar uma mensagem para ficar vazia.
  content: z.string().max(10000).default(''),
  mentions: z.array(
    z.object({
      user_id: z.string().regex(uuidRegex, 'UUID inválido'),
      display_name: z.string(),
    })
  ).default([]),
  parent_message_id: z.string().regex(uuidRegex).nullable().optional(),
})

export const chatReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
})

export const chatReadReceiptSchema = z.object({
  last_read_message_id: z.string().regex(uuidRegex),
})

export type ChatMessageFormData = z.infer<typeof chatMessageSchema>
export type ChatReactionFormData = z.infer<typeof chatReactionSchema>
