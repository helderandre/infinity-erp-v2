'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bug, Lightbulb, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { FeedbackCard } from '@/components/feedback/feedback-card'
import { FeedbackDetailSheet } from '@/components/feedback/feedback-detail-sheet'
import { cn } from '@/lib/utils'
import {
  FEEDBACK_STATUS_MAP, FEEDBACK_PIPELINE_COLUMNS, FEEDBACK_TYPE_LABELS,
} from '@/types/feedback'
import type { FeedbackWithRelations, FeedbackStatus } from '@/types/feedback'

export default function TechPipelinePage() {
  const [items, setItems] = useState<FeedbackWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | 'ticket' | 'ideia'>('all')
  const [selectedItem, setSelectedItem] = useState<FeedbackWithRelations | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [consultants, setConsultants] = useState<Array<{ id: string; commercial_name: string }>>([])

  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (typeFilter !== 'all') params.set('type', typeFilter)

      const res = await fetch(`/api/feedback?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setItems(json.data || [])
    } catch {
      toast.error('Erro ao carregar')
    } finally {
      setIsLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    fetch('/api/users/consultants')
      .then((res) => res.json())
      .then((data) => setConsultants(data.data || data || []))
      .catch(() => {})
  }, [])

  const handleCardClick = (item: FeedbackWithRelations) => {
    setSelectedItem(item)
    setSheetOpen(true)
  }

  const handleUpdate = () => {
    fetchItems()
    // Refresh the selected item if sheet is open
    if (selectedItem) {
      fetch(`/api/feedback/${selectedItem.id}`)
        .then((res) => res.json())
        .then(setSelectedItem)
        .catch(() => {})
    }
  }

  // Group items by status
  const grouped = FEEDBACK_PIPELINE_COLUMNS.reduce((acc, status) => {
    acc[status] = items.filter((i) => i.status === status)
    return acc
  }, {} as Record<FeedbackStatus, FeedbackWithRelations[]>)

  const totalByType = {
    ticket: items.filter((i) => i.type === 'ticket').length,
    ideia: items.filter((i) => i.type === 'ideia').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tech Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Tickets e ideias submetidos pela equipa
        </p>
      </div>

      {/* Type filter tabs */}
      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">
            Todos
            <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1.5 text-[0.65rem]">
              {items.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ticket" className="gap-1.5">
            <Bug className="h-3.5 w-3.5" />
            Tickets
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[0.65rem]">
              {totalByType.ticket}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ideia" className="gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            Ideias
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[0.65rem]">
              {totalByType.ideia}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Kanban board */}
      {isLoading ? (
        <div className="grid grid-cols-5 gap-4">
          {FEEDBACK_PIPELINE_COLUMNS.map((col) => (
            <div key={col} className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 min-w-[1000px] pb-4">
            {FEEDBACK_PIPELINE_COLUMNS.map((status) => {
              const statusInfo = FEEDBACK_STATUS_MAP[status]
              const columnItems = grouped[status]

              return (
                <div key={status} className="flex-1 min-w-[220px]">
                  {/* Column header */}
                  <div className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 mb-3',
                    statusInfo.bg,
                  )}>
                    <span className={cn('h-2.5 w-2.5 rounded-full', statusInfo.dot)} />
                    <span className={cn('text-sm font-medium', statusInfo.text)}>
                      {statusInfo.label}
                    </span>
                    <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-[0.65rem]">
                      {columnItems.length}
                    </Badge>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2">
                    {columnItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center">
                        <p className="text-xs text-muted-foreground">Vazio</p>
                      </div>
                    ) : (
                      columnItems.map((item) => (
                        <FeedbackCard
                          key={item.id}
                          item={item}
                          onClick={handleCardClick}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {/* Detail sheet */}
      <FeedbackDetailSheet
        item={selectedItem}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={handleUpdate}
        consultants={consultants}
      />
    </div>
  )
}
