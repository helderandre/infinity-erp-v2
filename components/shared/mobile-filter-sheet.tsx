'use client'

import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface MobileFilterSheetProps {
  children: React.ReactNode
  activeCount?: number
}

/**
 * Wraps filter controls: on mobile shows a button that opens a dropdown popover,
 * on desktop renders children inline.
 */
export function MobileFilterSheet({ children, activeCount = 0 }: MobileFilterSheetProps) {
  return (
    <>
      {/* Mobile: popover dropdown */}
      <div className="sm:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs px-3">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeCount > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 rounded-full text-[9px]">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[calc(100vw-2rem)] max-w-sm p-3"
          >
            <div className="flex flex-wrap gap-2">
              {children}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Desktop: render inline */}
      <div className="hidden sm:contents">
        {children}
      </div>
    </>
  )
}
