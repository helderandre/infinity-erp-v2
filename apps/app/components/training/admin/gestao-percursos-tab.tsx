// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { LearningPathCard } from '@/components/training/learning-path-card'
import type { TrainingLearningPath } from '@/types/training'

export function GestaoPercursosTab() {
  const router = useRouter()
  const [paths, setPaths] = useState<TrainingLearningPath[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPaths = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/training/learning-paths')
      if (!res.ok) throw new Error('Erro')
      const data = await res.json()
      setPaths(data.data || [])
    } catch {
      setPaths([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPaths() }, [fetchPaths])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
      </div>
    )
  }

  if (paths.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Nenhum percurso disponível</h3>
        <p className="text-sm text-muted-foreground mt-1">Os percursos de formação serão adicionados em breve.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {paths.map(path => (
        <LearningPathCard
          key={path.id}
          path={path}
          onClick={() => router.push(`/dashboard/formacoes/percursos/${path.id}`)}
        />
      ))}
    </div>
  )
}
