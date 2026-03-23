'use client'

import { Copy } from 'lucide-react'
import { toast } from 'sonner'

export function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode | string | number | null | undefined
}) {
  if (value == null || value === '') return null

  const copyValue = () => {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value) : label
    navigator.clipboard.writeText(text)
    toast.success('Copiado')
  }

  return (
    <div
      className="group flex justify-between items-center gap-2 rounded px-1 -mx-1 hover:bg-muted/40 transition-colors cursor-pointer"
      onClick={copyValue}
    >
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right flex items-center gap-1.5">
        {value}
        <Copy className="h-2.5 w-2.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
      </span>
    </div>
  )
}
