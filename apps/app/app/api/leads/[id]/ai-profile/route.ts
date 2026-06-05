// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import OpenAI from 'openai'

/**
 * GET — return cached AI profile (or null if never generated).
 * POST — regenerate the profile by sending all activities + entries +
 * negocios for this lead to GPT-4o-mini and storing the structured
 * response in `leads.ai_profile` + summary in `leads.ai_profile_summary_md`.
 *
 * The synthesis pulls activities across ALL negocios of this contact —
 * the consultor logs observations either at the contact level or scoped to
 * a specific negocio, but the AI always sees the full picture.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('leads')
      .select('ai_profile, ai_profile_summary_md, ai_profile_generated_at, ai_profile_generated_by')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const supabase = await createClient()

    // 1. Pull lead row
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, nome, email, telemovel, origem, estado, temperatura, observacoes, data_nascimento, empresa')
      .eq('id', id)
      .single()

    if (leadErr) {
      console.error('[ai-profile] lead fetch error:', leadErr)
      return NextResponse.json({ error: leadErr.message }, { status: 500 })
    }
    if (!lead) return NextResponse.json({ error: 'Contacto não encontrado' }, { status: 404 })

    // 2. Pull notes only — tarefas/eventos/calls são acções operacionais,
    //    não dão contexto sobre o cliente. A IA só sintetiza a partir de
    //    observações (`activity_type='note'`) que o consultor registou.
    const { data: crmActs } = await supabase
      .from('leads_activities')
      .select(`
        activity_type, direction, subject, description, occurred_at, created_at, is_pinned,
        negocio:negocios(id, tipo, estado, localizacao)
      `)
      .eq('contact_id', id)
      .eq('activity_type', 'note')
      .order('created_at', { ascending: false })
      .limit(200)

    const { data: legacyActs } = await supabase
      .from('lead_activities')
      .select('activity_type, description, metadata, created_at')
      .eq('lead_id', id)
      .eq('activity_type', 'note')
      .order('created_at', { ascending: false })
      .limit(100)

    // 3. Pull negocios (deal pipeline context)
    const { data: negocios } = await supabase
      .from('negocios')
      .select('id, tipo, estado, localizacao, preco_venda, orcamento, orcamento_max, renda_pretendida, renda_max_mensal, motivacao_compra, prazo_compra, observacoes, created_at')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    // 4. Pull entries (lead capture context)
    const { data: entries } = await supabase
      .from('leads_entries')
      .select('source, raw_name, raw_email, raw_phone, notes, utm_source, utm_campaign, property_external_ref, created_at')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    // ── Build the prompt context ────────────────────────────────────────
    const fmt = (d: string | null | undefined) =>
      d ? format(parseISO(d), "d 'de' MMM yyyy", { locale: pt }) : '?'

    const sections: string[] = []
    sections.push(`# CONTACTO\n- Nome: ${lead.nome}\n- Email: ${lead.email ?? 's/d'}\n- Telemóvel: ${lead.telemovel ?? 's/d'}\n- Estado: ${lead.estado ?? 's/d'} · Temperatura: ${lead.temperatura ?? 's/d'}\n- Origem: ${lead.origem ?? 's/d'}\n- Empresa: ${lead.empresa ?? 's/d'}\n- Data de nascimento: ${lead.data_nascimento ? fmt(lead.data_nascimento) : 's/d'}`)

    if (lead.observacoes) {
      sections.push(`## OBSERVAÇÃO LEGADA (campo único, pré-histórico)\n${lead.observacoes}`)
    }

    const acts = [
      ...(crmActs || []).map((a) => ({
        date: a.occurred_at || a.created_at,
        type: a.activity_type,
        direction: a.direction,
        subject: a.subject,
        description: a.description,
        pinned: a.is_pinned,
        negocio: a.negocio,
      })),
      ...(legacyActs || []).map((a) => ({
        date: a.created_at,
        type: a.activity_type,
        direction: null,
        subject: null,
        description: a.description,
        pinned: false,
        negocio: null,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (acts.length > 0) {
      const lines = acts.map((a) => {
        const negCtx = a.negocio ? ` [Negócio ${a.negocio.tipo} · ${a.negocio.localizacao ?? '?'}]` : ''
        const pin = a.pinned ? ' 📌' : ''
        const dir = a.direction ? ` (${a.direction})` : ''
        const subj = a.subject ? `: ${a.subject}` : ''
        const desc = a.description ? ` — ${a.description}` : ''
        return `- ${fmt(a.date)} · ${a.type}${dir}${pin}${negCtx}${subj}${desc}`
      })
      sections.push(`## OBSERVAÇÕES (${acts.length})\n${lines.join('\n')}`)
    }

    if (negocios && negocios.length > 0) {
      const lines = negocios.map((n) => {
        const valor =
          n.preco_venda ?? n.orcamento_max ?? n.orcamento ?? n.renda_pretendida ?? n.renda_max_mensal
        return `- ${n.tipo} · ${n.localizacao ?? '?'} · ${n.estado ?? '?'} · valor: ${valor ?? '?'} · prazo: ${n.prazo_compra ?? '?'}${n.motivacao_compra ? ` · motivação: ${n.motivacao_compra}` : ''}${n.observacoes ? `\n  notas: ${n.observacoes}` : ''}`
      })
      sections.push(`## NEGÓCIOS (${negocios.length})\n${lines.join('\n')}`)
    }

    if (entries && entries.length > 0) {
      const lines = entries.map((e) =>
        `- ${fmt(e.created_at)} · ${e.source}${e.utm_campaign ? ` (camp: ${e.utm_campaign})` : ''}${e.property_external_ref ? ` · imóvel ${e.property_external_ref}` : ''}${e.notes ? ` — ${e.notes}` : ''}`
      )
      sections.push(`## PONTOS DE CONTACTO INICIAIS (${entries.length})\n${lines.join('\n')}`)
    }

    const context = sections.join('\n\n')

    // ── Call GPT ────────────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `És um analista sénior de CRM imobiliário em Portugal — combinas faro comercial com leitura empática. A partir do dossier abaixo (observações que o consultor anotou ao longo do tempo + negócios e pontos de contacto inicial), produzes um perfil accionável do cliente em PT-PT.

Princípios:
1. Fala directamente ao consultor, como se fosses o seu colega que leu tudo. Sê concreto.
2. Lê entre linhas: tom, urgência, objecções implícitas, sinais de hesitação ou pressa, sensibilidade ao preço, motivações emocionais (familia/investimento/status).
3. Liga pontos: se há incoerências entre observações (ex: orçamento subiu, prazo apertou), aponta-as.
4. NÃO inventes — se um dado não está no dossier, omite. Não inflaciones.

Devolve APENAS um objecto JSON com esta estrutura:
{
  "summary_md": "<resumo executivo em markdown — 4-7 frases. Começa por quem é o cliente e em que momento está; depois o seu objectivo central; termina com a recomendação de próximo passo. Usa **negrito** para os 2-3 factos mais críticos. Não uses títulos H1/H2.>",
  "traits": ["<traço pessoal/profissional/comportamental curto e específico>", ...],
  "preferences": ["<preferência concreta e literal — tipologia, zona, características>", ...],
  "concerns": ["<dúvida, objecção ou risco manifestado, com nuance>", ...],
  "opportunities": ["<próxima acção ou alavanca comercial concreta — com VERBO de acção (ex: 'Propor visita ao T2 em Sintra esta semana — alinha com o prazo de Junho')>", ...],
  "key_dates": [{"label": "<descrição da data — ex: 'Pretende mudar até'>", "date": "<YYYY-MM-DD ou texto interpretativo>"}],
  "data_quality": "<low|medium|high — quão completo é o dossier para sustentar o perfil>"
}

Regras de qualidade:
- Cada lista 0-6 itens. Vazia quando não há evidência directa.
- Itens telegráficos mas com substância (≤140 chars). Evita banalidades como "interessado em comprar".
- Em opportunities, prioriza acções imediatas (esta semana / próxima chamada). Se o dossier é magro, sugere as 2-3 perguntas que deves fazer na próxima conversa para desbloquear.
- Em concerns, escreve a fricção REAL do cliente — "não confia em prazos" é melhor que "tem dúvidas".
- Em traits, foge ao genérico. "Decisor analítico, pede dados antes de avançar" > "Profissional".
- Se o cliente foi rude/difícil, regista factualmente em traits ou concerns sem julgamento moral.
- summary_md: markdown limpo, parágrafos curtos, sem listas (as listas estão nas outras keys). Usa negrito (**X**) com parcimónia — máximo 3 ocorrências.`,
        },
        {
          role: 'user',
          content: context,
        },
      ],
      max_tokens: 1500,
      temperature: 0.4,
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) {
      return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 502 })
    }

    let profile: any
    try {
      profile = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Resposta inválida da IA' }, { status: 502 })
    }

    const summaryMd = typeof profile.summary_md === 'string' ? profile.summary_md : null

    // ── Persist ─────────────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('leads')
      .update({
        ai_profile: profile,
        ai_profile_summary_md: summaryMd,
        ai_profile_generated_at: new Date().toISOString(),
        ai_profile_generated_by: auth.user.id,
      })
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      ai_profile: profile,
      ai_profile_summary_md: summaryMd,
      ai_profile_generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Erro ao gerar perfil IA:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
