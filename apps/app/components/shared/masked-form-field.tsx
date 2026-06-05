"use client"

import { MaskInput, type MaskPattern } from "@/components/ui/mask-input"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import type { Control, FieldPath, FieldValues } from "react-hook-form"

type MaskPatternKey =
  | "phone"
  | "ssn"
  | "date"
  | "time"
  | "creditCard"
  | "creditCardExpiry"
  | "zipCode"
  | "zipCodeExtended"
  | "currency"
  | "percentage"
  | "licensePlate"
  | "ipv4"
  | "macAddress"
  | "isbn"
  | "ein"

interface MaskedFormFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  mask: MaskPatternKey | MaskPattern
  placeholder?: string
  maskPlaceholder?: string
  description?: string
  disabled?: boolean
  currency?: string
  locale?: string
  /** Função para converter unmasked → valor do form (ex: parseFloat) */
  parse?: (unmasked: string) => unknown
}

export function MaskedFormField<T extends FieldValues>({
  control,
  name,
  label,
  mask,
  placeholder,
  maskPlaceholder,
  description,
  disabled,
  currency,
  locale,
  parse,
}: MaskedFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <MaskInput
              mask={mask}
              placeholder={placeholder}
              maskPlaceholder={maskPlaceholder}
              disabled={disabled}
              currency={currency}
              locale={locale}
              value={field.value != null ? String(field.value) : ""}
              onValueChange={(_masked, unmasked) => {
                if (parse) {
                  field.onChange(parse(unmasked))
                } else {
                  field.onChange(unmasked)
                }
              }}
              onBlur={field.onBlur}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
