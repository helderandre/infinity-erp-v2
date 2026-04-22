'use client'

import { createElement } from 'react'
import {
  Folder,
  Scale,
  Shield,
  Building2,
  Users,
  BookOpen,
  Briefcase,
  Receipt,
  Megaphone,
  FileText,
  type LucideIcon,
} from 'lucide-react'

/**
 * Curated set of preset icons for company-document categories.
 * Stored as string names in the DB; resolved via `getCategoryIcon()`.
 */
export const CATEGORY_ICON_PRESETS: { name: string; Icon: LucideIcon; label: string }[] = [
  { name: 'Folder',     Icon: Folder,     label: 'Pasta' },
  { name: 'Scale',      Icon: Scale,      label: 'Jurídico' },
  { name: 'Shield',     Icon: Shield,     label: 'Compliance' },
  { name: 'Building2',  Icon: Building2,  label: 'Institucional' },
  { name: 'Users',      Icon: Users,      label: 'Clientes' },
  { name: 'BookOpen',   Icon: BookOpen,   label: 'Formação' },
  { name: 'Briefcase',  Icon: Briefcase,  label: 'Contratos' },
  { name: 'Receipt',    Icon: Receipt,    label: 'Fiscal' },
  { name: 'Megaphone',  Icon: Megaphone,  label: 'Marketing' },
  { name: 'FileText',   Icon: FileText,   label: 'Documentos' },
]

const ICON_MAP: Record<string, LucideIcon> = CATEGORY_ICON_PRESETS.reduce(
  (acc, { name, Icon }) => {
    acc[name] = Icon
    return acc
  },
  {} as Record<string, LucideIcon>
)

/**
 * Resolve a stored icon name (e.g. "Scale") to a Lucide component.
 * Falls back to Folder when the name is missing or unknown.
 */
export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Folder
  return ICON_MAP[name] ?? Folder
}

interface CategoryIconProps {
  name: string | null | undefined
  className?: string
  color?: string | null
}

/**
 * Renders a category icon by name — use this instead of calling
 * `getCategoryIcon()` and spreading into JSX, to keep the rendered
 * component static (lint rule react-hooks/static-components).
 */
export function CategoryIcon({ name, className, color }: CategoryIconProps) {
  return createElement(getCategoryIcon(name), {
    className,
    style: color ? { color } : undefined,
  })
}
