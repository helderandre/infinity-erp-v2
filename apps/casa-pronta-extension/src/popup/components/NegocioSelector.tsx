import { useEffect, useState } from 'react'
import type { NegocioResumo } from '../../shared/types'
import { fetchNegocios } from '../lib/negocios'

interface Props {
  onSelect: (negocioId: string) => void
  onSignOut: () => void
  userEmail: string
}

function formatPrice(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function NegocioSelector({ onSelect, onSignOut, userEmail }: Props) {
  const [negocios, setNegocios] = useState<NegocioResumo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNegocios()
      .then(setNegocios)
      .catch((err) => setError(String(err)))
  }, [])

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="min-w-0">
          <div className="text-xs text-gray-500 truncate">{userEmail}</div>
          <div className="text-sm font-semibold">Escolher negócio</div>
        </div>
        <button
          onClick={onSignOut}
          className="text-xs text-gray-500 hover:text-gray-800 underline decoration-dotted"
        >
          Sair
        </button>
      </header>

      <div className="p-2 max-h-[420px] overflow-y-auto">
        {negocios === null && !error && (
          <div className="p-4 text-center text-xs text-gray-500">A carregar negócios…</div>
        )}
        {error && (
          <div className="m-2 p-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}
        {negocios?.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-500">
            Nenhum negócio elegível encontrado.
          </div>
        )}
        {negocios?.map((n) => (
          <button
            key={n.id}
            onClick={() => onSelect(n.id)}
            className="w-full text-left p-3 mb-2 rounded border border-gray-200 hover:border-mube-600 hover:bg-mube-50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-mono text-gray-500">{n.referencia}</span>
              <span className="text-[10px] uppercase tracking-wide text-mube-800 bg-mube-100 px-1.5 py-0.5 rounded">
                {n.estado}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-900 truncate">
              {n.imovel_endereco ?? 'Imóvel sem morada'}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              <span className="font-medium">V:</span> {n.vendedor_nome ?? '—'} ·{' '}
              <span className="font-medium">C:</span> {n.comprador_nome ?? '—'}
            </div>
            <div className="text-xs text-gray-900 font-semibold mt-1">
              {formatPrice(n.preco)}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
