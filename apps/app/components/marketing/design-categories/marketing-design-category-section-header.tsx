'use client'

import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { MarketingDesignCategory } from '@/hooks/use-marketing-design-categories'
import { useMarketingDesignCategoriesContext } from './marketing-design-categories-provider'
import { CategoryIcon } from '@/components/documents/company-category-icons'

interface MarketingDesignCategorySectionHeaderProps {
  slug: string
  label: string
  count: number
  category?: MarketingDesignCategory
  onEdit?: (category: MarketingDesignCategory) => void
  onDelete?: (category: MarketingDesignCategory) => void
  onAddDesign?: (category: MarketingDesignCategory | { slug: string; label: string }) => void
}

export function MarketingDesignCategorySectionHeader({
  slug,
  label,
  count,
  category,
  onEdit,
  onDelete,
  onAddDesign,
}: MarketingDesignCategorySectionHeaderProps) {
  const { canManage } = useMarketingDesignCategoriesContext()
  const isOrphan = !category
  const isInactive = category && !category.is_active

  return (
    <div className="flex items-center gap-2 mb-2">
      {!isOrphan && (
        <CategoryIcon
          name={category?.icon}
          color={category?.color ?? undefined}
          className="h-3.5 w-3.5 text-muted-foreground"
        />
      )}
      <h3
        className={cn(
          'text-xs font-semibold uppercase tracking-wider',
          isOrphan || isInactive ? 'text-muted-foreground/70' : 'text-muted-foreground'
        )}
      >
        {label}
        <span className="ml-1.5 text-muted-foreground/60">({count})</span>
      </h3>
      {isOrphan && (
        <Badge variant="outline" className="h-5 text-[10px] font-normal">
          sem categoria · {slug}
        </Badge>
      )}
      {isInactive && (
        <Badge variant="outline" className="h-5 text-[10px] font-normal">
          arquivada
        </Badge>
      )}
      <div className="ml-auto flex items-center gap-1">
        {onAddDesign && !isInactive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full"
            aria-label="Adicionar design nesta categoria"
            title="Novo design"
            onClick={() => onAddDesign(category ?? { slug, label })}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
        {canManage && category && !category.is_system && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 rounded-full"
                aria-label="Acções da categoria"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(category)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(category)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {canManage && category?.is_system && onEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 rounded-full"
                aria-label="Acções da categoria"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(category)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Editar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
