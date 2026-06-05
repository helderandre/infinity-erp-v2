'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useUser } from '@/hooks/use-user'
import { ALL_CATEGORIES, CALENDAR_ROLE_PRESETS } from '@/types/calendar'
import type { CalendarCategory } from '@/types/calendar'

interface UseCalendarFiltersReturn {
  categories: CalendarCategory[]
  userId: string | undefined
  filterSelf: boolean
  toggleCategory: (category: CalendarCategory) => void
  setCategories: (categories: CalendarCategory[]) => void
  setUserId: (userId: string | undefined) => void
  toggleFilterSelf: () => void
  resetToDefaults: () => void
}

export function useCalendarFilters(): UseCalendarFiltersReturn {
  const { user, loading } = useUser()

  // Resolve the preset for the current user's role
  const preset = useMemo(() => {
    if (!user?.role?.name) return null
    return CALENDAR_ROLE_PRESETS[user.role.name] ?? null
  }, [user?.role?.name])

  const defaultCategories = useMemo<CalendarCategory[]>(
    () => preset?.categories ?? [...ALL_CATEGORIES],
    [preset]
  )

  const defaultFilterSelf = preset?.filterSelf ?? false

  const [categories, setCategories] = useState<CalendarCategory[]>(defaultCategories)
  const [explicitUserId, setExplicitUserId] = useState<string | undefined>(undefined)
  const [filterSelf, setFilterSelf] = useState(defaultFilterSelf)

  // Sync defaults once user data loads (only on first load)
  const hasInitialised = useRef(false)
  useEffect(() => {
    if (!loading && user && !hasInitialised.current) {
      hasInitialised.current = true
      setCategories(defaultCategories)
      setFilterSelf(defaultFilterSelf)
    }
  }, [loading, user, defaultCategories, defaultFilterSelf])

  const toggleCategory = useCallback((category: CalendarCategory) => {
    setCategories((prev) => {
      if (prev.includes(category)) {
        // Don't allow deselecting all categories
        if (prev.length === 1) return prev
        return prev.filter((c) => c !== category)
      }
      return [...prev, category]
    })
  }, [])

  const toggleFilterSelf = useCallback(() => {
    setFilterSelf((prev) => !prev)
  }, [])

  const setUserId = useCallback((id: string | undefined) => {
    setExplicitUserId(id)
  }, [])

  const resetToDefaults = useCallback(() => {
    setCategories(defaultCategories)
    setFilterSelf(defaultFilterSelf)
    setExplicitUserId(undefined)
  }, [defaultCategories, defaultFilterSelf])

  // Compute the effective userId for filtering:
  // - If filterSelf is active, use the logged-in user's ID
  // - Otherwise, use the explicitly set userId (or undefined for all)
  const userId = useMemo(() => {
    if (filterSelf && user?.id) {
      return user.id
    }
    return explicitUserId
  }, [filterSelf, user?.id, explicitUserId])

  return {
    categories,
    userId,
    filterSelf,
    toggleCategory,
    setCategories,
    setUserId,
    toggleFilterSelf,
    resetToDefaults,
  }
}
