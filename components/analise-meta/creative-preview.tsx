import { ExternalLink, Image as ImageIcon, ImageOff, Video } from 'lucide-react'

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
  adStatus,
}: {
  creative: CreativeRow | null
  fallbackName?: string | null
  fallbackCreativeId?: string | null
  /** effective_status do anúncio — usado para explicar criativos arquivados */
  adStatus?: string | null
}) {
  if (!creative) {
    const status = (adStatus ?? '').toUpperCase()
    const archived = status === 'ARCHIVED' || status === 'DELETED'

    // Criativo arquivado/eliminado — a Meta não devolve a imagem até desarquivar.
    if (archived) {
      return (
        <div className="flex items-start gap-3 text-sm">
          <div className="bg-muted/50 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <ImageOff className="text-muted-foreground/60 h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              Criativo {status === 'DELETED' ? 'eliminado' : 'arquivado'}
            </p>
            <p className="text-muted-foreground text-xs">
              A imagem e o texto só ficam disponíveis quando o anúncio for
              desarquivado no Meta — os criativos arquivados não trazem
              pré-visualização.
            </p>
            {fallbackName && (
              <p className="text-muted-foreground/80 truncate pt-0.5 text-xs">
                {fallbackName}
              </p>
            )}
          </div>
        </div>
      )
    }

    // Anúncio sem criativo de todo (raro) — mensagem neutra, sem sugerir acção.
    if (!fallbackCreativeId && !fallbackName) {
      return (
        <div className="flex items-center gap-3 text-sm">
          <div className="bg-muted/50 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <ImageOff className="text-muted-foreground/60 h-5 w-5" />
          </div>
          <p className="text-muted-foreground">
            Este anúncio não tem um criativo associado.
          </p>
        </div>
      )
    }
    // Criativo existe no anúncio mas ainda não temos a imagem/copy guardadas.
    return (
      <div className="flex items-start gap-3 text-sm">
        <div className="bg-muted/50 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <ImageOff className="text-muted-foreground/60 h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-medium">Pré-visualização ainda por chegar</p>
          <p className="text-muted-foreground text-xs">
            Ainda não temos a imagem e o texto deste criativo. Clica em{' '}
            <strong>Atualizar dados Meta</strong> e escolhe <strong>Criativos</strong>{' '}
            — costuma resolver em poucos minutos.
          </p>
          {fallbackName && (
            <p className="text-muted-foreground/80 truncate pt-0.5 text-xs">
              {fallbackName}
            </p>
          )}
        </div>
      </div>
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
