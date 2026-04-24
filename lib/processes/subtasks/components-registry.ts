import type { ComponentType } from 'react'
import { getRuleByKey } from './registry'
import type { SubtaskComponentProps } from './types'

/**
 * Resolver de componentes React a partir do `subtask_key`.
 *
 * Exposto como função para preservar o lazy init do registry — o barrel
 * das rules importa os componentes por cima, pelo que resolver via
 * `getRuleByKey(...).Component` dá o mesmo resultado sem duplicação.
 *
 * Front-end (ex.: `<TaskDetailSheet>`) chama este helper para decidir
 * se a subtarefa é hardcoded (tem Component no registry) ou legacy
 * (cai no renderer antigo por `config.type`).
 */
export function getComponentForSubtaskKey(
  subtaskKey: string
): ComponentType<SubtaskComponentProps> | null {
  const rule = getRuleByKey(subtaskKey)
  return rule?.Component ?? null
}

/**
 * Helper booleano — útil em renderers condicionais que só querem saber
 * se a linha é hardcoded sem resolver o Component.
 */
export function isHardcodedSubtaskKey(subtaskKey: string): boolean {
  if (!subtaskKey) return false
  if (subtaskKey.startsWith('legacy_')) return false
  return getRuleByKey(subtaskKey) !== null
}
