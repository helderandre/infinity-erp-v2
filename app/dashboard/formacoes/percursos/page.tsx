'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LearningPathCard } from '@/components/training/learning-path-card'
import type { TrainingLearningPath } from '@/types/training'

export default function PercursosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PercursosContent />
    </Suspense>
  )
}

function PercursosContent() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/formacoes"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Percursos de Formação</h1>
            <p className="text-muted-foreground">Sequências de cursos organizados por objectivo</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : paths.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Nenhum percurso disponível</h3>
          <p className="text-sm text-muted-foreground mt-1">Os percursos de formação serão adicionados em breve.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paths.map(path => (
            <LearningPathCard
              key={path.id}
              path={path}
              onClick={() => router.push(`/dashboard/formacoes/percursos/${path.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
