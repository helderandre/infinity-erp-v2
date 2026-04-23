'use client'

import { ChevronDown } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Instance {
  id: string
  name: string
  connection_status: string
  phone?: string | null
}

interface InstanceSelectorProps {
  instances: Instance[]
  value: string
  onChange: (id: string) => void
}

function statusDotClass(status: string) {
  if (status === 'connected') return 'bg-emerald-500'
  if (status === 'connecting') return 'bg-yellow-500'
  return 'bg-slate-400'
}

export function InstanceSelector({ instances, value, onChange }: InstanceSelectorProps) {
  if (instances.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        Nenhuma instância activa
      </div>
    )
  }

  const selected = instances.find((i) => i.id === value)
  const showChevron = instances.length > 1

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full border-0 rounded-none h-auto py-2 px-3 focus:ring-0 min-w-0 [&>svg]:hidden">
        {selected ? (
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <span className={cn('h-2 w-2 rounded-full shrink-0', statusDotClass(selected.connection_status))} />
            <span className="text-sm font-medium tabular-nums truncate">
              {selected.phone || selected.name}
            </span>
            {showChevron && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </span>
        ) : (
          <SelectValue placeholder="Seleccionar instância" />
        )}
      </SelectTrigger>
      <SelectContent>
        {instances.map((inst) => (
          <SelectItem key={inst.id} value={inst.id}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('h-2 w-2 rounded-full flex-shrink-0', statusDotClass(inst.connection_status))} />
              <span className="text-sm font-medium truncate">
                {inst.phone || inst.name}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
