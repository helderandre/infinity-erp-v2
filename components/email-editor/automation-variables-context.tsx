'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { VariableItem } from '@/components/automations/variable-picker'

const AutomationVariablesContext = createContext<VariableItem[] | null>(null)

/**
 * Wrap the Craft.js email editor with this provider when inside an automation flow.
 * This enables the @ variable trigger in text components.
 */
export function AutomationVariablesProvider({
  variables,
  children,
}: {
  variables: VariableItem[]
  children: ReactNode
}) {
  return (
    <AutomationVariablesContext.Provider value={variables}>
      {children}
    </AutomationVariablesContext.Provider>
  )
}

/**
 * Returns automation variables when inside an AutomationVariablesProvider,
 * or null when outside (e.g. standalone email template editor).
 */
export function useAutomationVariables(): VariableItem[] | null {
  return useContext(AutomationVariablesContext)
}
