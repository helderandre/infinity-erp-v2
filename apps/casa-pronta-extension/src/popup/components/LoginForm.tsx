import { useState, type FormEvent } from 'react'

interface Props {
  onSubmit: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
}

export function LoginForm({ onSubmit }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await onSubmit(email, password)
    setLoading(false)
    if (!res.ok) setError(res.error ?? 'Erro ao iniciar sessão')
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
      <div>
        <h1 className="text-base font-semibold">Iniciar sessão</h1>
        <p className="text-xs text-gray-500">Usa as credenciais do Infinity ERP</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-700">Email</span>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-mube-600 focus:border-mube-600"
          placeholder="nome@infinitygroup.pt"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-700">Palavra-passe</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-mube-600 focus:border-mube-600"
        />
      </label>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-mube-600 hover:bg-mube-700 disabled:bg-mube-400 text-white rounded px-3 py-1.5 text-sm font-medium transition-colors"
      >
        {loading ? 'A entrar…' : 'Entrar'}
      </button>
    </form>
  )
}
