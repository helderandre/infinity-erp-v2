import { useEffect, useState } from 'react'
import type { NegocioResumo } from '../../shared/types'
import { fetchNegocios } from '../lib/negocios'

interface Props {
  activeNegocioId: string
  onChange: () => void
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

export function ActiveNegocio({ activeNegocioId, onChange, onSignOut, userEmail }: Props) {
  const [negocio, setNegocio] = useState<NegocioResumo | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetchNegocios().then((list) => {
      const match = list.find((n) => n.id === activeNegocioId)
      if (match) {
        setNegocio(match)
      } else {
        setNotFound(true)
      }
    })
  }, [activeNegocioId])

  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="min-w-0">
          <div className="text-xs text-gray-500 truncate">{userEmail}</div>
          <div className="text-sm font-semibold">Negócio activo</div>
        </div>
        <button
          onClick={onSignOut}
          className="text-xs text-gray-500 hover:text-gray-800 underline decoration-dotted"
        >
          Sair
        </button>
      </header>

      <div className="p-4">
        {negocio === null && !notFound && (
          <div className="text-xs text-gray-500">A carregar…</div>
        )}

        {notFound && (
          <div className="mb-3 p-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded">
            O negócio activo não foi encontrado. Selecciona outro.
          </div>
        )}

        {negocio && (
          <div className="mb-4 p-3 rounded border border-mube-200 bg-mube-50">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-mono text-mube-800">{negocio.referencia}</span>
              <span className="text-[10px] uppercase tracking-wide text-mube-800 bg-white px-1.5 py-0.5 rounded">
                {negocio.estado}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-900">
              {negocio.imovel_endereco ?? 'Imóvel sem morada'}
            </div>
            <div className="text-xs text-gray-700 mt-1">
              <div>
                <span className="font-medium">Vendedor:</span> {negocio.vendedor_nome ?? '—'}
              </div>
              <div>
                <span className="font-medium">Comprador:</span> {negocio.comprador_nome ?? '—'}
              </div>
            </div>
            <div className="text-sm text-gray-900 font-semibold mt-2">
              {formatPrice(negocio.preco)}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 mb-3 leading-relaxed">
          Navega para o formulário do Casa Pronta. Vai aparecer um botão{' '}
          <span className="font-medium text-gray-800">⚡ Preencher com MUBE</span> no canto
          superior direito.
        </div>

        <button
          onClick={onChange}
          className="w-full border border-gray-300 hover:border-mube-600 hover:bg-mube-50 text-gray-700 rounded px-3 py-1.5 text-sm font-medium transition-colors"
        >
          Mudar de negócio
        </button>
      </div>
    </div>
  )
}
