import type { SupabaseClient } from "@supabase/supabase-js"
import type { ContactAutomationChannel, ContactAutomationEventType } from "@/types/contact-automation"
import { EVENT_TYPE_TO_CATEGORY } from "@/lib/constants-template-categories"

export type TemplateCascadeLayer = "lead" | "consultant" | "global"

export interface ResolveTemplateArgs {
  leadId: string
  agentId: string | null
  eventType: ContactAutomationEventType
  channel: ContactAutomationChannel
}

export interface ResolvedTemplate {
  templateId: string
  layer: TemplateCascadeLayer
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>

export async function resolveTemplateForLead(
  supabase: AnySupabase,
  args: ResolveTemplateArgs,
): Promise<ResolvedTemplate | null> {
  const { leadId, agentId, eventType, channel } = args
  const table = channel === "email" ? "tpl_email_library" : "auto_wpp_templates"
  const category = EVENT_TYPE_TO_CATEGORY[eventType]

  // Layer 1: lead assignment
  const assignmentCol = channel === "email" ? "email_template_id" : "wpp_template_id"
  const { data: assignment } = await supabase
    .from("contact_automation_lead_settings")
    .select(assignmentCol)
    .eq("lead_id", leadId)
    .eq("event_type", eventType)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignedId = (assignment as any)?.[assignmentCol] as string | null | undefined
  if (assignedId) {
    // confirm the assigned template is still active & accessible
    const { data: confirmed } = await supabase
      .from(table)
      .select("id,is_active,scope,scope_id")
      .eq("id", assignedId)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = confirmed as any
    if (t && t.is_active === true) {
      if (t.scope === "global") return { templateId: t.id, layer: "lead" }
      if (t.scope === "consultant" && t.scope_id === agentId) return { templateId: t.id, layer: "lead" }
    }
    // fall through to cascade if assignment is no longer valid
  }

  // Layer 2: consultant-scoped
  if (agentId) {
    const { data: consultantTpl } = await supabase
      .from(table)
      .select("id")
      .eq("scope", "consultant")
      .eq("scope_id", agentId)
      .eq("category", category)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = consultantTpl as any
    if (t?.id) return { templateId: t.id, layer: "consultant" }
  }

  // Layer 3: global
  const { data: globalTpl } = await supabase
    .from(table)
    .select("id")
    .eq("scope", "global")
    .eq("category", category)
    .eq("is_active", true)
    .order("is_system", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalTpl as any
  if (g?.id) return { templateId: g.id, layer: "global" }

  return null
}
