'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export interface PartnerCategoryRow {
  id: string
  slug: string
  label: string
  icon: string
  color: string
  sort_order: number
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PartnerCategoryColor {
  bg: string
  text: string
  dot: string
  /** soft pastel background used for the card hero when no cover is present */
  softBg: string
}

const TAILWIND_COLOR_TOKENS = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose',
] as const

export type PartnerCategoryColorToken = (typeof TAILWIND_COLOR_TOKENS)[number]

/**
 * Map a colour token (from DB) to concrete Tailwind classes. Keep all classes
 * statically declared so Tailwind's scanner picks them up.
 */
const COLOR_MAP: Record<string, PartnerCategoryColor> = {
  slate:   { bg: 'bg-slate-500/15',   text: 'text-slate-600',   dot: 'bg-slate-500',   softBg: 'bg-slate-50' },
  gray:    { bg: 'bg-gray-500/15',    text: 'text-gray-600',    dot: 'bg-gray-500',    softBg: 'bg-gray-50' },
  zinc:    { bg: 'bg-zinc-500/15',    text: 'text-zinc-600',    dot: 'bg-zinc-500',    softBg: 'bg-zinc-50' },
  neutral: { bg: 'bg-neutral-500/15', text: 'text-neutral-600', dot: 'bg-neutral-500', softBg: 'bg-neutral-50' },
  stone:   { bg: 'bg-stone-500/15',   text: 'text-stone-600',   dot: 'bg-stone-500',   softBg: 'bg-stone-50' },
  red:     { bg: 'bg-red-500/15',     text: 'text-red-600',     dot: 'bg-red-500',     softBg: 'bg-red-50' },
  orange:  { bg: 'bg-orange-500/15',  text: 'text-orange-600',  dot: 'bg-orange-500',  softBg: 'bg-orange-50' },
  amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-600',   dot: 'bg-amber-500',   softBg: 'bg-amber-50' },
  yellow:  { bg: 'bg-yellow-500/15',  text: 'text-yellow-600',  dot: 'bg-yellow-500',  softBg: 'bg-yellow-50' },
  lime:    { bg: 'bg-lime-500/15',    text: 'text-lime-600',    dot: 'bg-lime-500',    softBg: 'bg-lime-50' },
  green:   { bg: 'bg-green-500/15',   text: 'text-green-600',   dot: 'bg-green-500',   softBg: 'bg-green-50' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', dot: 'bg-emerald-500', softBg: 'bg-emerald-50' },
  teal:    { bg: 'bg-teal-500/15',    text: 'text-teal-600',    dot: 'bg-teal-500',    softBg: 'bg-teal-50' },
  cyan:    { bg: 'bg-cyan-500/15',    text: 'text-cyan-600',    dot: 'bg-cyan-500',    softBg: 'bg-cyan-50' },
  sky:     { bg: 'bg-sky-500/15',     text: 'text-sky-600',     dot: 'bg-sky-500',     softBg: 'bg-sky-50' },
  blue:    { bg: 'bg-blue-500/15',    text: 'text-blue-600',    dot: 'bg-blue-500',    softBg: 'bg-blue-50' },
  indigo:  { bg: 'bg-indigo-500/15',  text: 'text-indigo-600',  dot: 'bg-indigo-500',  softBg: 'bg-indigo-50' },
  violet:  { bg: 'bg-violet-500/15',  text: 'text-violet-600',  dot: 'bg-violet-500',  softBg: 'bg-violet-50' },
  purple:  { bg: 'bg-purple-500/15',  text: 'text-purple-600',  dot: 'bg-purple-500',  softBg: 'bg-purple-50' },
  fuchsia: { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-600', dot: 'bg-fuchsia-500', softBg: 'bg-fuchsia-50' },
  pink:    { bg: 'bg-pink-500/15',    text: 'text-pink-600',    dot: 'bg-pink-500',    softBg: 'bg-pink-50' },
  rose:    { bg: 'bg-rose-500/15',    text: 'text-rose-600',    dot: 'bg-rose-500',    softBg: 'bg-rose-50' },
}

export const PARTNER_CATEGORY_COLOR_OPTIONS = TAILWIND_COLOR_TOKENS

export function resolvePartnerCategoryColor(token: string): PartnerCategoryColor {
  return COLOR_MAP[token] || COLOR_MAP.slate
}

interface UsePartnerCategoriesReturn {
  categories: PartnerCategoryRow[]
  isLoading: boolean
  refetch: () => Promise<void>
  createCategory: (input: { slug: string; label: string; icon?: string; color?: string; sort_order?: number }) => Promise<PartnerCategoryRow | null>
  updateCategory: (id: string, patch: Partial<Pick<PartnerCategoryRow, 'label' | 'icon' | 'color' | 'sort_order' | 'is_active'>>) => Promise<boolean>
  deleteCategory: (id: string, reassignToSlug?: string) => Promise<{ ok: boolean; partnerCount?: number }>
}

export function usePartnerCategories(): UsePartnerCategoriesReturn {
  const [categories, setCategories] = useState<PartnerCategoryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/partners/categories')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao carregar categorias')
      }
      const json = await res.json()
      setCategories(json.data || [])
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao carregar categorias')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const createCategory = useCallback(async (input: { slug: string; label: string; icon?: string; color?: string; sort_order?: number }) => {
    try {
      const res = await fetch('/api/partners/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao criar categoria')
      }
      const json = await res.json()
      toast.success('Categoria criada')
      await fetchCategories()
      return json.data as PartnerCategoryRow
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar categoria')
      return null
    }
  }, [fetchCategories])

  const updateCategory = useCallback(async (id: string, patch: Partial<Pick<PartnerCategoryRow, 'label' | 'icon' | 'color' | 'sort_order' | 'is_active'>>) => {
    try {
      const res = await fetch(`/api/partners/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao actualizar categoria')
      }
      toast.success('Categoria actualizada')
      await fetchCategories()
      return true
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao actualizar categoria')
      return false
    }
  }, [fetchCategories])

  const deleteCategory = useCallback(async (id: string, reassignToSlug?: string) => {
    try {
      const qs = reassignToSlug ? `?reassign_to=${encodeURIComponent(reassignToSlug)}` : ''
      const res = await fetch(`/api/partners/categories/${id}${qs}`, { method: 'DELETE' })
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        return { ok: false, partnerCount: body.partner_count as number }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao eliminar categoria')
      }
      toast.success('Categoria eliminada')
      await fetchCategories()
      return { ok: true }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao eliminar categoria')
      return { ok: false }
    }
  }, [fetchCategories])

  return { categories, isLoading, refetch: fetchCategories, createCategory, updateCategory, deleteCategory }
}
