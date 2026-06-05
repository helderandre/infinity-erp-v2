export type MetaDatePreset =
  | "last_7d"
  | "last_14d"
  | "last_30d"
  | "last_90d"
  | "this_month"
  | "last_month"
  | "maximum"

export const META_DATE_PRESETS: { key: MetaDatePreset; label: string }[] = [
  { key: "last_7d",    label: "7 dias" },
  { key: "last_14d",   label: "14 dias" },
  { key: "last_30d",   label: "30 dias" },
  { key: "last_90d",   label: "90 dias" },
  { key: "this_month", label: "Este mês" },
  { key: "last_month", label: "Último mês" },
  { key: "maximum",    label: "Tudo" },
]

export function isValidDatePreset(value: string): value is MetaDatePreset {
  return META_DATE_PRESETS.some((p) => p.key === value)
}
