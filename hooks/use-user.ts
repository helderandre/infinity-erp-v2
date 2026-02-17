'use client'

import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { Database } from '@/types/database'

type DevUser = Database['public']['Tables']['dev_users']['Row']
type Role = Database['public']['Tables']['roles']['Row']

// Tipo para o retorno da query com user_roles nested
type DevUserWithRoles = DevUser & {
  user_roles: Array<{
    role: Role
  }>
}

export interface UserWithRole extends DevUser {
  role: Role | null
  auth_user: User | null
}

export function useUser() {
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const fetchUser = async () => {
      try {
        setLoading(true)
        setError(null)

        // Obter utilizador autenticado
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) throw authError
        if (!authUser) {
          setUser(null)
          setLoading(false)
          return
        }

        // Obter dados do dev_users + role (através de user_roles)
        const { data: devUser, error: devUserError } = await supabase
          .from('dev_users')
          .select(
            `
            *,
            user_roles!user_roles_user_id_fkey!inner(
              role:roles(*)
            )
          `
          )
          .eq('id', authUser.id)
          .single()

        if (devUserError) {
          console.error('Erro na query do Supabase:', devUserError)
          throw devUserError
        }

        if (!devUser) {
          console.error('devUser é null/undefined')
          throw new Error('Utilizador não encontrado')
        }

        // Extrair o primeiro role (assumindo 1 role por utilizador por agora)
        const userData = devUser as unknown as DevUserWithRoles

        console.log('userData:', userData)
        console.log('user_roles:', userData.user_roles)

        const role = userData.user_roles?.[0]?.role || null

        // Criar objeto sem user_roles para o estado
        const { user_roles, ...userDataWithoutRoles } = userData

        setUser({
          ...userDataWithoutRoles,
          role: role as Role | null,
          auth_user: authUser,
        })
      } catch (err) {
        console.error('Erro ao carregar utilizador:', err)
        console.error('Tipo do erro:', typeof err)
        console.error('Erro stringificado:', JSON.stringify(err, null, 2))

        if (err && typeof err === 'object' && 'message' in err) {
          console.error('Mensagem do erro:', (err as any).message)
        }

        setError(err instanceof Error ? err : new Error('Erro desconhecido'))
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    // Subscrever mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUser()
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading, error, isAuthenticated: !!user }
}
