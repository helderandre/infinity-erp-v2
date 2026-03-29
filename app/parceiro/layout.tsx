'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface PartnerData {
  id: string
  name: string
  email: string | null
  company: string | null
  partner_type: string
}

const PartnerContext = createContext<PartnerData | null>(null)
export function usePartner() { return useContext(PartnerContext) }

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const [partner, setPartner] = useState<PartnerData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function validate() {
      setIsLoading(true)
      try {
        // If token in URL, validate it
        const token = searchParams.get('token')
        const url = token
          ? `/api/parceiro/validate?token=${token}`
          : '/api/parceiro/validate'

        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setPartner(data.partner)
          // Clean token from URL after successful validation
          if (token) {
            router.replace('/parceiro')
          }
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error || 'Sessão inválida')
        }
      } catch {
        setError('Erro de ligação')
      } finally {
        setIsLoading(false)
      }
    }
    validate()
  }, [searchParams, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !partner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-950 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold mb-2">Acesso Indisponível</h1>
          <p className="text-sm text-muted-foreground">{error || 'Link inválido ou expirado.'}</p>
          <p className="text-xs text-muted-foreground mt-4">
            Contacte a Infinity Group para obter um novo link de acesso.
          </p>
        </div>
      </div>
    )
  }

  return (
    <PartnerContext.Provider value={partner}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Infinity Group</p>
              <p className="text-[11px] text-muted-foreground">Portal de Parceiro</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{partner.name}</p>
              {partner.company && (
                <p className="text-[11px] text-muted-foreground">{partner.company}</p>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-3xl mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </PartnerContext.Provider>
  )
}
