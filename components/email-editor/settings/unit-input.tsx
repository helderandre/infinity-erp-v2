'use client'

import { useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Minus, Plus } from 'lucide-react'

const NONE_UNIT = '__none__'

interface UnitInputProps {
  value: string
  onChange: (value: string) => void
  units?: string[]
  step?: number
  min?: number
}

function parseValue(val: string): { num: number; unit: string } {
  const match = val.match(/^(-?[\d.]+)\s*(.*)$/)
  if (match) {
    const unit = match[2]?.trim() ?? ''
    return { num: parseFloat(match[1]) || 0, unit }
  }
  return { num: 0, unit: 'px' }
}

export function UnitInput({
  value,
  onChange,
  units = ['px', '%', 'em', 'rem'],
  step = 1,
  min = 0,
}: UnitInputProps) {
  const safeUnits = useMemo(
    () => units.map((u) => (u === '' ? NONE_UNIT : u)),
    [units]
  )

  const parsed = parseValue(value)
  const num = parsed.num
  const rawUnit = parsed.unit
  const safeUnit = rawUnit === '' ? NONE_UNIT : rawUnit
  const unit = safeUnits.includes(safeUnit) ? safeUnit : safeUnits[0]

  const toReal = (u: string) => (u === NONE_UNIT ? '' : u)

  const setNum = useCallback(
    (n: number) => {
      const clamped = Math.max(min, n)
      onChange(`${clamped}${toReal(unit)}`)
    },
    [unit, min, onChange]
  )

  const setUnit = useCallback(
    (u: string) => onChange(`${num}${toReal(u)}`),
    [num, onChange]
  )

  return (
    <div className="flex items-center rounded-md border shadow-xs overflow-hidden">
      <Input
        type="number"
        value={num}
        onChange={(e) => setNum(parseFloat(e.target.value) || 0)}
        className="flex-1 border-0 shadow-none rounded-none h-8 text-sm focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {safeUnits.length > 1 ? (
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-14 border-0 border-l shadow-none rounded-none h-8 text-xs text-muted-foreground focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {safeUnits.map((u) => (
              <SelectItem key={u} value={u}>
                {u === NONE_UNIT ? '—' : u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="px-2 text-xs text-muted-foreground border-l h-8 flex items-center">
          {toReal(safeUnits[0])}
        </span>
      )}
      <div className="flex border-l">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-7 rounded-none"
          onClick={() => setNum(num - step)}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-7 rounded-none border-l"
          onClick={() => setNum(num + step)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
