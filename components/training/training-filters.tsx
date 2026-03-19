'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MultiSelectFilter } from '@/components/shared/multi-select-filter'
import { TRAINING_DIFFICULTY_OPTIONS } from '@/lib/constants'
import { Search, X } from 'lucide-react'
import type { TrainingCategory } from '@/types/training'

interface TrainingFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  categories: TrainingCategory[]
  onClear: () => void
  hasActiveFilters: boolean
  selectedCategories: string[]
  onCategoriesChange: (value: string[]) => void
  selectedDifficulties: string[]
  onDifficultiesChange: (value: string[]) => void
}

export function TrainingFilters({
  search,
  onSearchChange,
  categories,
  onClear,
  hasActiveFilters,
  selectedCategories,
  onCategoriesChange,
  selectedDifficulties,
  onDifficultiesChange,
}: TrainingFiltersProps) {
  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }))

  const difficultyOptions = TRAINING_DIFFICULTY_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Pesquisar formações..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 rounded-full bg-muted/50 border-0 text-sm"
        />
      </div>

      <MultiSelectFilter
        title="Categoria"
        options={categoryOptions}
        selected={selectedCategories}
        onSelectedChange={onCategoriesChange}
        searchable={categories.length > 8}
      />

      <MultiSelectFilter
        title="Nível"
        options={difficultyOptions}
        selected={selectedDifficulties}
        onSelectedChange={onDifficultiesChange}
      />

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 px-2 rounded-full text-xs">
          <X className="mr-1 h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  )
}
