'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { addMonths, subMonths, addWeeks, subWeeks } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarToolbarProps {
  currentDate: Date
  view: 'month' | 'week'
  onDateChange: (date: Date) => void
  onViewChange: (view: 'month' | 'week') => void
  onCreateEvent: () => void
}

export function CalendarToolbar({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onCreateEvent,
}: CalendarToolbarProps) {
  const handlePrev = () => {
    onDateChange(view === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))
  }

  const handleNext = () => {
    onDateChange(view === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const capitalizedLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  return (
    <div className="flex items-center justify-between gap-4 pb-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext} aria-label="Seguinte">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="text-lg font-semibold min-w-[180px]">
          {capitalizedLabel}
        </h2>

        <Button variant="outline" size="sm" onClick={handleToday}>
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
          Hoje
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Tabs
          value={view}
          onValueChange={(v) => onViewChange(v as 'month' | 'week')}
        >
          <TabsList>
            <TabsTrigger value="month">Mês</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button onClick={onCreateEvent}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Evento
        </Button>
      </div>
    </div>
  )
}
