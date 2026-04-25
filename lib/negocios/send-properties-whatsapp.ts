/**
 * Envio de imóveis pelo WhatsApp, um por um — replica o padrão do
 * chat-thread.tsx (PropertyPickerDialog → onSendPropertyCards) para o
 * contexto de envio a partir do dossier de um negócio.
 *
 * Cada imóvel é uma mensagem independente: imagem com caption ou texto.
 */

export interface PropertyToSend {
  /** id da row em negocio_properties (para marcar status='sent' depois). */
  negocioPropertyId: string
  title: string
  slug: string | null
  listing_price: number | null
  typology: string | null
  area_util: number | null
  city: string | null
  cover_url: string | null
}

export interface DossierSendResult {
  negocioPropertyId: string
  ok: boolean
  error?: string
}

const PUBLIC_WEBSITE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_WEBSITE_URL) ||
  'https://infinitygroup.pt'

/**
 * Tenta encontrar (ou criar) o chat WhatsApp da instância do utilizador
 * actual para um determinado telefone. Devolve `chat_id` ou null.
 */
export async function resolveLeadChat(
  phone: string,
  name: string,
): Promise<string | null> {
  if (!phone) return null
  try {
    const url = `/api/whatsapp/resolve-chat?phone=${encodeURIComponent(phone)}${name ? `&name=${encodeURIComponent(name)}` : ''}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    if (json?.found && json?.chat_id) return json.chat_id as string
    return null
  } catch {
    return null
  }
}

function buildCaption(item: PropertyToSend): string {
  const lines: string[] = [
    `🏠 *${item.title}*`,
    item.listing_price
      ? `💰 ${new Intl.NumberFormat('pt-PT', {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0,
        }).format(item.listing_price)}`
      : '',
    [item.typology, item.area_util ? `${item.area_util}m²` : '', item.city]
      .filter(Boolean)
      .join(' · '),
  ]

  if (item.slug) {
    lines.push('', `${PUBLIC_WEBSITE_URL}/property/${item.slug}`)
  }

  return lines.filter((l) => l !== '').join('\n')
}

/**
 * Envia 1 imóvel: tenta imagem+caption, com fallback para texto.
 */
export async function sendOneProperty(
  chatId: string,
  item: PropertyToSend,
): Promise<boolean> {
  const caption = buildCaption(item)

  // Tenta media (imagem + caption)
  if (item.cover_url) {
    try {
      const imgRes = await fetch(item.cover_url)
      if (imgRes.ok) {
        const blob = await imgRes.blob()
        const file = new File([blob], `${item.slug || 'imovel'}.jpg`, {
          type: blob.type || 'image/jpeg',
        })
        const fd = new FormData()
        fd.append('file', file)
        fd.append('chat_id', chatId)
        const upRes = await fetch('/api/whatsapp/media/upload', {
          method: 'POST',
          body: fd,
        })
        if (upRes.ok) {
          const up = await upRes.json()
          const sendRes = await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_media',
              type: 'image',
              file_url: up.url,
              caption,
              file_name: up.file_name || file.name,
              mime_type: up.mime_type || file.type,
              file_size: up.size || file.size,
            }),
          })
          if (sendRes.ok) return true
        }
      }
    } catch {
      // fallback para texto
    }
  }

  // Fallback: texto puro
  const textRes = await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send_text', text: caption }),
  })
  return textRes.ok
}
