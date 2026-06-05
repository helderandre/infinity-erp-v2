import OpenAI from 'openai'

let client: OpenAI | null = null
function getClient() {
  if (client) return client
  if (!process.env.OPENAI_API_KEY) return null
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

/**
 * Rewrite a property description to fit a single A4 ficha page.
 * Targets ~500 characters in PT-PT, commercial tone, preserving headline details.
 * If the input is already short enough or OpenAI is unavailable, returns the
 * original description unchanged.
 */
export async function summarizeDescriptionForFicha(
  description: string,
  opts: { targetChars?: number } = {},
): Promise<string> {
  const target = opts.targetChars ?? 500
  const stripped = (description || '').trim()
  if (stripped.length <= target) return stripped

  const ai = getClient()
  if (!ai) return stripped

  try {
    const completion = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'És um redactor imobiliário português (PT-PT). Reescreves descrições de imóveis em português europeu, tom comercial, objectivo e apelativo. Não usas bullets, emojis, negrito ou markdown. Respondes apenas com o texto reescrito — sem preâmbulo, sem aspas.',
        },
        {
          role: 'user',
          content:
            `Reescreve a descrição abaixo para caber numa ficha A4, mantendo os pontos-chave (tipologia, áreas, localização, características diferenciadoras). O resultado deve ter aproximadamente ${target} caracteres (podes ficar ligeiramente acima/abaixo). Mantém PT-PT.\n\nDescrição original:\n${stripped}`,
        },
      ],
    })
    const out = completion.choices?.[0]?.message?.content?.trim()
    return out && out.length > 0 ? out : stripped
  } catch (err) {
    console.error('[summarize-description] erro:', err)
    return stripped
  }
}
