// Wrapper tipado sobre chrome.storage.local.

const KEYS = {
  session: 'mube.session',
  activeNegocioId: 'mube.activeNegocioId',
} as const

export interface StoredSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  userEmail: string
}

export const storage = {
  async getSession(): Promise<StoredSession | null> {
    const res = await chrome.storage.local.get(KEYS.session)
    return (res[KEYS.session] as StoredSession | undefined) ?? null
  },
  async setSession(session: StoredSession | null) {
    if (session === null) {
      await chrome.storage.local.remove(KEYS.session)
    } else {
      await chrome.storage.local.set({ [KEYS.session]: session })
    }
  },
  async getActiveNegocioId(): Promise<string | null> {
    const res = await chrome.storage.local.get(KEYS.activeNegocioId)
    return (res[KEYS.activeNegocioId] as string | undefined) ?? null
  },
  async setActiveNegocioId(id: string | null) {
    if (id === null) {
      await chrome.storage.local.remove(KEYS.activeNegocioId)
    } else {
      await chrome.storage.local.set({ [KEYS.activeNegocioId]: id })
    }
  },
}
