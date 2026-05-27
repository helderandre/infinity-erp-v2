'use client'

/**
 * Reusable property picker — a searchable combobox over /api/properties.
 * Selecting a property reports {id, label}; the chosen value renders as a
 * removable chip. Shared by the Meta attribution panel and the lead-entry form.
 */

import { useEffect, useState } from 'react'
import { Building2, X, ChevronsUpDown, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDebounce } from '@/hooks/use-debounce'

interface PropertyResult {
  id: string
  title: string | null
  external_ref: string | null
  city: string | null
}

export function PropertySearchField({
  valueId,
  valueLabel,
  onChange,
  label = 'Imóvel associado (opcional)',
  helpText,
}: {
  valueId: string | null
  valueLabel: string | null
  onChange: (id: string | null, label: string | null) => void
  label?: string
  helpText?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 300)
  const [results, setResults] = useState<PropertyResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    setSearching(true)
    const params = new URLSearchParams({ per_page: '8' })
    if (debounced.trim()) params.set('search', debounced.trim())
    fetch(`/api/properties?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (active) setResults(Array.isArray(j.data) ? j.data : [])
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSearching(false)
      })
    return () => {
      active = false
    }
  }, [debounced, open])

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium">
        <Building2 className="h-3.5 w-3.5" /> {label}
      </Label>
      {valueId ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
          <span className="truncate text-sm">{valueLabel ?? 'Imóvel associado'}</span>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="text-muted-foreground hover:text-destructive shrink-0"
            aria-label="Remover imóvel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="text-muted-foreground w-full justify-between rounded-xl font-normal"
            >
              Escolher imóvel…
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="border-b p-2">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por referência ou título…"
                className="h-8"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {searching ? (
                <div className="text-muted-foreground flex items-center gap-2 px-2 py-3 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> A pesquisar…
                </div>
              ) : results.length === 0 ? (
                <div className="text-muted-foreground px-2 py-3 text-xs">Sem resultados.</div>
              ) : (
                results.map((p) => {
                  const lbl = [p.title, p.external_ref].filter(Boolean).join(' · ') || p.external_ref || p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onChange(p.id, lbl)
                        setOpen(false)
                        setQuery('')
                      }}
                      className="hover:bg-muted flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left"
                    >
                      <span className="w-full truncate text-sm font-medium">{p.title || 'Sem título'}</span>
                      <span className="text-muted-foreground text-[11px]">
                        {[p.external_ref, p.city].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {helpText && <p className="text-muted-foreground text-xs">{helpText}</p>}
    </div>
  )
}
