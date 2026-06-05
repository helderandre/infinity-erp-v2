'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Link, Unlink } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface RadiusInputProps {
  value: string | number
  onChange: (value: string) => void
}

function parseRadius(val: string | number): number[] {
  if (typeof val === 'number') return [val, val, val, val]
  const parts = String(val || '0px')
    .split(/\s+/)
    .map((p) => parseInt(p) || 0)
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]]
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]]
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]]
  return [parts[0], parts[1], parts[2], parts[3]]
}

export function RadiusInput({ value, onChange }: RadiusInputProps) {
  const corners = parseRadius(value)
  const allSame = corners.every((c) => c === corners[0])
  const [linked, setLinked] = useState(allSame)

  const updateCorner = useCallback(
    (idx: number, val: number) => {
      if (linked) {
        onChange(`${Math.max(0, val)}px`)
      } else {
        const next = [...corners]
        next[idx] = Math.max(0, val)
        onChange(next.map((n) => `${n}px`).join(' '))
      }
    },
    [linked, corners, onChange]
  )

  const toggleLink = useCallback(() => {
    if (!linked) {
      onChange(`${corners[0]}px`)
    }
    setLinked(!linked)
  }, [linked, corners, onChange])

  if (linked) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Radius</Label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            value={corners[0]}
            onChange={(e) => updateCorner(0, parseInt(e.target.value) || 0)}
            className="flex-1 h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <Input
            type="number"
            value={corners[0]}
            className="flex-1 h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            disabled
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={toggleLink}
            title="Desvincular cantos"
          >
            <Unlink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Radius</Label>
      <p className="text-[10px] text-muted-foreground">
        Defina o raio de cada canto separadamente.
      </p>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
        <Input
          type="number"
          value={corners[0]}
          onChange={(e) => updateCorner(0, parseInt(e.target.value) || 0)}
          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="↖"
        />
        <Input
          type="number"
          value={corners[1]}
          onChange={(e) => updateCorner(1, parseInt(e.target.value) || 0)}
          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="↗"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 row-span-2"
          onClick={toggleLink}
          title="Vincular cantos"
        >
          <Link className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          value={corners[2]}
          onChange={(e) => updateCorner(2, parseInt(e.target.value) || 0)}
          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="↙"
        />
        <Input
          type="number"
          value={corners[3]}
          onChange={(e) => updateCorner(3, parseInt(e.target.value) || 0)}
          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="↘"
        />
      </div>
    </div>
  )
}
