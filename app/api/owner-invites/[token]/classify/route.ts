import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { z } from 'zod'
import { loadInviteByToken, isInviteUsable } from '@/lib/owner-invites/server'
import {
  OWNER_DOC_SLOTS,
  type OwnerInviteContext,
  type OwnerDocSlot,
} from '@/lib/owner-invites/doc-slots'
import { PROPERTY_DOC_SLOTS } from '@/lib/owner-invites/property-doc-slots'

const schema = z.object({
  context: z.enum([
    'singular',
    'singular_heranca_cabeca',
    'singular_heranca_herdeiro',
    'coletiva',
  ]),
  files: z
    .array(
      z.object({
        file_url: z.string().url(),
        file_name: z.string(),
        mime_type: z.string().optional(),
      })
    )
    .min(1)
    .max(12),
})

// AI helper: given uploaded files + the active context, classify each file
// into one of the known slot slugs (or "desconhecido" if it does not match).
// The public form then lets the user confirm / override the suggestion.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invite = await loadInviteByToken(token)
  if (!invite) {
    return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })
  }
  const usable = isInviteUsable(invite)
  if (!usable.ok) {
    return NextResponse.json(
      { error: 'Convite indisponível', reason: usable.reason },
      { status: 410 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Serviço de IA não configurado' },
      { status: 503 }
    )
  }

  // Classify across BOTH owner-context slots AND property-level slots so
  // the public form can do a single "carregar tudo" that distributes files
  // into either bucket. The form decides where the file lands based on the
  // returned slot slug — we tag each slot with its scope to disambiguate.
  type ScopedSlot = OwnerDocSlot & { scope: 'owner' | 'property' }
  const ownerSlots: ScopedSlot[] = OWNER_DOC_SLOTS[
    parsed.data.context as OwnerInviteContext
  ].map((s) => ({ ...s, scope: 'owner' }))
  const propertySlots: ScopedSlot[] = PROPERTY_DOC_SLOTS.map((s) => ({
    ...s,
    scope: 'property',
  }))
  const slots: ScopedSlot[] = [...ownerSlots, ...propertySlots]

  const slotDescriptor = slots
    .map(
      (s) =>
        `- ${s.slug} (${s.scope === 'owner' ? 'do proprietário' : 'do imóvel'}): ${s.label}${s.aliases?.length ? ` (sinónimos: ${s.aliases.join(', ')})` : ''}`
    )
    .join('\n')

  const openai = new OpenAI({ apiKey })

  const results: {
    file_url: string
    suggested_slot: string
    suggested_scope: 'owner' | 'property' | 'unknown'
    confidence: 'alta' | 'media' | 'baixa'
  }[] = []

  // Process sequentially — the public user uploads a handful of files max.
  for (const f of parsed.data.files) {
    const isPdf =
      f.mime_type === 'application/pdf' ||
      f.file_name.toLowerCase().endsWith('.pdf')

    let userContent: OpenAI.Chat.ChatCompletionContentPart[]
    try {
      if (isPdf) {
        const res = await fetch(f.file_url)
        if (!res.ok) throw new Error('fetch failed')
        const buf = await res.arrayBuffer()
        const b64 = Buffer.from(buf).toString('base64')
        userContent = [
          {
            type: 'image_url',
            image_url: { url: `data:application/pdf;base64,${b64}` },
          } as any,
        ]
      } else {
        userContent = [
          {
            type: 'image_url',
            image_url: { url: f.file_url, detail: 'low' },
          },
        ]
      }
    } catch {
      results.push({
        file_url: f.file_url,
        suggested_slot: 'unknown',
        suggested_scope: 'unknown',
        confidence: 'baixa',
      })
      continue
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Classificas documentos portugueses relativos a proprietários de imóveis.
Slots possíveis:
${slotDescriptor}

Regras:
- Escolhe o slug exato da lista acima.
- Se não tiveres certeza suficiente, devolve "unknown".
- Considera também o nome do ficheiro: "${f.file_name}".
- Responde APENAS em JSON: {"slug":"<slug>","confidence":"alta"|"media"|"baixa"}.`,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        max_tokens: 60,
        temperature: 0,
      })

      const raw = completion.choices[0]?.message?.content || '{}'
      const cleaned = raw
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      const parsedAi = JSON.parse(cleaned) as {
        slug?: string
        confidence?: string
      }

      const matched = slots.find((s) => s.slug === parsedAi.slug)
      results.push({
        file_url: f.file_url,
        suggested_slot: matched ? matched.slug : 'unknown',
        suggested_scope: matched ? matched.scope : 'unknown',
        confidence:
          (parsedAi.confidence as 'alta' | 'media' | 'baixa') || 'baixa',
      })
    } catch (err) {
      console.error('Classify error for', f.file_name, err)
      results.push({
        file_url: f.file_url,
        suggested_slot: 'unknown',
        suggested_scope: 'unknown',
        confidence: 'baixa',
      })
    }
  }

  return NextResponse.json({ results })
}
