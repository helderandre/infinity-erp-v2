'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TRAINING_DIFFICULTY_OPTIONS } from '@/lib/constants'
import { Search, X } from 'lucide-react'
import type { TrainingCategory } from '@/types/training'

interface TrainingFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  categoryId: string
  onCategoryChange: (value: string) => void
  difficulty: string
  onDifficultyChange: (value: string) => void
  categories: TrainingCategory[]
  onClear: () => void
  hasActiveFilters: boolean
}

export function TrainingFilters({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  difficulty,
  onDifficultyChange,
  categories,
  onClear,
  hasActiveFilters,
}: TrainingFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar formações..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category */}
      <Select value={categoryId} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Todas as categorias" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as categorias</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Difficulty */}
      <Select value={difficulty} onValueChange={onDifficultyChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Todos os níveis" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os níveis</SelectItem>
          {TRAINING_DIFFICULTY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
          <X className="h-4 w-4" />
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
