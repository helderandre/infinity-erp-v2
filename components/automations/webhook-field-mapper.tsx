"use client"

import { useCallback, useMemo, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WebhookFieldMapping } from "@/lib/types/automation-flow"
import { extractAllPaths } from "@/lib/webhook-mapping"

// ── Props ──

interface WebhookFieldMapperProps {
  payload: Record<string, unknown>
  mappings: WebhookFieldMapping[]
  onMappingsChange: (mappings: WebhookFieldMapping[]) => void
}

// ── Labels PT-PT for common fields ──

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  full_name: "Nome Completo",
  first_name: "Primeiro Nome",
  last_name: "Apelido",
  email: "Email",
  phone: "Telefone",
  phone_number: "Telefone",
  phone_local_code: "Indicativo",
  address: "Morada",
  city: "Cidade",
  state: "Estado/Distrito",
  country: "Pais",
  zip: "Codigo Postal",
  zipcode: "Codigo Postal",
  postal_code: "Codigo Postal",
  complement: "Complemento",
  neighborhood: "Bairro/Zona",
  number: "Numero",
  document: "Documento",
  doc: "Documento",
  status: "Estado",
  code: "Codigo",
  price: "Preco",
  value: "Valor",
  date: "Data",
  created_at: "Data de Criacao",
  creation_date: "Data de Criacao",
  approved_date: "Data de Aprovacao",
  warranty_expire_date: "Validade Garantia",
  event: "Evento",
  version: "Versao",
  currency: "Moeda",
  currency_value: "Valor Moeda",
  offer_code: "Codigo Oferta",
  quantity: "Quantidade",
  description: "Descricao",
  title: "Titulo",
  subject: "Assunto",
  message: "Mensagem",
  type: "Tipo",
  source: "Origem",
  notes: "Notas",
  company: "Empresa",
  website: "Website",
  url: "URL",
  id: "ID",
  plan: "Plano",
  coupon: "Cupao",
}

// ── Group icons by keyword detection ──

const GROUP_DETECTION: Array<{ keywords: string[]; icon: string; label: string }> = [
  { keywords: ["buyer", "customer", "user", "client", "contact", "subscriber", "lead"], icon: "\ud83d\udc64", label: "Contacto" },
  { keywords: ["product", "item", "offer"], icon: "\ud83d\udce6", label: "Produto" },
  { keywords: ["purchase", "order", "payment", "transaction", "checkout"], icon: "\ud83d\udcb0", label: "Compra" },
  { keywords: ["subscription", "plan", "recurrence"], icon: "\ud83d\udd04", label: "Subscricao" },
  { keywords: ["address", "shipping", "billing", "location"], icon: "\ud83d\udccd", label: "Morada" },
  { keywords: ["producer", "seller", "vendor", "affiliate"], icon: "\ud83c\udfed", label: "Produtor" },
  { keywords: ["commission", "comission"], icon: "\ud83d\udcca", label: "Comissao" },
  { keywords: ["tracking", "utm"], icon: "\ud83d\udcce", label: "Rastreamento" },
]

// ── Grouping logic ──

interface FieldInfo {
  path: string
  value: unknown
  type: string
  /** Last segment of the path (the actual field name) */
  fieldName: string
  /** Friendly PT label */
  friendlyLabel: string
}

interface FieldGroup {
  /** Group key, e.g. "data.buyer" or "" for root */
  groupPath: string
  /** Friendly group label */
  label: string
  /** Icon emoji */
  icon: string
  /** Leaf fields in this group */
  fields: FieldInfo[]
  /** Sub-objects that can be expanded */
  subGroups: FieldGroup[]
}

function getFriendlyLabel(fieldName: string): string {
  const lower = fieldName.toLowerCase()
  if (FIELD_LABELS[lower]) return FIELD_LABELS[lower]
  // Convert snake_case / camelCase to readable
  return fieldName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
}

function detectGroupInfo(groupKey: string): { icon: string; label: string } {
  const lower = groupKey.toLowerCase()
  for (const g of GROUP_DETECTION) {
    if (g.keywords.some((kw) => lower.includes(kw))) {
      return { icon: g.icon, label: g.label }
    }
  }
  // Fallback: capitalize last segment
  const lastSegment = groupKey.split(".").pop() || groupKey
  return { icon: "\ud83d\udcc1", label: getFriendlyLabel(lastSegment) }
}

function groupPayloadFields(
  payload: Record<string, unknown>
): FieldGroup[] {
  const allPaths = extractAllPaths(payload)
  const leafPaths = allPaths.filter((f) => f.type !== "object" && f.type !== "array")

  // Group by 2-level prefix: "data.buyer.name" -> "data.buyer"
  const groupMap = new Map<string, FieldInfo[]>()

  for (const field of leafPaths) {
    const parts = field.path.split(".")
    let groupKey: string
    if (parts.length <= 1) {
      groupKey = ""
    } else if (parts.length === 2) {
      groupKey = parts[0]
    } else {
      // Use first 2 segments as group key
      groupKey = parts.slice(0, 2).join(".")
    }

    const fieldName = parts[parts.length - 1]
    const existing = groupMap.get(groupKey) || []
    existing.push({
      path: field.path,
      value: field.value,
      type: field.type,
      fieldName,
      friendlyLabel: getFriendlyLabel(fieldName),
    })
    groupMap.set(groupKey, existing)
  }

  // Convert to FieldGroup[]
  const groups: FieldGroup[] = []
  for (const [groupPath, fields] of groupMap) {
    const info = groupPath
      ? detectGroupInfo(groupPath)
      : { icon: "\u2699\ufe0f", label: "Sistema" }
    groups.push({
      groupPath,
      label: info.label,
      icon: info.icon,
      fields,
      subGroups: [],
    })
  }

  return groups
}

function truncateValue(value: unknown, maxLen = 28): string {
  if (value === null || value === undefined) return "null"
  if (typeof value === "object") return Array.isArray(value) ? `[${(value as unknown[]).length}]` : "{...}"
  const str = String(value)
  return str.length > maxLen ? str.slice(0, maxLen) + "\u2026" : str
}

function generateVariableKey(path: string): string {
  const lastPart = path.split(".").pop() || path
  return `wh_${lastPart.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
}

// ── Component ──

export function WebhookFieldMapper({
  payload,
  mappings,
  onMappingsChange,
}: WebhookFieldMapperProps) {
  const groups = useMemo(() => groupPayloadFields(payload), [payload])

  const mappingsByPath = useMemo(() => {
    const map = new Map<string, WebhookFieldMapping>()
    for (const m of mappings) map.set(m.webhookPath, m)
    return map
  }, [mappings])

  const toggleField = useCallback(
    (path: string) => {
      const existing = mappingsByPath.get(path)
      if (existing) {
        onMappingsChange(mappings.filter((m) => m.webhookPath !== path))
      } else {
        const key = generateVariableKey(path)
        const usedKeys = new Set(mappings.map((m) => m.variableKey))
        let finalKey = key
        let i = 2
        while (usedKeys.has(finalKey)) {
          finalKey = `${key}_${i}`
          i++
        }
        onMappingsChange([...mappings, { webhookPath: path, variableKey: finalKey, transform: "trim" }])
      }
    },
    [mappings, mappingsByPath, onMappingsChange]
  )

  const updateVariableKey = useCallback(
    (path: string, newKey: string) => {
      onMappingsChange(
        mappings.map((m) =>
          m.webhookPath === path ? { ...m, variableKey: newKey } : m
        )
      )
    },
    [mappings, onMappingsChange]
  )

  const selectedCount = mappings.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Que dados queres usar neste fluxo?
        </p>
        {selectedCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selectedCount} campo{selectedCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Selecciona os campos que precisas. Cada campo seleccionado cria uma variavel para usar nos passos seguintes.
      </p>

      <div className="space-y-2">
        {groups.map((group) => (
          <FieldGroupCard
            key={group.groupPath}
            group={group}
            mappingsByPath={mappingsByPath}
            onToggle={toggleField}
            onUpdateKey={updateVariableKey}
          />
        ))}
      </div>
    </div>
  )
}

// ── Group Card ──

function FieldGroupCard({
  group,
  mappingsByPath,
  onToggle,
  onUpdateKey,
}: {
  group: FieldGroup
  mappingsByPath: Map<string, WebhookFieldMapping>
  onToggle: (path: string) => void
  onUpdateKey: (path: string, newKey: string) => void
}) {
  const [open, setOpen] = useState(true)
  const selectedInGroup = group.fields.filter((f) => mappingsByPath.has(f.path)).length

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
          <span className="text-base">{group.icon}</span>
          <span className="text-sm font-medium flex-1">
            {group.label}
            {group.groupPath && (
              <span className="text-muted-foreground font-normal ml-1.5 text-xs">
                ({group.groupPath})
              </span>
            )}
          </span>
          {selectedInGroup > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600 bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:bg-orange-950/30"
            >
              {selectedInGroup}
            </Badge>
          )}
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0.5 pt-1 pl-2">
          {group.fields.map((field) => (
            <FieldRow
              key={field.path}
              field={field}
              mapping={mappingsByPath.get(field.path)}
              onToggle={() => onToggle(field.path)}
              onUpdateKey={(newKey) => onUpdateKey(field.path, newKey)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Field Row ──

function FieldRow({
  field,
  mapping,
  onToggle,
  onUpdateKey,
}: {
  field: FieldInfo
  mapping: WebhookFieldMapping | undefined
  onToggle: () => void
  onUpdateKey: (newKey: string) => void
}) {
  const isChecked = !!mapping
  const [editingKey, setEditingKey] = useState(false)

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
        isChecked ? "bg-orange-50/60 dark:bg-orange-950/20" : "hover:bg-muted/30"
      )}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={onToggle}
        className="h-4 w-4 shrink-0"
      />

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium truncate min-w-[80px]">
          {field.friendlyLabel}
        </span>
        <span className="text-xs text-muted-foreground truncate flex-1" title={String(field.value ?? "")}>
          {truncateValue(field.value)}
        </span>
      </div>

      {isChecked && mapping && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground">&rarr;</span>
          {editingKey ? (
            <Input
              value={mapping.variableKey}
              onChange={(e) => onUpdateKey(e.target.value)}
              onBlur={() => setEditingKey(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditingKey(false)
              }}
              className="h-6 text-xs px-1.5 w-28 font-mono"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingKey(true)}
              className="text-xs font-mono text-orange-600 dark:text-orange-400 hover:underline px-1"
              title="Clica para editar o nome da variavel"
            >
              {mapping.variableKey}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
