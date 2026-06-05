import { AlertCircle } from 'lucide-react'

const COPY: Record<string, { title: string; body: string }> = {
  expired: {
    title: 'Este link expirou',
    body: 'O link para submissão já não é válido. Por favor contacte o seu consultor para receber um novo.',
  },
  completed: {
    title: 'Submissão já concluída',
    body: 'Os dados deste convite já foram submetidos. Se precisa de corrigir algo, contacte o seu consultor.',
  },
  revoked: {
    title: 'Convite cancelado',
    body: 'Este convite foi cancelado pelo seu consultor. Por favor solicite um novo.',
  },
}

export function InviteUnavailable({
  reason,
  propertyTitle,
}: {
  reason: string
  propertyTitle?: string
}) {
  const copy = COPY[reason] || COPY.expired
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">{copy.title}</h1>
        {propertyTitle ? (
          <p className="text-sm text-muted-foreground">
            Imóvel: <span className="font-medium">{propertyTitle}</span>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>
    </div>
  )
}
