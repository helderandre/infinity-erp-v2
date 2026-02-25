'use client'

import { Label } from '@/components/ui/label'
import {
  ColorPicker,
  ColorPickerTrigger,
  ColorPickerContent,
  ColorPickerArea,
  ColorPickerHueSlider,
  ColorPickerAlphaSlider,
  ColorPickerSwatch,
  ColorPickerEyeDropper,
  ColorPickerFormatSelect,
  ColorPickerInput,
} from '@/components/ui/color-picker'

interface ColorPickerFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export function ColorPickerField({ label, value, onChange }: ColorPickerFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ColorPicker
        value={value}
        onValueChange={onChange}
        defaultFormat="hex"
      >
        <ColorPickerTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ColorPickerSwatch className="size-5 shrink-0 rounded-sm" />
            <span className="font-mono text-xs text-muted-foreground">{value}</span>
          </button>
        </ColorPickerTrigger>
        <ColorPickerContent className="w-[280px]">
          <ColorPickerArea />
          <ColorPickerHueSlider />
          <ColorPickerAlphaSlider />
          <div className="flex items-center gap-2">
            <ColorPickerEyeDropper size="icon" className="shrink-0" />
            <ColorPickerFormatSelect className="w-[70px]" />
            <ColorPickerInput />
          </div>
        </ColorPickerContent>
      </ColorPicker>
    </div>
  )
}
