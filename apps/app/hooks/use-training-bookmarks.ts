'use client'

import { useState, useEffect, useCallback } from 'react'

interface Bookmark {
  id: string
  course_id?: string | null
  lesson_id?: string | null
  created_at: string
  course?: { id: string; title: string; slug: string; cover_image_url?: string | null } | null
  lesson?: { id: string; title: string } | null
}

interface UseTrainingBookmarksReturn {
  bookmarks: Bookmark[]
  isLoading: boolean
  toggleBookmark: (data: { course_id?: string; lesson_id?: string }) => Promise<boolean>
  isBookmarked: (courseId?: string, lessonId?: string) => boolean
  refetch: () => void
}

export function useTrainingBookmarks(): UseTrainingBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchBookmarks = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/training/bookmarks')
      if (!res.ok) throw new Error('Erro ao carregar favoritos')
      const data = await res.json()
      setBookmarks(data.data || [])
    } catch (err) {
      console.error('Erro ao carregar favoritos:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks])

  const toggleBookmark = useCallback(async (data: { course_id?: string; lesson_id?: string }): Promise<boolean> => {
    try {
      const res = await fetch('/api/training/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Erro ao guardar favorito')
      await fetchBookmarks()
      return true
    } catch (err) {
      console.error('Erro ao guardar favorito:', err)
      return false
    }
  }, [fetchBookmarks])

  const isBookmarked = useCallback((courseId?: string, lessonId?: string): boolean => {
    return bookmarks.some(b =>
      (courseId && b.course_id === courseId) || (lessonId && b.lesson_id === lessonId)
    )
  }, [bookmarks])

  return { bookmarks, isLoading, toggleBookmark, isBookmarked, refetch: fetchBookmarks }
}
