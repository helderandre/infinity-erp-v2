'use client'

import { SelectionArea, type SelectionEvent } from '@viselect/react'
import { ChevronDown, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { DOCUMENT_LABELS } from '@/lib/documents/labels'
import { cn } from '@/lib/utils'

import { DOMAIN_CONFIGS } from './domain-configs'
import { FolderCard } from './folder-card'
import type { DocumentFolder, DocumentsGridProps } from './types'

const DRAG_DISABLED_QUERY = '(pointer: coarse)'

export function DocumentsGrid({
  folders,
  domain,
  isLoading,
  onOpenFolder,
  onUpload,
  onDownloadFolder,
  onCreateCustomType,
  selectedIds,
  onSelectionChange,
  emptyState,
}: DocumentsGridProps) {
  const config = DOMAIN_CONFIGS[domain]
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(DRAG_DISABLED_QUERY)
    const update = () => setIsCoarsePointer(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const groupedFolders = useMemo(() => {
    const groups = new Map<string, DocumentFolder[]>()
    for (const category of config.categories) {
      groups.set(category.id, [])
    }
    for (const folder of folders) {
      const targetId = groups.has(folder.category)
        ? folder.category
        : config.fallbackCategoryId
      groups.get(targetId)?.push(folder)
    }
    return groups
  }, [folders, config])

  // Because @viselect/react v3 captures callbacks in a mount-time useEffect
  // with empty deps, any closure-captured state (selectedIds, onSelectionChange)
  // would be stale forever. We funnel every mutable value through refs so
  // the handlers can stay stable (empty deps) yet always read fresh data.
  const selectedIdsRef = useRef(selectedIds)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const isCoarsePointerRef = useRef(isCoarsePointer)
  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])
  useEffect(() => {
    isCoarsePointerRef.current = isCoarsePointer
  }, [isCoarsePointer])

  const handleToggleSelect = useCallback((folderId: string, next: boolean) => {
    const newSet = new Set(selectedIdsRef.current)
    if (next) newSet.add(folderId)
    else newSet.delete(folderId)
    onSelectionChangeRef.current(newSet)
  }, [])

  // Pre-drag snapshot + additive flag (ctrl/meta/shift at drag start).
  const preDragSelectionRef = useRef<Set<string>>(new Set())
  const additiveDragRef = useRef(false)
  // Working set for the in-flight drag.
  const dragWorkingSetRef = useRef<Set<string>>(new Set())

  const collectIdsFromElements = (elements: Iterable<Element>): string[] => {
    const ids: string[] = []
    for (const el of elements) {
      const id = (el as HTMLElement).dataset.selectable
      if (id) ids.push(id)
    }
    return ids
  }

  const handleSelectionMove = useCallback((e: SelectionEvent) => {
    const working = dragWorkingSetRef.current
    for (const id of collectIdsFromElements(e.store.changed.added)) working.add(id)
    for (const id of collectIdsFromElements(e.store.changed.removed)) working.delete(id)
    for (const id of collectIdsFromElements(e.store.selected)) working.add(id)

    const next = additiveDragRef.current
      ? new Set([...preDragSelectionRef.current, ...working])
      : new Set(working)
    onSelectionChangeRef.current(next)
  }, [])

  const handleBeforeStart = useCallback((e: SelectionEvent) => {
    if (isCoarsePointerRef.current) return false
    const target = e.event?.target as HTMLElement | null
    if (target && target.closest('[data-selectable]')) return false
    return undefined
  }, [])

  const handleSelectionStart = useCallback((e: SelectionEvent) => {
    if (typeof document !== 'undefined') {
      document.body.dataset.documentSelectionActive = 'true'
      window.getSelection?.()?.removeAllRanges?.()
    }
    preDragSelectionRef.current = new Set(selectedIdsRef.current)
    dragWorkingSetRef.current = new Set()
    const native = e.event as MouseEvent | TouchEvent | null
    additiveDragRef.current =
      !!native && 'ctrlKey' in native && (native.ctrlKey || native.metaKey || native.shiftKey)
  }, [])

  const handleSelectionStop = useCallback(() => {
    if (typeof document !== 'undefined') {
      delete document.body.dataset.documentSelectionActive
    }
  }, [])

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        delete document.body.dataset.documentSelectionActive
      }
    }
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        {config.categories.map((category) => (
          <div key={category.id} className="space-y-3">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 w-32 animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
        {emptyState ?? (
          <>
            <p className="text-sm text-muted-foreground">
              {DOCUMENT_LABELS.emptyStates.noDocuments}
            </p>
            <Button type="button" onClick={() => onUpload?.(null)}>
              {DOCUMENT_LABELS.actions.uploadDocument}
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <SelectionArea
      className="documents-grid-root space-y-6"
      onBeforeStart={handleBeforeStart}
      onStart={handleSelectionStart}
      onStop={handleSelectionStop}
      onMove={handleSelectionMove}
      selectables=".selectable-folder"
      features={{ touch: false, range: true, singleTap: { allow: false, intersect: 'native' }, deselectOnBlur: false }}
      behaviour={{ startThreshold: 5, overlap: 'keep' }}
      selectionAreaClass="selection-area-rect"
    >
      {config.categories.map((category) => {
        const items = groupedFolders.get(category.id) ?? []
        if (items.length === 0) return null
        return (
          <Collapsible key={category.id} defaultOpen>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="group flex items-center gap-2 text-sm font-semibold text-foreground">
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    'group-data-[state=closed]:-rotate-90'
                  )}
                />
                <category.icon className="h-4 w-4 text-muted-foreground" />
                <span>{category.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  ({items.length})
                </span>
              </CollapsibleTrigger>
              {category.id === config.fallbackCategoryId && onCreateCustomType && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onCreateCustomType}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {DOCUMENT_LABELS.actions.newType}
                </Button>
              )}
            </div>
            <CollapsibleContent className="mt-3">
              <div className="flex flex-wrap gap-2">
                {items.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    selected={selectedIds.has(folder.id)}
                    onToggleSelect={handleToggleSelect}
                    onOpen={(f) => onOpenFolder?.(f)}
                    onUpload={(f) => onUpload?.(f)}
                    onDownloadFolder={(f) => onDownloadFolder?.(f)}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </SelectionArea>
  )
}
