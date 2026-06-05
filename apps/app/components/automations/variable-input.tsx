"use client"

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react"
import { Input } from "@/components/ui/input"
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
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import type { VariableItem } from "@/components/automations/variable-picker"

// ── Categorias PT-PT ──

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

interface VariableInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  variables: VariableItem[]
  className?: string
}

/**
 * Input field with @ trigger for variable insertion.
 * When user types @, a dropdown appears with available variables.
 * On select, inserts {{variable_key}} at the cursor position.
 */
export function VariableInput({
  value,
  onChange,
  placeholder,
  variables,
  className,
}: VariableInputProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const cursorPosRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Portal inside the closest Sheet/Dialog so the overlay doesn't block pointer events
  const getPortalContainer = useCallback(() => {
    if (!inputRef.current) return undefined
    const dialog =
      inputRef.current.closest("[data-slot='sheet-content']") ??
      inputRef.current.closest("[data-radix-dialog-content]") ??
      inputRef.current.closest("[role='dialog']")
    return (dialog as HTMLElement) ?? undefined
  }, [])

  // Group variables by category
  const grouped = useMemo(() => {
    const groups: Record<string, VariableItem[]> = {}
    for (const v of variables) {
      if (!groups[v.category]) groups[v.category] = []
      groups[v.category].push(v)
    }
    return Object.entries(groups).sort(
      ([a], [b]) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)
    )
  }, [variables])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "@") {
        e.preventDefault()
        cursorPosRef.current = e.currentTarget.selectionStart ?? value.length
        setSearch("")
        setOpen(true)
      }
    },
    [value.length]
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  const handleSelect = useCallback(
    (variable: VariableItem) => {
      const pos = cursorPosRef.current
      const before = value.slice(0, pos)
      const after = value.slice(pos)
      onChange(before + `{{${variable.key}}}` + after)
      setOpen(false)

      // Refocus input after selection
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          const newPos = pos + `{{${variable.key}}}`.length
          inputRef.current.setSelectionRange(newPos, newPos)
        }
      })
    },
    [value, onChange]
  )

  // Close on escape
  useEffect(() => {
    if (!open) return
    function onEsc(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        sideOffset={4}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        container={open ? getPortalContainer() : undefined}
      >
        <Command>
          <CommandInput
            placeholder="Pesquisar variável..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[250px]">
            <CommandEmpty>Nenhuma variável encontrada.</CommandEmpty>
            {grouped.map(([category, vars]) => (
              <CommandGroup
                key={category}
                heading={CATEGORY_LABELS[category] ?? category}
              >
                {vars.map((v) => (
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
