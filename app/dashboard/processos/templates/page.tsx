'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TemplateList } from '@/components/templates/template-list'
import { FileStack, Plus, Search, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/use-debounce'
import type { TemplateWithCounts } from '@/types/template'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Erro ao carregar templates')
      const data = await res.json()
      setTemplates(data)
    } catch (error) {
      console.error('Erro ao carregar templates:', error)
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Filtrar no frontend (lista pequena)
  const filteredTemplates = templates.filter((tpl) => {
    if (!debouncedSearch) return true
    const q = debouncedSearch.toLowerCase()
    return (
      tpl.name.toLowerCase().includes(q) ||
      tpl.description?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/processos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Templates de Processo</h1>
            <p className="text-muted-foreground">
              Crie e gira moldes reutilizáveis de processos documentais
            </p>
          </div>
        </div>
        <Button onClick={() => router.push('/dashboard/processos/templates/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {/* Pesquisa */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Nenhum template encontrado"
          description={
            search
              ? 'Tente ajustar os critérios de pesquisa'
              : 'Crie o seu primeiro template de processo'
          }
          action={
            !search
              ? {
                  label: 'Novo Template',
                  onClick: () => router.push('/dashboard/processos/templates/novo'),
                }
              : undefined
          }
        />
      ) : (
        <TemplateList
          templates={filteredTemplates}
          onRefresh={loadTemplates}
        />
      )}
    </div>
  )
}
