'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { addMonths, subMonths, addWeeks, subWeeks } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, List, SlidersHorizontal, Infinity as InfinityIcon, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { CalendarSubscribePopover } from './calendar-subscribe-popover'

type ToolbarView = 'month' | 'week' | 'agenda' | 'day'

interface CalendarToolbarProps {
  currentDate: Date
  view: ToolbarView
  /**
   * When in 'day' view, this is the view we'd return to. The tab selector
   * keeps that value highlighted so the user knows which parent view is "in
   * focus" behind the current day.
   */
  parentView?: 'month' | 'week' | 'agenda'
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
  parentView,
  onDateChange,
  onViewChange,
  onCreateEvent,
  onToggleFilters,
  hasActiveFilters,
  onShowCompanyEvents,
  isManager,
  hasLiveEvent,
}: CalendarToolbarProps) {
  const displayView: 'month' | 'week' | 'agenda' =
    view === 'day' ? parentView ?? 'month' : view
  const handlePrev = () => {
    onDateChange(view === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1))
  }

  const handleNext = () => {
    onDateChange(view === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1))
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  const monthLabel = format(currentDate, 'MMM yyyy', { locale: ptBR })
  const capitalizedLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
  const monthLabelFull = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const capitalizedLabelFull = monthLabelFull.charAt(0).toUpperCase() + monthLabelFull.slice(1)

  return (
    <div className="flex items-center justify-between gap-2 pb-2 sm:pb-4">
      <div className="flex items-center gap-1 sm:gap-2">
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

        <button onClick={handleToday} className="text-sm font-semibold sm:text-lg sm:min-w-[180px] hover:text-primary transition-colors">
          <span className="sm:hidden">{capitalizedLabel}</span>
          <span className="hidden sm:inline">{capitalizedLabelFull}</span>
        </button>

        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={handleNext} aria-label="Seguinte">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
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

        <Tabs
          value={displayView}
          onValueChange={(v) => onViewChange(v as 'month' | 'week' | 'agenda')}
        >
          <TabsList className="h-7 sm:h-9">
            <TabsTrigger value="month" className="text-xs px-2 sm:text-sm sm:px-3 h-5 sm:h-7">Mês</TabsTrigger>
            <TabsTrigger value="week" className="text-xs px-2 sm:text-sm sm:px-3 h-5 sm:h-7">Semana</TabsTrigger>
            <TabsTrigger value="agenda" className="text-xs px-2 sm:text-sm sm:px-3 h-5 sm:h-7">
              <List className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Agenda</span>
            </TabsTrigger>
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
  )
}
