'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/* ─── Section Header ─── */
export function AcqSectionHeader({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  return (
    <p
      className={cn(
        'text-xs font-semibold text-muted-foreground uppercase tracking-wider col-span-full',
        className
      )}
    >
      {title}
    </p>
  )
}

/* ─── Field Wrapper ─── */
export function AcqFieldWrapper({
  children,
  fullWidth,
  className,
}: {
  children: React.ReactNode
  fullWidth?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        fullWidth && 'col-span-full',
        className
      )}
    >
      {children}
    </div>
  )
}

/* ─── Field Label ─── */
export function AcqFieldLabel({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <p className="text-xs text-muted-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </p>
  )
}

/* ─── Text/Number Input Field ─── */
export function AcqInputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
  required,
  fullWidth,
  className,
  error,
}: {
  label: string
  value?: string | number | null
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  suffix?: string
  required?: boolean
  fullWidth?: boolean
  className?: string
  error?: string
}) {
  return (
    <AcqFieldWrapper fullWidth={fullWidth} className={cn(error && 'border-destructive', className)}>
      <AcqFieldLabel required={required}>{label}</AcqFieldLabel>
      <div className="relative">
        <Input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '—'}
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium"
        />
        {suffix && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </AcqFieldWrapper>
  )
}

/* ─── Textarea Field ─── */
export function AcqTextareaField({
  label,
  value,
  onChange,
  placeholder,
  required,
  fullWidth = true,
  rows = 3,
  error,
}: {
  label: string
  value?: string | null
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  fullWidth?: boolean
  rows?: number
  error?: string
}) {
  return (
    <AcqFieldWrapper fullWidth={fullWidth} className={cn(error && 'border-destructive')}>
      <AcqFieldLabel required={required}>{label}</AcqFieldLabel>
      <Textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ''}
        rows={rows}
        className="border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium resize-none"
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </AcqFieldWrapper>
  )
}

/* ─── Select Field ─── */
export function AcqSelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  fullWidth,
  error,
}: {
  label: string
  value?: string | null
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  fullWidth?: boolean
  error?: string
}) {
  return (
    <AcqFieldWrapper fullWidth={fullWidth} className={cn(error && 'border-destructive')}>
      <AcqFieldLabel required={required}>{label}</AcqFieldLabel>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-8 border-0 p-0 shadow-none focus:ring-0 text-sm font-medium [&>svg]:ml-2">
          <SelectValue placeholder={placeholder || 'Seleccionar...'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </AcqFieldWrapper>
  )
}

/* ─── Switch/Toggle Field ─── */
export function AcqSwitchField({
  label,
  checked,
  onChange,
  fullWidth,
}: {
  label: string
  checked?: boolean
  onChange: (v: boolean) => void
  fullWidth?: boolean
}) {
  return (
    <AcqFieldWrapper fullWidth={fullWidth}>
      <div className="flex items-center justify-between">
        <AcqFieldLabel>{label}</AcqFieldLabel>
        <Switch checked={checked ?? false} onCheckedChange={onChange} />
      </div>
    </AcqFieldWrapper>
  )
}
