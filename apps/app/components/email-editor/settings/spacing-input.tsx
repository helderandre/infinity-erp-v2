'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Link, Unlink } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface SpacingInputProps {
  label: string
  value: string | number
  onChange: (value: string) => void
}

/** Parse CSS shorthand (e.g. "24px", "10px 20px", "10px 20px 30px 40px") into [top, right, bottom, left] */
function parseSpacing(val: string | number): number[] {
  if (typeof val === 'number') return [val, val, val, val]
  const parts = String(val || '0')
    .split(/\s+/)
    .map((p) => parseInt(p) || 0)
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]]
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]]
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]]
  return [parts[0], parts[1], parts[2], parts[3]]
}

function formatSpacing(sides: number[]): string {
  const [t, r, b, l] = sides
  if (t === r && r === b && b === l) return `${t}px`
  if (t === b && r === l) return `${t}px ${r}px`
  if (r === l) return `${t}px ${r}px ${b}px`
  return `${t}px ${r}px ${b}px ${l}px`
}

const LABELS = ['↑', '→', '↓', '←']
const PLACEHOLDERS = ['Topo', 'Dir.', 'Baixo', 'Esq.']

export function SpacingInput({ label, value, onChange }: SpacingInputProps) {
  const sides = parseSpacing(value)
  const allSame = sides.every((s) => s === sides[0])
  const [linked, setLinked] = useState(allSame)

  const updateSide = useCallback(
    (idx: number, val: number) => {
      const clamped = Math.max(0, val)
      if (linked) {
        onChange(`${clamped}px`)
      } else {
        const next = [...sides]
        next[idx] = clamped
        onChange(formatSpacing(next))
      }
    },
    [linked, sides, onChange]
  )

  const toggleLink = useCallback(() => {
    if (!linked) {
      onChange(`${sides[0]}px`)
    }
    setLinked(!linked)
  }, [linked, sides, onChange])

  if (linked) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            value={sides[0]}
            onChange={(e) => updateSide(0, parseInt(e.target.value) || 0)}
            className="flex-1 h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-muted-foreground">px</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={toggleLink}
            title="Ajustar cada lado"
          >
            <Unlink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
        {sides.map((s, i) => (
          <div key={LABELS[i]} className="relative">
            <Input
              type="number"
              value={s}
              onChange={(e) => updateSide(i, parseInt(e.target.value) || 0)}
              className="h-8 text-sm pr-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder={PLACEHOLDERS[i]}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
              {LABELS[i]}
            </span>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 row-span-2"
          onClick={toggleLink}
          title="Vincular lados"
        >
          <Link className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
