'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DetailRow } from '@/components/shared/detail-row'
import { cn } from '@/lib/utils'

/**
 * Primitivas de campo editável partilhadas pelas sheets de "pedido"
 * (angariação + fecho). Em modo leitura caem no `<DetailRow>` existente; em modo
 * edição mostram um controlo inline. Mantém o look read-only intacto.
 */

export function FieldRow({
  label, editing, display, children,
}: {
  label: string
  editing: boolean
  display?: React.ReactNode
  children: React.ReactNode
}) {
  if (!editing) return <DetailRow label={label} value={display} />
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="w-2/5 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function TextInput({ value, onChange, placeholder }: { value: unknown; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 rounded-lg text-sm"
    />
  )
}

export function NumInput({ value, onChange, suffix }: { value: unknown; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div className="relative">
      <Input
        type="number"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-8 rounded-lg text-sm', suffix && 'pr-7')}
      />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  )
}

export function DateInput({ value, onChange }: { value: unknown; onChange: (v: string) => void }) {
  return (
    <Input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-lg text-sm" />
  )
}

export function SelectInput({
  value, onChange, options, className,
}: {
  value: unknown
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <select
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={cn('h-8 w-full rounded-lg border border-input bg-background px-2 text-sm', className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function BoolInput({ value, onChange }: { value: unknown; onChange: (v: boolean) => void }) {
  return (
    <select
      value={value ? 'true' : 'false'}
      onChange={(e) => onChange(e.target.value === 'true')}
      className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
    >
      <option value="false">Não</option>
      <option value="true">Sim</option>
    </select>
  )
}

export function TextAreaField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string) => void }) {
  return (
    <div className="pt-1 space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className="min-h-16 rounded-lg text-sm" />
    </div>
  )
}
