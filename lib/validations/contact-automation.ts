import { z } from "zod"
import { CONTACT_AUTOMATION_EVENT_TYPES } from "@/types/contact-automation"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid = z.string().regex(UUID_REGEX, "UUID inválido")

const festividadeConfigSchema = z.object({
  label: z.string().min(1).max(120),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
})

const channelsSchema = z
  .array(z.enum(["email", "whatsapp"]))
  .min(1, "Escolhe pelo menos um canal")
  .max(2)

const emailOverrideSchema = z.object({
  subject: z.string().min(1).max(300).optional(),
  body_html: z.string().min(1).optional(),
})

const whatsappMessageSchema = z
  .object({
    type: z.enum(["text", "image", "video", "audio", "ptt", "document", "poll", "contact"]),
    content: z.string().default(""),
    mediaUrl: z.string().optional(),
    docName: z.string().optional(),
    delay: z.number().int().min(0).max(3600).optional(),
    pollOptions: z.array(z.string()).optional(),
    pollSelectableCount: z.number().int().min(1).optional(),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactOrganization: z.string().optional(),
    contactEmail: z.string().optional(),
  })
  .passthrough()

const templateOverridesSchema = z.object({
  email: emailOverrideSchema.optional(),
  whatsapp: z.object({ messages: z.array(whatsappMessageSchema).optional() }).optional(),
})

const baseFields = {
  deal_id: uuid.nullable().optional(),
  email_template_id: uuid.nullable().optional(),
  wpp_template_id: uuid.nullable().optional(),
  smtp_account_id: uuid.nullable().optional(),
  wpp_instance_id: uuid.nullable().optional(),
  template_overrides: templateOverridesSchema.optional().default({}),
  recurrence: z.enum(["once", "yearly"]),
  send_hour: z.number().int().min(0).max(23).default(8),
  timezone: z.string().default("Europe/Lisbon"),
  channels: channelsSchema,
}

const eventConfigSchema = z.discriminatedUnion("event_type", [
  z.object({
    event_type: z.literal("aniversario_contacto"),
    event_config: z.object({}).optional().default({}),
  }),
  z.object({
    event_type: z.literal("aniversario_fecho"),
    event_config: z.object({}).optional().default({}),
    deal_id: uuid,
  }),
  z.object({
    event_type: z.literal("natal"),
    event_config: z.object({}).optional().default({}),
  }),
  z.object({
    event_type: z.literal("ano_novo"),
    event_config: z.object({}).optional().default({}),
  }),
  z.object({
    event_type: z.literal("festividade"),
    event_config: festividadeConfigSchema,
  }),
])

const validateChannelRequirements = (data: {
  channels: ("email" | "whatsapp")[]
  email_template_id?: string | null
  wpp_template_id?: string | null
  smtp_account_id?: string | null
  wpp_instance_id?: string | null
  template_overrides?: z.infer<typeof templateOverridesSchema>
}) => {
  const issues: { path: string[]; message: string }[] = []
  if (data.channels.includes("email")) {
    if (!data.email_template_id && !data.template_overrides?.email?.body_html) {
      issues.push({
        path: ["email_template_id"],
        message: "Canal email requer template ou override de corpo",
      })
    }
    if (!data.smtp_account_id) {
      issues.push({ path: ["smtp_account_id"], message: "Canal email requer conta SMTP" })
    }
  }
  if (data.channels.includes("whatsapp")) {
    if (!data.wpp_template_id && !data.template_overrides?.whatsapp?.messages?.length) {
      issues.push({
        path: ["wpp_template_id"],
        message: "Canal WhatsApp requer template ou mensagens inline",
      })
    }
    if (!data.wpp_instance_id) {
      issues.push({
        path: ["wpp_instance_id"],
        message: "Canal WhatsApp requer instância conectada",
      })
    }
  }
  return issues
}

export const createContactAutomationSchema = z
  .intersection(z.object(baseFields), eventConfigSchema)
  .superRefine((data, ctx) => {
    const issues = validateChannelRequirements({
      channels: data.channels,
      email_template_id: data.email_template_id ?? null,
      wpp_template_id: data.wpp_template_id ?? null,
      smtp_account_id: data.smtp_account_id ?? null,
      wpp_instance_id: data.wpp_instance_id ?? null,
      template_overrides: data.template_overrides,
    })
    for (const issue of issues) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: issue.path, message: issue.message })
    }
  })

export const patchContactAutomationSchema = z
  .object({
    channels: channelsSchema.optional(),
    email_template_id: uuid.nullable().optional(),
    wpp_template_id: uuid.nullable().optional(),
    smtp_account_id: uuid.nullable().optional(),
    wpp_instance_id: uuid.nullable().optional(),
    template_overrides: templateOverridesSchema.optional(),
    recurrence: z.enum(["once", "yearly"]).optional(),
    send_hour: z.number().int().min(0).max(23).optional(),
    timezone: z.string().optional(),
    event_config: festividadeConfigSchema.partial().optional(),
    trigger_at: z.string().datetime({ offset: true }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para actualizar" })

export type CreateContactAutomationInput = z.infer<typeof createContactAutomationSchema>
export type PatchContactAutomationInput = z.infer<typeof patchContactAutomationSchema>
