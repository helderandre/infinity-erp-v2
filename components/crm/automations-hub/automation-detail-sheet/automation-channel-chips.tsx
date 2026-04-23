"use client"

import { AlertCircle, Mail, MessageCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { AUTOMATION_SHEET_COPY } from "@/lib/constants-automations"
import type { ChannelEffectiveState } from "@/types/custom-event"

interface Props {
  email: ChannelEffectiveState
  whatsapp: ChannelEffectiveState
  compact?: boolean
  className?: string
}

const STATE_LABELS: Record<ChannelEffectiveState, string> = {
  active: "Activo",
  unavailable: "Indisponível",
  off: "Desligado",
}

function chipClass(state: ChannelEffectiveState) {
  if (state === "active") {
    return "bg-primary/10 text-primary border-primary/30"
  }
  if (state === "unavailable") {
    return "bg-destructive/10 text-destructive border-destructive/30"
  }
  return "bg-transparent text-muted-foreground border-border/50"
}

export function AutomationChannelChips({ email, whatsapp, compact = false, className }: Props) {
  const copy = AUTOMATION_SHEET_COPY.channels

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex items-center gap-1.5", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                chipClass(email),
                compact && "px-1.5 text-[11px]",
              )}
              aria-label={`${copy.email}: ${STATE_LABELS[email]}`}
            >
              <Mail className="h-3 w-3 shrink-0" />
              <span>{copy.email}</span>
              {email === "unavailable" && <AlertCircle className="h-2.5 w-2.5 shrink-0" />}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-xs">
            {email === "active"
              ? copy.emailActive
              : email === "unavailable"
                ? copy.emailUnavailable
                : copy.emailOff}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                chipClass(whatsapp),
                compact && "px-1.5 text-[11px]",
              )}
              aria-label={`${copy.whatsapp}: ${STATE_LABELS[whatsapp]}`}
            >
              <MessageCircle className="h-3 w-3 shrink-0" />
              <span>{copy.whatsapp}</span>
              {whatsapp === "unavailable" && <AlertCircle className="h-2.5 w-2.5 shrink-0" />}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-xs">
            {whatsapp === "active"
              ? copy.whatsappActive
              : whatsapp === "unavailable"
                ? copy.whatsappUnavailable
                : copy.whatsappOff}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
