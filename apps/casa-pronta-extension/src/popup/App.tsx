import { useEffect, useState } from 'react'
import { useAuth } from './lib/useAuth'
import { LoginForm } from './components/LoginForm'
import { NegocioSelector } from './components/NegocioSelector'
import { ActiveNegocio } from './components/ActiveNegocio'
import { storage } from '../shared/storage'
import { SUPABASE_ANON_KEY } from '../shared/api'

export function App() {
  const { state, signIn, signOut } = useAuth()
  const [activeNegocioId, setActiveNegocioId] = useState<string | null>(null)
  const [activeLoaded, setActiveLoaded] = useState(false)

  // Carrega o negócio activo persistido
  useEffect(() => {
    storage.getActiveNegocioId().then((id) => {
      setActiveNegocioId(id)
      setActiveLoaded(true)
    })
  }, [])

  async function handleSelectNegocio(id: string) {
    await storage.setActiveNegocioId(id)
    setActiveNegocioId(id)
  }

  async function handleChangeNegocio() {
    await storage.setActiveNegocioId(null)
    setActiveNegocioId(null)
  }

  async function handleSignOut() {
    await signOut()
    setActiveNegocioId(null)
  }

  // Aviso se a anon key não estiver configurada
  if (!SUPABASE_ANON_KEY) {
    return (
      <div className="p-4">
        <h1 className="text-base font-semibold mb-2">Configuração em falta</h1>
        <p className="text-xs text-gray-600 mb-2">
          A variável <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>{' '}
          não está definida.
        </p>
        <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1">
          <li>
            Copia <code className="bg-gray-100 px-1 rounded">.env.example</code> para{' '}
            <code className="bg-gray-100 px-1 rounded">.env.local</code>
          </li>
          <li>Cola a chave anon do Supabase do Infinity ERP</li>
          <li>
            Corre <code className="bg-gray-100 px-1 rounded">npm run build</code> e recarrega
            a extensão
          </li>
        </ol>
      </div>
    )
  }

  if (state.status === 'loading' || !activeLoaded) {
    return (
      <div className="p-6 text-center text-xs text-gray-500">A carregar…</div>
    )
  }

  if (state.status === 'signed-out') {
    return <LoginForm onSubmit={signIn} />
  }

  const userEmail = state.session.user.email ?? ''

  if (!activeNegocioId) {
    return (
      <NegocioSelector
        onSelect={handleSelectNegocio}
        onSignOut={handleSignOut}
        userEmail={userEmail}
      />
    )
  }

  return (
    <ActiveNegocio
      activeNegocioId={activeNegocioId}
      onChange={handleChangeNegocio}
      onSignOut={handleSignOut}
      userEmail={userEmail}
    />
  )
}
