export const DEFAULT_PERSONAL_EXPENSE_CATEGORIES = [
  'Deslocações & combustível',
  'Refeições com clientes',
  'Estacionamento & portagens',
  'Brindes & atenções',
  'Telemóvel & dados',
  'Marketing pessoal',
  'Material de escritório',
  'Subscrições & software',
  'Formação & eventos',
  'Outras',
] as const

export type DefaultPersonalExpenseCategory =
  (typeof DEFAULT_PERSONAL_EXPENSE_CATEGORIES)[number]
