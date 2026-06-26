import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './api'

/**
 * Cliente Supabase partilhado entre popup e content script.
 * O storage custom aponta para chrome.storage.local para que a sessão
 * autenticada no popup seja automaticamente reutilizada pelo content script.
 */

const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const res = await chrome.storage.local.get(key)
    const value = res[key]
    return typeof value === 'string' ? value : null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value })
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key)
  },
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (client) return client
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY não definida. Cria .env.local a partir de .env.example.'
    )
  }
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storage: chromeStorageAdapter as any,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'mube.sb.auth',
    },
  })
  return client
}
