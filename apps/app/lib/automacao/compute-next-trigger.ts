import { TZDate } from "@date-fns/tz"
import type {
  ContactAutomationEventConfig,
  ContactAutomationEventType,
} from "@/types/contact-automation"

interface ComputeNextTriggerArgs {
  eventType: ContactAutomationEventType
  eventConfig: ContactAutomationEventConfig
  sendHour: number
  timezone: string
  reference?: Date
  contactBirthday?: string | null
  dealClosingDate?: string | null
}

export class ContactAutomationComputeError extends Error {}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

function buildZoned(year: number, month1to12: number, day: number, hour: number, timezone: string): TZDate {
  const safeDay = Math.min(day, lastDayOfMonth(year, month1to12))
  return new TZDate(year, month1to12 - 1, safeDay, hour, 0, 0, 0, timezone)
}

function parseMonthDayFromISO(iso: string): { month: number; day: number } {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number)
  if (!y || !m || !d) throw new ContactAutomationComputeError(`Data inválida: ${iso}`)
  return { month: m, day: d }
}

export function computeNextTriggerAt(args: ComputeNextTriggerArgs): Date {
  const { eventType, eventConfig, sendHour, timezone } = args
  const ref = args.reference ?? new Date()
  const zonedRef = new TZDate(ref, timezone)
  const refYear = zonedRef.getFullYear()

  let month: number
  let day: number

  switch (eventType) {
    case "aniversario_contacto": {
      if (!args.contactBirthday) {
        throw new ContactAutomationComputeError("Contacto sem data de nascimento")
      }
      ;({ month, day } = parseMonthDayFromISO(args.contactBirthday))
      break
    }
    case "aniversario_fecho": {
      if (!args.dealClosingDate) {
        throw new ContactAutomationComputeError("Negócio sem data de fecho prevista")
      }
      ;({ month, day } = parseMonthDayFromISO(args.dealClosingDate))
      break
    }
    case "natal":
      month = 12
      day = 25
      break
    case "ano_novo":
      month = 1
      day = 1
      break
    case "festividade": {
      if (!eventConfig.month || !eventConfig.day) {
        throw new ContactAutomationComputeError("Festividade requer mês e dia")
      }
      month = eventConfig.month
      day = eventConfig.day
      break
    }
    default:
      throw new ContactAutomationComputeError(`Evento desconhecido: ${eventType}`)
  }

  let candidate = buildZoned(refYear, month, day, sendHour, timezone)
  if (candidate.getTime() <= ref.getTime()) {
    candidate = buildZoned(refYear + 1, month, day, sendHour, timezone)
  }
  return new Date(candidate.getTime())
}

export function addOneYear(date: Date, timezone: string, sendHour: number): Date {
  const zoned = new TZDate(date, timezone)
  const year = zoned.getFullYear() + 1
  const month = zoned.getMonth() + 1
  const day = zoned.getDate()
  return new Date(buildZoned(year, month, day, sendHour, timezone).getTime())
}
