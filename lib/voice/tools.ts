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
  | 'send_property'
  | 'search_document'
  | 'search_partner'
  | 'open_link'

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

// Shared vocabulary for lead origin. Used by both create_lead and
// create_leads_batch so the assistant speaks a single language about sources.
const LEAD_SOURCE_ENUM = [
  'social_media',
  'website',
  'landing_page',
  'meta_ads',
  'google_ads',
  'partner',
  'organic',
  'walk_in',
  'phone_call',
  'other',
] as const
const LEAD_SOURCE_DESC =
  'Origem do contacto. Mapeia: Instagram/Facebook/TikTok orgânico → social_media; anúncio Meta/Facebook/Instagram → meta_ads; anúncio Google → google_ads; Idealista/Imovirtual/Casa Sapo/site/portal → website; landing page → landing_page; parceiro/agência amiga → partner; entrou na loja → walk_in; telefonou → phone_call; indicação/referência/SEO → organic; outros casos → other.'

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
        'Criar UM contacto individual (opcionalmente com um negócio associado). Usar quando o utilizador quer adicionar uma única pessoa. Para múltiplas pessoas numa só frase (ex: "adiciona leads João, Maria e Pedro"), usa create_leads_batch. Preenche também os campos do negócio se o utilizador mencionar intenção de compra/venda/arrendamento. Extrai origem e consultor atribuído se forem referidos.',
      parameters: withConfidence({
        // Dados do contacto
        nome: { type: 'string', description: 'Nome completo' },
        email: { type: 'string' },
        telemovel: { type: 'string', description: 'Telemóvel (formato PT aceitável, ex: 912345678)' },
        observacoes: { type: 'string', description: 'Notas livres sobre o contacto' },
        origem: {
          type: 'string',
          enum: [...LEAD_SOURCE_ENUM],
          description: LEAD_SOURCE_DESC,
        },
        assigned_consultant_name: {
          type: 'string',
          description:
            'Nome do consultor a quem atribuir o contacto. Preenche apenas se o utilizador referir explicitamente (ex: "para o João", "atribui à Maria").',
        },
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
        'Criar VÁRIOS leads em lote. Usar quando o utilizador menciona múltiplas pessoas numa só instrução (ex: "adiciona leads João Silva, Maria Pereira 913123456, e Pedro"). Se o utilizador referir um consultor ou origem partilhados ("todos do Instagram", "para o Pedro"), preenche default_source e/ou assigned_consultant_name — aplicam-se a todos. Se o utilizador atribuir individualmente ("João do Idealista para a Ana, Maria do Instagram"), usa os campos source e assigned_consultant_name dentro de cada lead (sobrepõem-se aos defaults).',
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
                source: {
                  type: 'string',
                  enum: [...LEAD_SOURCE_ENUM],
                  description:
                    'Origem individual deste lead, se diferente do grupo. Mesma vocabulário que default_source.',
                },
                assigned_consultant_name: {
                  type: 'string',
                  description:
                    'Consultor a quem atribuir este lead específico, se diferente do grupo.',
                },
              },
              required: ['nome'],
            },
            minItems: 1,
          },
          default_source: {
            type: 'string',
            enum: [...LEAD_SOURCE_ENUM],
            description:
              'Origem partilhada por todo o lote (ex: "todos do Instagram"). ' +
              LEAD_SOURCE_DESC,
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
        'Marcar/agendar uma visita a um imóvel. Usar para "marcar visita", "agendar visita", "combinar visita ao imóvel X com o cliente Y amanhã às 15h". Interpreta datas e horas relativas ("amanhã", "sexta", "às 15h"). Preenche todos os campos que o utilizador referir — campos em falta ficam vermelhos no ecrã de confirmação para o utilizador completar (por voz ou texto). NÃO peças clarificação em texto por faltar informação; chama sempre a tool com o que tens.',
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
            description: 'Data e hora ISO 8601 (ex: 2026-04-21T15:00:00). Usa o contexto temporal para converter "amanhã", "sexta", "às 15h". Omite se o utilizador não referiu — o utilizador completa no ecrã de confirmação.',
          },
          duration_minutes: {
            type: 'integer',
            minimum: 15,
            maximum: 480,
            description: 'Duração da visita em minutos. Por defeito 30.',
          },
          notes: { type: 'string' },
        }
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
      name: 'send_property',
      description:
        'Enviar UM OU VÁRIOS imóveis (partilha link do anúncio + mensagem) a um ou mais contactos por email e/ou WhatsApp. Usar para "enviar imóvel X ao João", "manda o apartamento da Rua Y à Maria por whatsapp", "partilhar esta casa com o Pedro e a Ana por email", "envia à Ana o T3 de Cascais, o apartamento da Avenida e o 1234". O utilizador depois confirma/adiciona imóveis e escolhe destinatários no ecrã seguinte.',
      parameters: withConfidence(
        {
          property_queries: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description:
              'Lista de termos de pesquisa, UM POR IMÓVEL. Cada termo pode ser título, morada, zona, cidade, referência completa ou só os últimos dígitos da referência externa (ex: "1234" procura por referências que terminem/contenham 1234). Se o utilizador mencionar vários imóveis numa só frase, cria um termo por cada um.',
          },
          contact_names: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Nomes dos contactos a quem enviar. Vazio se o utilizador não nomeou ninguém — o utilizador pode escolher no ecrã de composição.',
          },
          message: {
            type: 'string',
            description: 'Mensagem/intro personalizada (opcional)',
          },
        },
        ['property_queries']
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
  {
    type: 'function',
    function: {
      name: 'open_link',
      description:
        'Abrir um link/site rápido da página de Acessos: atalhos RE/MAX (MaxWork, Contactos, Convictus), portais (Idealista, Imovirtual, Casa Sapo, CasaYes), notícias imobiliárias, Casafari, MicroSIR, sites de trabalho (Canva, ChatGPT, WhatsApp Web, Monday, etc.) ou links pessoais do utilizador. Usar para "abre o canva", "abre o idealista", "mostra-me o MaxWork", "vai ao ChatGPT", "onde está o link do Casafari".',
      parameters: withConfidence(
        {
          query: {
            type: 'string',
            description:
              'Nome do site/link a abrir (ex: "canva", "chatgpt", "idealista", "maxwork", "casafari").',
          },
        },
        ['query']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_partner',
      description:
        'Procurar parceiros/fornecedores na base de dados (advogados, notários, fotógrafos, empreiteiros, etc.). Usar para "procura um advogado", "preciso de um fotógrafo em Lisboa", "onde está o contacto do empreiteiro", "parceiro Silva & Associados", "tens um notário?". Pelo menos UM entre name_query e category deve ser preenchido.',
      parameters: withConfidence({
        name_query: {
          type: 'string',
          description:
            'Termo livre para pesquisar por nome do parceiro ou cidade (ex: "Silva & Associados", "Lisboa"). Omitir se o utilizador só mencionou o tipo de serviço.',
        },
        category: {
          type: 'string',
          enum: [
            'supplier',
            'lawyer',
            'notary',
            'bank',
            'photographer',
            'constructor',
            'insurance',
            'energy_cert',
            'cleaning',
            'moving',
            'appraiser',
            'architect',
            'home_staging',
            'credit_broker',
            'interior_design',
            'marketing',
            'other',
          ],
          description:
            'Tipo/serviço do parceiro. Mapeamento PT→slug: advogado/jurista→lawyer; notário→notary; banco→bank; fotógrafo→photographer; empreiteiro/construtor/obra→constructor; seguro/seguros/seguradora→insurance; certificado energético/energia/CE→energy_cert; limpeza/limpezas/faxina→cleaning; mudanças/transporte→moving; avaliador/perito→appraiser; arquitecto→architect; home staging/decoração de venda→home_staging; intermediário de crédito/credit broker→credit_broker; design de interiores/decorador→interior_design; marketing/publicidade→marketing; fornecedor/material→supplier; qualquer outro→other.',
        },
      }),
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
    case 'send_property': {
      const names = Array.isArray(args.contact_names) ? args.contact_names : []
      const to = names.length > 0 ? ` a ${names.join(', ')}` : ''
      const queries = Array.isArray(args.property_queries)
        ? args.property_queries.filter(Boolean)
        : args.property_query
          ? [args.property_query]
          : []
      if (queries.length === 0) return 'Enviar imóvel'
      if (queries.length === 1) return `Enviar imóvel "${queries[0]}"${to}`
      return `Enviar ${queries.length} imóveis${to}`
    }
    case 'search_document':
      return `Procurar documentos: "${args.query}"`
    case 'open_link':
      return args.query ? `Abrir "${args.query}"` : 'Abrir link'
    case 'search_partner': {
      const cat = args.category ? ` ${String(args.category).replace(/_/g, ' ')}` : ''
      const name = args.name_query ? ` "${args.name_query}"` : ''
      const body = (cat + name).trim()
      return body ? `Procurar parceiro:${cat}${name}` : 'Procurar parceiro'
    }
    default:
      return 'Executar'
  }
}
