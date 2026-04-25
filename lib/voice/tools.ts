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
  | 'send_message'
  | 'add_lead_note'
  | 'schedule_follow_up'
  | 'generate_property_description'
  | 'attach_document'

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
        'Abrir um link/site rápido da página de Acessos: atalhos RE/MAX (MaxWork, Contactos, Convictus), portais (Idealista, Imovirtual, Casa Sapo, CasaYes), notícias imobiliárias, Casafari, MicroSIR, sites adicionados em Websites > Outros (Canva, ChatGPT, WhatsApp Web, Monday, globais ou pessoais). Usar para "abre o canva", "abre o idealista", "mostra-me o MaxWork", "vai ao ChatGPT", "onde está o link do Casafari".',
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
          description:
            'Tipo/serviço do parceiro em português tal como o utilizador o disse (ex: "advogado", "fotógrafo", "canalizador", "empreiteiro", "arquitecto"). Escreve a palavra singular em minúsculas. NÃO inventes categorias — deixa em branco se o utilizador não mencionou. A correspondência ao slug da base de dados (incluindo categorias personalizadas) é resolvida do lado do servidor.',
        },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_message',
      description:
        'Enviar uma mensagem (WhatsApp) ou email a um contacto/lead, com envio imediato OU agendado. Usar para "manda mensagem ao João a dizer X", "envia email à Maria a confirmar Y", "agenda uma mensagem ao Pedro para amanhã às 9h a lembrar Z". Extrai TUDO o que o utilizador disser; o resto é completado visualmente.',
      parameters: withConfidence(
        {
          contact_name: {
            type: 'string',
            description: 'Nome do destinatário (contacto/lead). Procura será feita na tabela leads.',
          },
          channel: {
            type: 'string',
            enum: ['whatsapp', 'email'],
            description:
              'Canal de envio — "whatsapp" se o utilizador disse "manda mensagem"/"manda WhatsApp"/"envia sms"; "email" se disse "manda email"/"manda um mail". Omitir se não foi referido (valor por defeito é WhatsApp).',
          },
          message: {
            type: 'string',
            description:
              'Corpo da mensagem tal como o utilizador ditar. Mantém tom natural e pontuação adequada em PT-PT.',
          },
          subject: {
            type: 'string',
            description:
              'Assunto do email (ignorado no WhatsApp). Só preencher se o utilizador referir explicitamente ou se o canal for email e o contexto o sugerir claramente.',
          },
          scheduled_at: {
            type: 'string',
            description:
              'Data/hora ISO 8601 para agendar o ENVIO da mensagem. CRÍTICO: usa APENAS quando o utilizador aplica linguagem imperativa sobre o TIMING DO ENVIO ("agenda para amanhã", "manda sexta às 9h", "envia daqui a 2 horas", "agendar"). NÃO extraias quando a hora/dia aparece DENTRO do conteúdo da mensagem. Exemplos: "envia mensagem ao João a dizer que chego amanhã às 18h" → a hora é CONTEÚDO, NÃO é agendamento (scheduled_at fica vazio, a hora vai no campo message); "agenda mensagem ao João para amanhã às 9h a lembrar da reunião" → aqui sim, scheduled_at=amanhã 09h. Se houver ambiguidade, OMITE — o utilizador pode activar agendamento manualmente no ecrã de confirmação.',
          },
        },
        ['contact_name']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'attach_document',
      description:
        'Anexar/guardar um documento a um imóvel — tipicamente usado no mobile para fotografar um documento (contrato, caderneta, licença) e arquivá-lo directamente no dossier do imóvel. Usar para "guarda o contrato no imóvel X", "anexa a caderneta do imóvel Y", "guardar licença". Abre um painel com selector de tipo + botão de câmara/ficheiro.',
      parameters: withConfidence(
        {
          property_query: {
            type: 'string',
            description: 'Termo de pesquisa do imóvel: título, morada, zona, cidade, referência.',
          },
          doc_type_hint: {
            type: 'string',
            description:
              'Tipo de documento em PT-PT tal como o utilizador o disse (ex: "contrato", "caderneta", "licença", "certificado energético"). Usado para pré-seleccionar o tipo correcto no painel.',
          },
          notes: {
            type: 'string',
            description: 'Observações sobre o documento (opcional).',
          },
        },
        ['property_query']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_property_description',
      description:
        'Gerar uma descrição comercial para um imóvel usando IA (a partir das specs). Usar para "gera descrição do imóvel da Avenida de Roma", "escreve-me a descrição do T3 de Cascais", "preciso de uma descrição comercial para o 1234". Pesquisa o imóvel por título, zona, cidade ou últimos dígitos da referência externa.',
      parameters: withConfidence(
        {
          property_query: {
            type: 'string',
            description:
              'Termo de pesquisa do imóvel: título, morada, zona, cidade, referência completa ou últimos dígitos da referência externa.',
          },
          tone: {
            type: 'string',
            enum: ['professional', 'premium', 'cozy'],
            description:
              'Tom da descrição. "premium" para luxo/exclusividade, "cozy" para acolhedor/familiar, "professional" (default) para tom padrão. Omitir se o utilizador não referiu.',
          },
          additional_notes: {
            type: 'string',
            description:
              'Notas extra do consultor para enriquecer a descrição (ex: "mencionar que foi remodelado em 2022", "destacar a proximidade ao metro"). Opcional.',
          },
        },
        ['property_query']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_follow_up',
      description:
        'Agendar um follow-up com um contacto/lead (ligação, WhatsApp, email ou reunião). Usar para "follow-up com a Ana terça às 15h", "lembra-me de ligar ao João na sexta", "voltar a falar com o Pedro quarta". Associa ao contacto por defeito; opcionalmente a um negócio específico se o contacto tiver mais de um. Distingue-se de create_todo porque é um follow-up ligado a um CONTACTO conhecido.',
      parameters: withConfidence(
        {
          contact_name: {
            type: 'string',
            description: 'Nome do contacto/lead. Procura feita em /api/leads.',
          },
          due_date: {
            type: 'string',
            description:
              'Data/hora ISO 8601 do follow-up. Converte "amanhã", "sexta", "quarta às 15h" via o contexto temporal. Omite se o utilizador não referiu — preenche no ecrã.',
          },
          channel: {
            type: 'string',
            enum: ['call', 'whatsapp', 'email', 'meeting'],
            description:
              'Canal do follow-up: "ligar"/"chamar"/"telefonar"→call; "WhatsApp"/"mensagem"→whatsapp; "email"/"mail"→email; "reunião"/"encontro"→meeting. Omite se não referido (default=call no ecrã).',
          },
          notes: {
            type: 'string',
            description: 'Contexto/motivo livre do follow-up (opcional).',
          },
        },
        ['contact_name']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_lead_note',
      description:
        'Adicionar uma nota ao histórico de actividades de um contacto/lead. Usar para "regista no João que está interessado no T3", "adiciona nota à Maria: não responde ao telefone", "aponta no Pedro que o orçamento subiu para 500k". A nota é gravada ao CONTACTO por defeito; se o utilizador pertence a múltiplos negócios, oferecemos no ecrã a opção de associar a um negócio específico.',
      parameters: withConfidence(
        {
          contact_name: {
            type: 'string',
            description:
              'Nome do contacto/lead a que a nota pertence. Procura feita em /api/leads.',
          },
          note: {
            type: 'string',
            description:
              'Conteúdo da nota tal como o utilizador ditou, em PT-PT, pontuação adequada. Capture só o conteúdo factual — sem "regista que", "aponta que", etc., que são instruções, não parte da nota.',
          },
        },
        ['contact_name', 'note']
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
    case 'send_message': {
      const to = args.contact_name ? ` a ${args.contact_name}` : ''
      const ch = args.channel === 'email' ? 'email' : 'WhatsApp'
      return args.scheduled_at ? `Agendar ${ch}${to}` : `Enviar ${ch}${to}`
    }
    case 'add_lead_note': {
      const to = args.contact_name ? ` a ${args.contact_name}` : ''
      return `Adicionar nota${to}`
    }
    case 'schedule_follow_up': {
      const to = args.contact_name ? ` com ${args.contact_name}` : ''
      return `Follow-up${to}`
    }
    case 'generate_property_description': {
      const q = args.property_query ? ` "${args.property_query}"` : ''
      return `Gerar descrição${q}`
    }
    case 'attach_document': {
      const q = args.property_query ? ` ao "${args.property_query}"` : ''
      return `Anexar documento${q}`
    }
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
