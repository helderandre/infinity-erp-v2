import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; error?: string }
  | { status: 'signed-in'; session: Session }

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const supabase = getSupabase()

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ status: 'signed-out', error: error.message })
          return
        }
        if (data.session) {
          setState({ status: 'signed-in', session: data.session })
        } else {
          setState({ status: 'signed-out' })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setState({ status: 'signed-out', error: String(err) })
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session) {
        setState({ status: 'signed-in', session })
      } else {
        setState({ status: 'signed-out' })
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setState({ status: 'loading' })
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    })
    if (error || !data.session) {
      setState({ status: 'signed-out', error: error?.message ?? 'Credenciais inválidas' })
      return { ok: false, error: error?.message ?? 'Credenciais inválidas' }
    }
    setState({ status: 'signed-in', session: data.session })
    return { ok: true }
  }, [])

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut()
    await chrome.storage.local.remove('mube.activeNegocioId')
    setState({ status: 'signed-out' })
  }, [])

  return { state, signIn, signOut }
}
