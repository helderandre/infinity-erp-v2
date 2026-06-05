'use client'

import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CategorySection, categories } from './email-toolbox'

/**
 * Compact replacement for the full-width EmailToolbox sidebar.
 *
 * Renders as a single "+ Inserir" button. On click, opens a popover containing
 * the same categorised blocks (search + drag-to-canvas preserved via the shared
 * CategorySection). The popover stays open during a drag because mousedown
 * starts inside it and only mouseup-outside fires — Radix Popover does not
 * close on that event.
 */
export function EmailToolboxPopover({
  size = 'sm',
  align = 'start',
  className,
}: {
  size?: 'sm' | 'default'
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          className={className}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Inserir
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-80 p-0 max-h-[70vh] overflow-hidden flex flex-col"
      >
        <div className="p-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="h-8 pl-8 text-xs"
              autoFocus
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Arraste um bloco para o canvas.
          </p>
        </div>
        <div className="flex-1 overflow-auto">
          {categories.map((cat) => (
            <CategorySection key={cat.name} category={cat} search={search} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
