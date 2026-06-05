"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface WebhookJsonTreeProps {
  data: unknown
  initialExpanded?: boolean
}

export function WebhookJsonTree({
  data,
  initialExpanded = true,
}: WebhookJsonTreeProps) {
  return (
    <div className="font-mono text-xs overflow-auto max-h-64 rounded-md border bg-muted/30 p-2">
      <JsonNode value={data} path="" depth={0} defaultOpen={initialExpanded} />
    </div>
  )
}

function JsonNode({
  label,
  value,
  path,
  depth,
  defaultOpen,
}: {
  label?: string
  value: unknown
  path: string
  depth: number
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen && depth < 2)

  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 12 }}>
        {label && <span className="text-muted-foreground">{label}:</span>}
        <span className="text-orange-500 dark:text-orange-400">null</span>
      </div>
    )
  }

  if (typeof value === "boolean") {
    return (
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 12 }}>
        {label && <span className="text-muted-foreground">{label}:</span>}
        <span className="text-blue-600 dark:text-blue-400">{String(value)}</span>
      </div>
    )
  }

  if (typeof value === "number") {
    return (
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 12 }}>
        {label && <span className="text-muted-foreground">{label}:</span>}
        <span className="text-emerald-600 dark:text-emerald-400">{value}</span>
      </div>
    )
  }

  if (typeof value === "string") {
    return (
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 12 }}>
        {label && <span className="text-muted-foreground">{label}:</span>}
        <span className="text-amber-700 dark:text-amber-300">&quot;{value}&quot;</span>
      </div>
    )
  }

  if (Array.isArray(value)) {
    return (
      <div style={{ paddingLeft: depth * 12 }}>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-0.5 hover:text-foreground text-muted-foreground",
            open && "text-foreground"
          )}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {label && <span>{label}:</span>}
          <span className="text-muted-foreground/60">[{value.length}]</span>
        </button>
        {open && (
          <div>
            {value.map((item, i) => (
              <JsonNode
                key={i}
                label={String(i)}
                value={item}
                path={`${path}[${i}]`}
                depth={depth + 1}
                defaultOpen={depth < 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    return (
      <div style={{ paddingLeft: depth * 12 }}>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-0.5 hover:text-foreground text-muted-foreground",
            open && "text-foreground"
          )}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {label && <span>{label}:</span>}
          <span className="text-muted-foreground/60">{`{${entries.length}}`}</span>
        </button>
        {open && (
          <div>
            {entries.map(([key, val]) => (
              <JsonNode
                key={key}
                label={key}
                value={val}
                path={path ? `${path}.${key}` : key}
                depth={depth + 1}
                defaultOpen={depth < 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      {label && <span className="text-muted-foreground">{label}: </span>}
      <span>{String(value)}</span>
    </div>
  )
}
