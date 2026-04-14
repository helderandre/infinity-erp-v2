import type { ContactAutomationEventType } from "@/types/contact-automation"

export const TEMPLATE_CATEGORY_VALUES = [
  "aniversario_contacto",
  "aniversario_fecho",
  "natal",
  "ano_novo",
  "festividade",
  "custom",
  "geral",
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORY_VALUES)[number]

export const TEMPLATE_CATEGORY_LABELS_PT: Record<TemplateCategory, string> = {
  aniversario_contacto: "Aniversário do contacto",
  aniversario_fecho: "Aniversário de fecho",
  natal: "Natal",
  ano_novo: "Ano Novo",
  festividade: "Festividade",
  custom: "Personalizado",
  geral: "Geral",
}

export const EVENT_TYPE_TO_CATEGORY: Record<ContactAutomationEventType, TemplateCategory> = {
  aniversario_contacto: "aniversario_contacto",
  aniversario_fecho: "aniversario_fecho",
  natal: "natal",
  ano_novo: "ano_novo",
  festividade: "festividade",
}

export function getAllowedCategoriesForEvent(eventType: ContactAutomationEventType): TemplateCategory[] {
  const primary = EVENT_TYPE_TO_CATEGORY[eventType]
  if (eventType === "festividade") return [primary, "custom", "geral"]
  return [primary, "geral"]
}

export function normalizeCategory(value: string | null | undefined): TemplateCategory {
  if (!value) return "geral"
  return (TEMPLATE_CATEGORY_VALUES as readonly string[]).includes(value)
    ? (value as TemplateCategory)
    : "geral"
}
