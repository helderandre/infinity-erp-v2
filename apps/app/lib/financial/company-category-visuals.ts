// Mapeamento dos tokens de `company_categories` (color + icon) para valores
// concretos usados pela UI do Financeiro — donut, legendas e cards.
//
// `company_categories.color` é um token Tailwind (emerald, blue, amber, …) — por
// vezes pode já ser um hex. `company_categories.icon` é o nome de um ícone Lucide.

import {
  Euro, ShoppingBag, Building, Building2, Monitor, Users, Globe, Gift,
  Package, Briefcase, UserPlus, MoreHorizontal, Receipt, Tag, Megaphone,
  CreditCard, Wallet, Banknote, FileText, Wrench, Car, Coffee, type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  Euro, ShoppingBag, Building, Building2, Monitor, Users, Globe, Gift,
  Package, Briefcase, UserPlus, MoreHorizontal, Receipt, Tag, Megaphone,
  CreditCard, Wallet, Banknote, FileText, Wrench, Car, Coffee,
}

/** Devolve o componente Lucide para um nome de ícone (fallback: Tag). */
export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Tag
}

// Tokens de cor → hex. Cobre a paleta usada nas categorias seedadas + extras.
const HEX: Record<string, string> = {
  emerald: '#10b981', green: '#22c55e', teal: '#14b8a6', cyan: '#06b6d4',
  sky: '#0ea5e9', blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6',
  purple: '#a855f7', fuchsia: '#d946ef', pink: '#ec4899', rose: '#f43f5e',
  red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308',
  lime: '#84cc16', slate: '#64748b', gray: '#6b7280', stone: '#78716c',
}

// Paleta de fallback para tokens desconhecidos — determinística por índice.
const FALLBACK = [
  '#0ea5e9', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6',
  '#f97316', '#6366f1', '#84cc16', '#ec4899', '#06b6d4', '#8b5cf6',
]

/**
 * Resolve a cor de uma categoria.
 * @param token  token de cor (`emerald`), hex (`#10b981`) ou null
 * @param index  posição na lista — usado só quando o token é desconhecido
 */
export function categoryHex(token: string | null | undefined, index = 0): string {
  if (token) {
    const t = token.toLowerCase()
    if (HEX[t]) return HEX[t]
    if (/^#[0-9a-f]{3,8}$/i.test(token)) return token
  }
  return FALLBACK[index % FALLBACK.length]
}
