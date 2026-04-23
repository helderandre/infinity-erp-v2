'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

export function InstanceSelector({ instances, value, onChange }: InstanceSelectorProps) {
  if (instances.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        Nenhuma instância activa
      </div>
    )
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full border-0 rounded-none h-auto py-2.5 px-3 focus:ring-0">
        <SelectValue placeholder="Seleccionar instância" />
      </SelectTrigger>
      <SelectContent>
        {instances.map((inst) => (
          <SelectItem key={inst.id} value={inst.id}>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2 w-2 rounded-full flex-shrink-0 ${
                  inst.connection_status === 'connected'
                    ? 'bg-emerald-500'
                    : inst.connection_status === 'connecting'
                      ? 'bg-yellow-500'
                      : 'bg-slate-400'
                }`}
              />
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
