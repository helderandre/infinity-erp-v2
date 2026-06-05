"use client"

import * as React from "react"
import { MaskInput } from "@/components/ui/mask-input"

interface CurrencyInputProps
  extends Omit<
    React.ComponentProps<typeof MaskInput>,
    "value" | "onChange" | "onValueChange" | "mask" | "currency" | "locale"
  > {
  value: number | null | undefined
  onChange?: (value: number | null) => void
  currency?: string
  locale?: string
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    { value, onChange, placeholder = "0,00 €", currency = "EUR", locale = "pt-PT", ...rest },
    ref,
  ) {
    return (
      <MaskInput
        ref={ref}
        mask="currency"
        currency={currency}
        locale={locale}
        placeholder={placeholder}
        value={value != null ? String(value) : ""}
        onValueChange={(_masked, unmasked) => {
          if (!onChange) return
          onChange(unmasked ? Number(unmasked) : null)
        }}
        {...rest}
      />
    )
  },
)

export { CurrencyInput }
