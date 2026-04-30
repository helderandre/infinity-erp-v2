'use client'

/**
 * Tracks the pathname the user came from before the current navigation.
 *
 * Why: botões "Voltar" em páginas de detalhe estavam a fazer
 * `router.push('/dashboard/<lista>')` hardcoded, o que ignora o sítio
 * de onde o utilizador veio. Por exemplo, ir do Dashboard → Imóvel X
 * e clicar Voltar levava para /dashboard/imoveis em vez do Dashboard.
 *
 * Esta context guarda o pathname anterior em cada navegação SPA. O
 * hook `useSmartBack(fallback)` devolve um callback que faz `router.back()`
 * quando temos história, ou `router.push(fallback)` quando o utilizador
 * abriu este URL directamente (deep link, refresh, novo tab).
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'

const PreviousPathnameContext = createContext<string | null>(null)

export function PreviousPathnameProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [previous, setPrevious] = useState<string | null>(null)
  const currentRef = useRef<string | null>(null)

  useEffect(() => {
    if (currentRef.current && currentRef.current !== pathname) {
      setPrevious(currentRef.current)
    }
    currentRef.current = pathname
  }, [pathname])

  return (
    <PreviousPathnameContext.Provider value={previous}>
      {children}
    </PreviousPathnameContext.Provider>
  )
}

/** Devolve o pathname anterior dentro da SPA, ou null. */
export function usePreviousPathname(): string | null {
  return useContext(PreviousPathnameContext)
}

/**
 * Devolve um callback "voltar" que tenta navegar para a página anterior
 * (router.back) e, se não houver histórico SPA registado, faz push para
 * o `fallback` fornecido.
 */
export function useSmartBack(fallback: string): () => void {
  const router = useRouter()
  const previous = usePreviousPathname()
  return () => {
    if (previous) {
      router.back()
    } else {
      router.push(fallback)
    }
  }
}
