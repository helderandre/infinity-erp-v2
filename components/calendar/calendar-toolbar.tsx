'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { addMonths, subMonths, addWeeks, subWeeks } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, Infinity as InfinityIcon, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { CalendarSubscribePopover } from './calendar-subscribe-popover'

type ToolbarView = 'month' | 'week' | 'agenda' | 'day'

interface CalendarToolbarProps {
  currentDate: Date
  view: ToolbarView
  onDateChange: (date: Date) => void
  onViewChange: (view: ToolbarView) => void
  onCreateEvent: () => void
  onToggleFilters?: () => void
  hasActiveFilters?: boolean
  onShowCompanyEvents?: () => void
  isManager?: boolean
  hasLiveEvent?: boolean
}

export function CalendarToolbar({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onCreateEvent,
  onToggleFilters,
  hasActiveFilters,
  onShowCompanyEvents,
  isManager,
  hasLiveEvent,
}: CalendarToolbarProps) {
  const displayView: 'month' | 'week' | 'day' =
    view === 'agenda' ? 'day' : view
  const handlePrev = () => {
    onDateChange(view === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1))
  }

  const handleNext = () => {
    onDateChange(view === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1))
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  const monthLabelFull = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const capitalizedLabelFull = monthLabelFull.charAt(0).toUpperCase() + monthLabelFull.slice(1)

  return (
    <div className="flex flex-col gap-2 pb-2 min-[540px]:flex-row min-[540px]:items-center min-[540px]:justify-between min-[540px]:gap-2 sm:pb-4">
      {/* Stacks vertically when the toolbar can't fit on one line; otherwise
          stays single-row with month picker left and actions right. */}
      <div className="flex items-center gap-1 justify-center min-[540px]:justify-start sm:gap-2">
        {isManager && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex h-8 w-8 sm:h-9 sm:w-9"
            asChild
            aria-label="Assiduidade"
          >
            <Link href="/dashboard/calendario/assiduidade">
              <BarChart3 className="h-4 w-4" />
            </Link>
          </Button>
        )}

        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={handlePrev} aria-label="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <button onClick={handleToday} className="text-sm font-semibold whitespace-nowrap sm:text-lg sm:min-w-[180px] sm:text-left text-center hover:text-primary transition-colors">
          {capitalizedLabelFull}
        </button>

        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={handleNext} aria-label="Seguinte">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Bottom row when stacked: filter on the left, everything else hugging
          the right. Single-row on wider widths (justify-end). */}
      <div className="flex items-center justify-between gap-1.5 min-[540px]:justify-end sm:gap-3">
        {onToggleFilters && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9 lg:hidden relative"
            onClick={onToggleFilters}
            aria-label="Filtros"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {hasActiveFilters && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-3">
          <Tabs
            value={displayView}
            onValueChange={(v) => onViewChange(v as 'month' | 'week' | 'day')}
          >
            <TabsList className="h-7 sm:h-9">
              <TabsTrigger value="month" className="text-xs px-2 sm:text-sm sm:px-3 h-5 sm:h-7">Mês</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-2 sm:text-sm sm:px-3 h-5 sm:h-7">Semana</TabsTrigger>
              <TabsTrigger value="day" className="text-xs px-2 sm:text-sm sm:px-3 h-5 sm:h-7">Dia</TabsTrigger>
            </TabsList>
          </Tabs>

          {onShowCompanyEvents && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 relative"
              onClick={onShowCompanyEvents}
              aria-label="Eventos de empresa"
            >
              <InfinityIcon className="h-4 w-4" strokeWidth={2.25} />
              {hasLiveEvent && (
                <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500" />
                </span>
              )}
            </Button>
          )}

          <CalendarSubscribePopover />

          <Button onClick={onCreateEvent} size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Novo Evento</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
