import { z } from "zod"

export const customEventCreateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  description: z.string().max(500).optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD"),
  send_hour: z.number().int().min(0).max(23),
  is_recurring: z.boolean(),
  channels: z
    .array(z.enum(["email", "whatsapp"]))
    .min(1, "Seleccione pelo menos um canal"),
  email_template_id: z.string().uuid().optional().nullable(),
  wpp_template_id: z.string().uuid().optional().nullable(),
  smtp_account_id: z.string().uuid().optional().nullable(),
  wpp_instance_id: z.string().uuid().optional().nullable(),
})

export const customEventUpdateSchema = customEventCreateSchema.partial().extend({
  status: z.enum(["active", "paused", "archived"]).optional(),
})

export const customEventLeadsAddSchema = z.object({
  lead_ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
}).refine(
  (d) => (d.lead_ids && d.lead_ids.length > 0) || d.all === true,
  { message: "Forneça lead_ids ou all=true" },
)

export const customEventLeadsRemoveSchema = z.object({
  lead_ids: z.array(z.string().uuid()).min(1, "Forneça pelo menos um lead_id"),
})

export type CustomEventCreateInput = z.infer<typeof customEventCreateSchema>
export type CustomEventUpdateInput = z.infer<typeof customEventUpdateSchema>
