import type { LucideIcon } from 'lucide-react'
import {
  Fuel,
  ParkingCircle,
  UtensilsCrossed,
  Gift,
  Smartphone,
  Megaphone,
  FileText,
  Boxes,
  GraduationCap,
  MoreHorizontal,
} from 'lucide-react'

/**
 * Categorias de despesas pessoais agrupadas por contexto, com ícone para
 * scan visual rápido. A ordem dentro de cada grupo é por frequência de uso
 * estimada para um consultor imobiliário.
 *
 * Os strings (`name`) são a chave persistida em DB — preservar para não
 * quebrar despesas já registadas.
 */
export const PERSONAL_EXPENSE_CATEGORY_GROUPS: Array<{
  label: string
  items: Array<{ name: string; icon: LucideIcon }>
}> = [
  {
    label: 'Mobilidade',
    items: [
      { name: 'Deslocações & combustível', icon: Fuel },
      { name: 'Estacionamento & portagens', icon: ParkingCircle },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { name: 'Refeições com clientes', icon: UtensilsCrossed },
      { name: 'Brindes & atenções', icon: Gift },
    ],
  },
  {
    label: 'Comunicação & marketing',
    items: [
      { name: 'Telemóvel & dados', icon: Smartphone },
      { name: 'Marketing pessoal', icon: Megaphone },
    ],
  },
  {
    label: 'Escritório',
    items: [
      { name: 'Material de escritório', icon: FileText },
      { name: 'Subscrições & software', icon: Boxes },
      { name: 'Formação & eventos', icon: GraduationCap },
    ],
  },
  {
    label: 'Outras',
    items: [
      { name: 'Outras', icon: MoreHorizontal },
    ],
  },
]

/** Lista flat de todos os labels (para casos que precisam só do array). */
export const DEFAULT_PERSONAL_EXPENSE_CATEGORIES =
  PERSONAL_EXPENSE_CATEGORY_GROUPS.flatMap((g) => g.items.map((it) => it.name))

/** Devolve o ícone associado a uma categoria. Fallback para MoreHorizontal. */
export function getCategoryIcon(category: string): LucideIcon {
  for (const group of PERSONAL_EXPENSE_CATEGORY_GROUPS) {
    const found = group.items.find((it) => it.name === category)
    if (found) return found.icon
  }
  return MoreHorizontal
}

export type DefaultPersonalExpenseCategory =
  (typeof DEFAULT_PERSONAL_EXPENSE_CATEGORIES)[number]
