'use client'

import { Input } from '@/components/ui/input'
import { MaskInput } from '@/components/ui/mask-input'
import { Textarea } from '@/components/ui/textarea'
import { phonePTMask, nifMask, postalCodePTMask } from '@/lib/masks'
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
  isAiFilled,
  isMissing,
}: {
  children: React.ReactNode
  fullWidth?: boolean
  className?: string
  isAiFilled?: boolean
  isMissing?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 transition-colors',
        fullWidth && 'col-span-full',
        isAiFilled && 'border-violet-300 bg-violet-50/30 dark:border-violet-700 dark:bg-violet-950/20',
        isMissing && !isAiFilled && 'border-amber-200 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-950/20',
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
  maskType,
  required,
  fullWidth,
  className,
  error,
  isAiFilled,
  isMissing,
}: {
  label: string
  value?: string | number | null
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  suffix?: string
  maskType?: 'phone' | 'nif' | 'postal_code'
  required?: boolean
  fullWidth?: boolean
  className?: string
  error?: string
  isAiFilled?: boolean
  isMissing?: boolean
}) {
  const maskMap = {
    phone: { mask: phonePTMask, placeholder: '+351 9XX XXX XXX' },
    nif: { mask: nifMask, placeholder: '123 456 789' },
    postal_code: { mask: postalCodePTMask, placeholder: '1234-567' },
  }

  // Currency mask for suffix="€"
  if (suffix === '€') {
    return (
      <AcqFieldWrapper fullWidth={fullWidth} isAiFilled={isAiFilled} isMissing={isMissing} className={cn(error && 'border-destructive', className)}>
        <AcqFieldLabel required={required}>{label}</AcqFieldLabel>
        <MaskInput
          mask="currency"
          currency="EUR"
          locale="pt-PT"
          placeholder="0,00 €"
          value={value != null ? String(value) : ''}
          onValueChange={(_masked, unmasked) => onChange(unmasked)}
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium"
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </AcqFieldWrapper>
    )
  }

  // Percentage mask for suffix="%"
  if (suffix === '%') {
    return (
      <AcqFieldWrapper fullWidth={fullWidth} isAiFilled={isAiFilled} isMissing={isMissing} className={cn(error && 'border-destructive', className)}>
        <AcqFieldLabel required={required}>{label}</AcqFieldLabel>
        <MaskInput
          mask="percentage"
          placeholder="0,00%"
          value={value != null ? String(value) : ''}
          onValueChange={(_masked, unmasked) => onChange(unmasked)}
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium"
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </AcqFieldWrapper>
    )
  }

  // Custom mask types (phone, nif, postal_code)
  if (maskType && maskMap[maskType]) {
    const { mask, placeholder: maskPlaceholder } = maskMap[maskType]
    return (
      <AcqFieldWrapper fullWidth={fullWidth} isAiFilled={isAiFilled} isMissing={isMissing} className={cn(error && 'border-destructive', className)}>
        <AcqFieldLabel required={required}>{label}</AcqFieldLabel>
        <MaskInput
          mask={mask}
          placeholder={placeholder || maskPlaceholder}
          value={value != null ? String(value) : ''}
          onValueChange={(_masked, unmasked) => onChange(unmasked)}
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0 text-sm font-medium"
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </AcqFieldWrapper>
    )
  }

  return (
    <AcqFieldWrapper fullWidth={fullWidth} isAiFilled={isAiFilled} isMissing={isMissing} className={cn(error && 'border-destructive', className)}>
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
  isAiFilled,
  isMissing,
}: {
  label: string
  value?: string | null
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  fullWidth?: boolean
  rows?: number
  error?: string
  isAiFilled?: boolean
  isMissing?: boolean
}) {
  return (
    <AcqFieldWrapper fullWidth={fullWidth} isAiFilled={isAiFilled} isMissing={isMissing} className={cn(error && 'border-destructive')}>
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
  isAiFilled,
  isMissing,
}: {
  label: string
  value?: string | null
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  fullWidth?: boolean
  error?: string
  isAiFilled?: boolean
  isMissing?: boolean
}) {
  return (
    <AcqFieldWrapper fullWidth={fullWidth} isAiFilled={isAiFilled} isMissing={isMissing} className={cn(error && 'border-destructive')}>
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
