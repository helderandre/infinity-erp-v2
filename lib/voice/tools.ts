import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export type VoiceToolName =
  | 'create_lead'
  | 'create_leads_batch'
  | 'create_angariacao'
  | 'create_fecho'
  | 'create_todo'
  | 'create_reminder'
  | 'create_call_log'
  | 'create_visit'
  | 'search_document'

export type VoiceConfidence = 'alta' | 'media' | 'baixa'

/**
 * Required param on every tool — the model self-rates its confidence.
 * We strip this from args before returning to the client; the server uses it
 * only to threshold low-confidence calls and convert them into clarifications.
 */
const CONFIDENCE_PARAM = {
  type: 'string',
  enum: ['alta', 'media', 'baixa'],
  description:
    'Autoavaliação obrigatória da confiança na interpretação. "alta" = tens a certeza e os parâmetros-chave foram referidos; "media" = intenção clara mas faltam detalhes úteis; "baixa" = a mensagem é ambígua — neste caso preferes NÃO chamar esta tool e pedir clarificação em texto.',
} as const

function withConfidence(
  props: Record<string, unknown>,
  required: string[] = []
): { type: 'object'; properties: Record<string, unknown>; required: string[] } {
  return {
    type: 'object',
    properties: { ...props, confidence: CONFIDENCE_PARAM },
    required: Array.from(new Set([...required, 'confidence'])),
  }
}

export const VOICE_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description:
        'Criar UM contacto individual (opcionalmente com um negócio associado). Usar quando o utilizador quer adicionar uma única pessoa. Para múltiplas pessoas numa só frase (ex: "adiciona leads João, Maria e Pedro"), usa create_leads_batch. Preenche também os campos do negócio se o utilizador mencionar intenção de compra/venda/arrendamento.',
      parameters: withConfidence({
        // Dados do contacto
        nome: { type: 'string', description: 'Nome completo' },
        email: { type: 'string' },
        telemovel: { type: 'string', description: 'Telemóvel (formato PT aceitável, ex: 912345678)' },
        observacoes: { type: 'string', description: 'Notas livres sobre o contacto' },
        // Negócio (opcional — inclui apenas se o utilizador referir intenção de negócio)
        negocio_tipo: {
          type: 'string',
          enum: ['Compra', 'Venda', 'Arrendatário', 'Arrendador'],
          description: 'Tipo de negócio, se aplicável. "Compra"=comprador, "Venda"=vendedor, "Arrendatário"=quer arrendar, "Arrendador"=senhorio.',
        },
        tipo_imovel: {
          type: 'string',
          description: 'Tipologia/tipo de imóvel do negócio (ex: Apartamento, T2, Moradia, Terreno)',
        },
        localizacao: { type: 'string', description: 'Localização desejada' },
        orcamento: { type: 'number', description: 'Orçamento/preço em euros' },
        orcamento_max: { type: 'number', description: 'Orçamento máximo em euros' },
        quartos_min: { type: 'number' },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_leads_batch',
      description:
        'Criar VÁRIOS leads em lote. Usar quando o utilizador menciona múltiplas pessoas numa só instrução (ex: "adiciona leads João Silva, Maria Pereira 913123456, e Pedro"). Se o utilizador disser "para o [consultor]" ou "atribui ao [consultor]", extrai também assigned_consultant_name — todos os leads ficam atribuídos ao mesmo consultor.',
      parameters: withConfidence(
        {
          leads: {
            type: 'array',
            description: 'Lista de leads a criar. Pelo menos uma entrada.',
            items: {
              type: 'object',
              properties: {
                nome: { type: 'string', description: 'Nome completo' },
                telemovel: { type: 'string' },
                email: { type: 'string' },
              },
              required: ['nome'],
            },
            minItems: 1,
          },
          assigned_consultant_name: {
            type: 'string',
            description:
              'Nome do consultor a quem atribuir todos os leads do lote. Preenche apenas se o utilizador referir explicitamente (ex: "para o João", "atribui à Maria").',
          },
        },
        ['leads']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_angariacao',
      description:
        'Iniciar um pedido de angariação de imóvel. Usar para "pedido de angariação", "nova angariação", "angariar um imóvel", "criar angariação". Preenche todos os campos que o utilizador referir — qualquer campo obrigatório em falta fica vermelho no ecrã de confirmação para o utilizador completar por voz ou texto.',
      parameters: withConfidence({
        // Imóvel
        title: { type: 'string', description: 'Título descritivo (ex: "Apartamento T3 em Lisboa")' },
        property_type: {
          type: 'string',
          enum: ['Apartamento', 'Moradia', 'Terreno', 'Loja', 'Escritório', 'Armazém', 'Garagem', 'Quintinha', 'Outro'],
        },
        business_type: {
          type: 'string',
          enum: ['venda', 'arrendamento', 'trespasse'],
        },
        listing_price: { type: 'number', description: 'Preço de listagem em euros' },
        description: { type: 'string' },
        property_condition: {
          type: 'string',
          enum: ['new', 'used', 'under_construction', 'to_renovate', 'renovated', 'ruin'],
        },
        energy_certificate: { type: 'string', enum: ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F', 'Isento'] },
        // Especificações
        typology: { type: 'string', description: 'T0, T1, T2, T3, ...' },
        bedrooms: { type: 'number' },
        bathrooms: { type: 'number' },
        area_util: { type: 'number', description: 'Área útil em m²' },
        area_gross: { type: 'number', description: 'Área bruta em m²' },
        parking_spaces: { type: 'number' },
        // Localização
        city: { type: 'string' },
        zone: { type: 'string' },
        address_street: { type: 'string' },
        address_parish: { type: 'string' },
        postal_code: { type: 'string' },
        // Proprietário principal (uma angariação precisa sempre de pelo menos um proprietário)
        main_owner_name: { type: 'string', description: 'Nome do proprietário principal' },
        main_owner_phone: { type: 'string', description: 'Telemóvel do proprietário principal' },
        main_owner_email: { type: 'string' },
        main_owner_nif: { type: 'string', description: 'NIF (9 dígitos)' },
        // Contratual
        contract_regime: {
          type: 'string',
          enum: ['exclusivo', 'semi_exclusivo', 'aberto'],
          description: 'Regime de contrato',
        },
        commission_agreed: { type: 'number', description: 'Comissão acordada (%)' },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_fecho',
      description:
        'Iniciar um novo fecho de negócio (abre o diálogo "Novo Fecho"). Usar para "fecho de negócio", "novo fecho", "fechar negócio", "concretizar venda/arrendamento".',
      parameters: withConfidence({
        business_type: {
          type: 'string',
          enum: ['venda', 'arrendamento', 'trespasse'],
        },
        scenario: {
          type: 'string',
          enum: ['pleno', 'comprador_externo', 'pleno_agencia', 'angariacao_externa'],
          description:
            'pleno = angariação + comprador nossos; comprador_externo = apenas comprador; pleno_agencia = outra agência envolvida; angariacao_externa = apenas angariação.',
        },
        deal_value: { type: 'number', description: 'Valor do negócio em euros' },
        property_title: { type: 'string', description: 'Referência ao imóvel envolvido, se mencionado' },
        client_name: { type: 'string', description: 'Cliente comprador/inquilino' },
        observacoes: { type: 'string' },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_todo',
      description:
        'Criar uma tarefa pessoal (to-do). Usar para "criar tarefa", "adicionar to-do", "preciso de lembrar-me".',
      parameters: withConfidence(
        {
          title: { type: 'string', description: 'Título curto da tarefa' },
          description: { type: 'string' },
          priority: {
            type: 'integer',
            description: '1=urgente, 2=alta, 3=média, 4=baixa',
            minimum: 1,
            maximum: 4,
          },
          due_date: {
            type: 'string',
            description: 'Data/hora ISO 8601 (ex: 2026-04-20T15:00:00Z)',
          },
        },
        ['title']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_call_log',
      description:
        'Registar uma chamada feita ou recebida de um contacto. Usar para "registar chamada", "liguei ao [nome]", "o [nome] ligou", "tive uma conversa telefónica com [nome]".',
      parameters: withConfidence(
        {
          contact_name: {
            type: 'string',
            description: 'Nome do contacto envolvido na chamada',
          },
          direction: {
            type: 'string',
            enum: ['inbound', 'outbound'],
            description: 'inbound = o contacto ligou para mim; outbound = eu liguei ao contacto',
          },
          outcome: {
            type: 'string',
            enum: ['success', 'no_answer', 'busy', 'voicemail', 'failed'],
            description:
              'success = atendeu e falámos; no_answer = não atendeu; busy = linha ocupada; voicemail = caiu no voicemail; failed = não foi possível ligar',
          },
          notes: { type: 'string', description: 'Resumo do que foi dito' },
        },
        ['contact_name', 'direction', 'outcome']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_visit',
      description:
        'Marcar/agendar uma visita a um imóvel. Usar para "marcar visita", "agendar visita", "combinar visita ao imóvel X com o cliente Y amanhã às 15h". Interpreta datas e horas relativas ("amanhã", "sexta", "às 15h").',
      parameters: withConfidence(
        {
          property_query: {
            type: 'string',
            description: 'Termo para encontrar o imóvel (título, referência, zona ou cidade)',
          },
          contact_name: {
            type: 'string',
            description: 'Nome do cliente que vai à visita',
          },
          client_phone: { type: 'string' },
          client_email: { type: 'string' },
          visit_datetime: {
            type: 'string',
            description: 'Data e hora ISO 8601 (ex: 2026-04-21T15:00:00). Usa o contexto temporal para converter "amanhã", "sexta", "às 15h".',
          },
          duration_minutes: {
            type: 'integer',
            minimum: 15,
            maximum: 480,
            description: 'Duração da visita em minutos. Por defeito 30.',
          },
          notes: { type: 'string' },
        },
        ['property_query', 'contact_name', 'visit_datetime']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_reminder',
      description:
        'Criar um lembrete para uma data específica. Equivalente a uma tarefa com prazo.',
      parameters: withConfidence(
        {
          title: { type: 'string' },
          due_date: { type: 'string', description: 'Data/hora ISO 8601' },
        },
        ['title', 'due_date']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_document',
      description:
        'Procurar documentos OU materiais de marketing/designs ("Os Meus Designs") por palavra-chave. Usar para "procurar documento", "buscar ficheiro", "encontrar contrato", "buscar flyer", "procurar design de venda", "material de marketing", etc.',
      parameters: withConfidence(
        {
          query: { type: 'string', description: 'Termo de pesquisa (documento, design, flyer, template, etc.)' },
        },
        ['query']
      ),
    },
  },
]

export function buildConfirmText(tool: string, args: Record<string, any>): string {
  switch (tool) {
    case 'create_lead': {
      const hasNegocio = Boolean(args.negocio_tipo)
      const base = args.nome ? `Criar contacto: ${args.nome}` : 'Criar contacto'
      return hasNegocio ? `${base} + negócio (${String(args.negocio_tipo).toLowerCase()})` : base
    }
    case 'create_leads_batch': {
      const n = Array.isArray(args.leads) ? args.leads.length : 0
      return n > 0 ? `Criar ${n} lead${n !== 1 ? 's' : ''}` : 'Criar leads'
    }
    case 'create_angariacao':
      return args.title ? `Nova angariação: ${args.title}` : 'Nova angariação'
    case 'create_fecho':
      return args.property_title ? `Novo fecho: ${args.property_title}` : 'Novo fecho de negócio'
    case 'create_todo':
      return args.title ? `Criar tarefa: "${args.title}"` : 'Criar tarefa'
    case 'create_reminder':
      return args.title ? `Criar lembrete: "${args.title}"` : 'Criar lembrete'
    case 'create_call_log':
      return args.contact_name ? `Registar chamada com ${args.contact_name}` : 'Registar chamada'
    case 'create_visit':
      return args.contact_name
        ? `Marcar visita com ${args.contact_name}`
        : 'Marcar visita'
    case 'search_document':
      return `Procurar documentos: "${args.query}"`
    default:
      return 'Executar'
  }
}
