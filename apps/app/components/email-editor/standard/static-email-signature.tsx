'use client'

import { useResolvedSignature } from '@/hooks/use-resolved-signature'

interface StaticEmailSignatureProps {
  consultantId?: string | null
  width?: number
  align?: 'left' | 'center' | 'right'
  padding?: number
  background?: string
}

export function StaticEmailSignature({
  consultantId,
  width = 100,
  align = 'center',
  padding = 8,
  background = 'transparent',
}: StaticEmailSignatureProps) {
  const { url, loading } = useResolvedSignature(consultantId)

  return (
    <div
      style={{
        padding: `${padding}px`,
        background,
        width: '100%',
        textAlign: align,
      }}
    >
      {loading ? (
        <div
          style={{
            color: '#999',
            fontSize: '12px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          A carregar...
        </div>
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Assinatura do consultor"
          style={{
            width: `${width}%`,
            maxWidth: '100%',
            height: 'auto',
            display: 'inline-block',
          }}
        />
      ) : (
        <div
          style={{
            border: '2px dashed #d4d4d4',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
            color: '#999',
            fontSize: '12px',
          }}
        >
          {consultantId
            ? 'Este consultor não tem assinatura configurada. Carregue uma imagem no perfil do consultor.'
            : 'A assinatura do consultor aparecerá aqui no envio real.'}
        </div>
      )}
    </div>
  )
}
