import { ExternalLink, Image as ImageIcon, Video } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

export interface CreativeRow {
  creative_id: string
  name: string | null
  title: string | null
  body: string | null
  cta_type: string | null
  link_url: string | null
  image_url: string | null
  thumbnail_url: string | null
  video_id: string | null
}

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'Saber mais',
  SIGN_UP: 'Inscrever-se',
  SUBSCRIBE: 'Subscrever',
  CONTACT_US: 'Contactar',
  GET_QUOTE: 'Pedir orçamento',
  APPLY_NOW: 'Candidatar',
  BOOK_TRAVEL: 'Reservar',
  DOWNLOAD: 'Transferir',
  GET_OFFER: 'Ver oferta',
  MESSAGE_PAGE: 'Enviar mensagem',
  CALL_NOW: 'Ligar agora',
  SEND_MESSAGE: 'Enviar mensagem',
  WHATSAPP_MESSAGE: 'WhatsApp',
  NO_BUTTON: 'Sem botão',
}

function ctaLabel(cta: string | null): string | null {
  if (!cta) return null
  return CTA_LABELS[cta] ?? cta
}

/**
 * Preview do criativo de um anúncio — imagem/vídeo + título + copy + CTA + link.
 * Lê de meta.meta_creatives_raw (entregue por creative.synced). `fallbackName`
 * é o creative_name vindo de ad.synced quando ainda não há criativo completo.
 */
export function CreativePreview({
  creative,
  fallbackName,
  fallbackCreativeId,
}: {
  creative: CreativeRow | null
  fallbackName?: string | null
  fallbackCreativeId?: string | null
}) {
  if (!creative) {
    if (fallbackName || fallbackCreativeId) {
      return (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Criativo ainda não sincronizado em detalhe. Usa{' '}
            <strong>Atualizar dados Meta</strong> (com “Criativos”) para puxar
            imagem/vídeo, copy e CTA.
          </p>
          {fallbackName && (
            <p>
              Nome:{' '}
              <span className="font-medium">{fallbackName}</span>
            </p>
          )}
          {fallbackCreativeId && (
            <p className="text-muted-foreground font-mono text-[10px]">
              {fallbackCreativeId}
            </p>
          )}
        </div>
      )
    }
    return (
      <p className="text-muted-foreground text-sm">
        Este anúncio não tem criativo associado.
      </p>
    )
  }

  const media = creative.image_url ?? creative.thumbnail_url
  const cta = ctaLabel(creative.cta_type)

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {/* Media */}
      <div className="bg-muted/40 relative flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border sm:w-44">
        {media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media}
            alt={creative.title ?? creative.name ?? 'Criativo'}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="text-muted-foreground/40 h-10 w-10" />
        )}
        {creative.video_id && (
          <Badge className="absolute left-2 top-2 gap-1 text-[10px]" variant="secondary">
            <Video className="h-3 w-3" />
            Vídeo
          </Badge>
        )}
      </div>

      {/* Texto */}
      <div className="min-w-0 flex-1 space-y-2">
        {creative.title && (
          <p className="text-sm font-semibold leading-snug">{creative.title}</p>
        )}
        {creative.body && (
          <p className="text-muted-foreground line-clamp-4 whitespace-pre-line text-sm">
            {creative.body}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {cta && (
            <Badge variant="outline" className="text-[10px]">
              {cta}
            </Badge>
          )}
          {creative.link_url && (
            <a
              href={creative.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Link de destino
            </a>
          )}
        </div>
        {creative.name && (
          <p className="text-muted-foreground pt-1 text-[11px]">
            {creative.name}{' '}
            <span className="font-mono">· {creative.creative_id}</span>
          </p>
        )}
      </div>
    </div>
  )
}
