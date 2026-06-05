'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface EmailVariablesContextValue {
  variables: Record<string, string>
}

const EmailVariablesContext = createContext<EmailVariablesContextValue>({
  variables: {},
})

export function EmailVariablesProvider({
  variables,
  children,
}: {
  variables: Record<string, string>
  children: ReactNode
}) {
  return (
    <EmailVariablesContext.Provider value={{ variables }}>
      {children}
    </EmailVariablesContext.Provider>
  )
}

export function useEmailVariables() {
  return useContext(EmailVariablesContext)
}
