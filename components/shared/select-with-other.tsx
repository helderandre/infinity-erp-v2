'use client'

/**
 * Drop-in replacement for shadcn `<Select>` that lets users contribute a new
 * option inline. Picks the canonical options from a hardcoded map (passed as
 * `options`) plus active extras from `taxonomy_extras` (scoped by `scope`).
 *
 * When the user picks the "+ Outro…" sentinel, the trigger swaps to a tiny
 * input strip with confirm/cancel. On confirm we POST to /api/taxonomy/[scope]
 * and select the new value. Legacy stored values (e.g. an admin-deactivated
 * extra or the legacy `'outro'` slug) still render with their label via the
 * `legacyLabels` map.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Check, X, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectSeparator,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTaxonomyExtras, invalidateTaxonomyExtras } from '@/hooks/use-taxonomy-extras'

const ADD_OTHER_SENTINEL = '__add_other__'

export interface SelectWithOtherProps {
  scope: string
  value: string | undefined
  onChange: (value: string) => void
  /** Canonical hardcoded options shown above the extras. */
  options: Array<{ value: string; label: string }>
  /** Used only to resolve labels for legacy stored values that aren't in
   *  `options` and aren't in active `extras` (e.g. legacy 'outro' or an
   *  admin-deactivated extra). Optional. */
  legacyLabels?: Record<string, string>
  placeholder?: string
  disabled?: boolean
  /** When true, the inline "Outro…" affordance is hidden (read-only consumers
   *  or fields where extras shouldn't be created from this surface). */
  disableAdd?: boolean
  /** Override the `SelectTrigger` className — useful when embedding in a form
   *  surface with its own chrome (e.g. AcqFieldWrapper) that wants a borderless
   *  inner trigger. */
  triggerClassName?: string
  /** Override the inline-input's className when in "adding" mode. */
  inputClassName?: string
}

export function SelectWithOther({
  scope,
  value,
  onChange,
  options,
  legacyLabels,
  placeholder = 'Seleccione…',
  disabled,
  disableAdd,
  triggerClassName,
  inputClassName,
}: SelectWithOtherProps) {
  const { extras, refetch } = useTaxonomyExtras(scope)
  const [mode, setMode] = useState<'select' | 'adding'>('select')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // When the user picks the "+ Outro…" sentinel, don't propagate it to the
  // form — instead enter inline-input mode.
  const handleSelectChange = useCallback(
    (next: string) => {
      if (next === ADD_OTHER_SENTINEL) {
        setMode('adding')
        setDraft('')
        return
      }
      onChange(next)
    },
    [onChange]
  )

  useEffect(() => {
    if (mode === 'adding') {
      // Slight defer so radix's blur doesn't steal focus from us
      const id = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(id)
    }
  }, [mode])

  const cancelAdd = useCallback(() => {
    setMode('select')
    setDraft('')
  }, [])

  const confirmAdd = useCallback(async () => {
    const label = draft.trim()
    if (!label) {
      cancelAdd()
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/taxonomy/${scope}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || 'Erro ao guardar')
        return
      }
      invalidateTaxonomyExtras(scope)
      await refetch()
      onChange(json.value)
      setMode('select')
      setDraft('')
      toast.success(`"${json.label}" adicionado para toda a equipa`)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }, [draft, scope, onChange, refetch, cancelAdd])

  const allOptions = useMemo(() => {
    const hardcoded = options
    const dynamic = extras.map((e) => ({ value: e.value, label: e.label }))
    return [...hardcoded, ...dynamic]
  }, [options, extras])

  // If the current value isn't in hardcoded or extras, surface it as a
  // synthetic "legacy" SelectItem. Radix uses the matching item's text to
  // render the trigger label — without this row, legacy values would show
  // empty. The synthetic row is muted so users see it's not a fresh option.
  const legacyOption = useMemo(() => {
    if (!value) return null
    if (allOptions.some((o) => o.value === value)) return null
    const label = legacyLabels?.[value] ?? value
    return { value, label }
  }, [value, allOptions, legacyLabels])

  if (mode === 'adding') {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              confirmAdd()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancelAdd()
            }
          }}
          placeholder="Ex.: Prédio"
          maxLength={80}
          disabled={saving}
          className={inputClassName}
        />
        <Button
          type="button"
          size="icon"
          variant="default"
          onClick={confirmAdd}
          disabled={saving || !draft.trim()}
          aria-label="Confirmar"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={cancelAdd}
          disabled={saving}
          aria-label="Cancelar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <Select onValueChange={handleSelectChange} value={value} disabled={disabled}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectGroup>
        {extras.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              {extras.map((e) => (
                <SelectItem key={e.id} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
        {legacyOption && (
          <>
            <SelectSeparator />
            <SelectItem value={legacyOption.value} className="text-muted-foreground italic">
              {legacyOption.label}
            </SelectItem>
          </>
        )}
        {!disableAdd && (
          <>
            <SelectSeparator />
            <SelectItem value={ADD_OTHER_SENTINEL} className="text-primary">
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Outro…
              </span>
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  )
}
