"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { Braces } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// ── Tipos ──

export interface VariableItem {
  key: string
  label: string
  category: string
  color: string
  sampleValue?: string
}

interface VariablePickerProps {
  onSelect: (variable: VariableItem) => void
  additionalVariables?: VariableItem[]
  compact?: boolean
}

// ── Labels PT-PT das categorias ──

const CATEGORY_LABELS: Record<string, string> = {
  consultor: "Consultor",
  imovel: "Imóvel",
  proprietario: "Proprietário",
  processo: "Processo",
  sistema: "Sistema",
  lead: "Lead",
  negocio: "Negócio",
  webhook: "Webhook",
}

// ── Ordem de exibição das categorias ──

const CATEGORY_ORDER: Record<string, number> = {
  lead: 0,
  imovel: 1,
  consultor: 2,
  proprietario: 3,
  negocio: 4,
  processo: 5,
  sistema: 6,
  webhook: 7,
}

// ── Componente ──

export function VariablePicker({
  onSelect,
  additionalVariables,
  compact = false,
}: VariablePickerProps) {
  const [open, setOpen] = useState(false)
  const [systemVariables, setSystemVariables] = useState<VariableItem[]>([])
  const [loading, setLoading] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Find the closest Sheet/Dialog container to portal the popover inside it
  // This prevents the Sheet overlay from blocking pointer events on the popover
  const getPortalContainer = useCallback(() => {
    if (!triggerRef.current) return undefined
    const dialog =
      triggerRef.current.closest("[data-slot='sheet-content']") ??
      triggerRef.current.closest("[data-radix-dialog-content]") ??
      triggerRef.current.closest("[role='dialog']")
    return (dialog as HTMLElement) ?? undefined
  }, [])

  // Carregar variáveis do sistema ao montar
  useEffect(() => {
    let cancelled = false

    async function loadVariables() {
      setLoading(true)
      try {
        const res = await fetch("/api/automacao/variaveis")
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setSystemVariables(data)
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadVariables()
    return () => { cancelled = true }
  }, [])

  // Combinar variáveis do sistema com adicionais (webhook, etc.)
  const allVariables = useMemo(() => {
    const combined = [...systemVariables]
    if (additionalVariables) {
      combined.push(...additionalVariables)
    }
    return combined
  }, [systemVariables, additionalVariables])

  // Agrupar por categoria, ordenadas
  const grouped = useMemo(() => {
    const groups: Record<string, VariableItem[]> = {}
    for (const v of allVariables) {
      if (!groups[v.category]) groups[v.category] = []
      groups[v.category].push(v)
    }
    return Object.entries(groups).sort(
      ([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)
    )
  }, [allVariables])

  function handleSelect(variable: VariableItem) {
    onSelect(variable)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Inserir variável"
          >
            <Braces className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button ref={triggerRef} variant="outline" size="sm" className="gap-1.5">
            <Braces className="h-3 w-3" />
            Variável
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        side="left"
        sideOffset={8}
        container={open ? getPortalContainer() : undefined}
      >
        <Command>
          <CommandInput placeholder="Pesquisar variável..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {loading ? "A carregar..." : "Nenhuma variável encontrada."}
            </CommandEmpty>
            {grouped.map(([category, variables]) => (
              <CommandGroup
                key={category}
                heading={CATEGORY_LABELS[category] ?? category}
              >
                {variables.map((v) => (
                  <CommandItem
                    key={v.key}
                    value={`${v.label} ${v.key}`}
                    onSelect={() => handleSelect(v)}
                    className="flex items-center justify-between gap-2"
                  >
                    <Badge
                      variant="outline"
                      className="font-normal text-xs"
                      style={{
                        borderColor: v.color,
                        color: v.color,
                        backgroundColor: `${v.color}10`,
                      }}
                    >
                      {v.label}
                    </Badge>
                    {v.sampleValue && (
                      <span className="text-muted-foreground text-xs truncate max-w-[120px]">
                        {v.sampleValue}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
