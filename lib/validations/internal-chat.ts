import { z } from 'zod'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const sendInternalMessageSchema = z.object({
  content: z.string()
    .min(1, 'Mensagem não pode estar vazia')
    .max(10000),
  mentions: z.array(
    z.object({
      user_id: z.string().regex(uuidRegex, 'UUID inválido'),
      display_name: z.string(),
    })
  ).default([]),
  parent_message_id: z.string().regex(uuidRegex).nullable().optional(),
  /** Canal alvo. Default no handler para o canal global. */
  channel_id: z.string().regex(uuidRegex).optional(),
  /** Destinatário da DM — obrigatório se channel_id for diferente do canal
   *  global e o canal ainda não existir; usado para criar a membership. */
  dm_recipient_id: z.string().regex(uuidRegex).nullable().optional(),
})

export const editInternalMessageSchema = z.object({
  content: z.string()
    .min(1, 'Mensagem não pode estar vazia')
    .max(10000),
})

export const toggleInternalReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
})

export const internalReadReceiptSchema = z.object({
  last_read_message_id: z.string().regex(uuidRegex),
  channel_id: z.string().regex(uuidRegex).optional(),
})

export type SendInternalMessageData = z.infer<typeof sendInternalMessageSchema>
export type EditInternalMessageData = z.infer<typeof editInternalMessageSchema>
export type ToggleInternalReactionData = z.infer<typeof toggleInternalReactionSchema>
