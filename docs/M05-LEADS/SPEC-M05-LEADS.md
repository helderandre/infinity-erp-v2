# SPEC — M05: Módulo de Leads (Completo)

**Data:** 2026-02-23
**Baseado em:** Código do projecto de teste (Nuxt) + schema Supabase actual
**Módulo:** M05 — Leads + Negócios + Funcionalidades auxiliares
**Stack destino:** Next.js 16, App Router, Supabase, shadcn/ui, Tailwind v4

---

## Índice

1. [Resumo Geral](#1-resumo-geral)
2. [Schema da Base de Dados (JÁ EXISTE)](#2-schema-da-base-de-dados-já-existe)
3. [Fase A — Migrações DB (tabelas/colunas em falta)](#3-fase-a--migrações-db)
4. [Fase B — Types TypeScript](#4-fase-b--types-typescript)
5. [Fase C — Validações Zod](#5-fase-c--validações-zod)
6. [Fase D — Constantes e Labels PT-PT](#6-fase-d--constantes-e-labels-pt-pt)
7. [Fase E — API Route Handlers (Leads)](#7-fase-e--api-route-handlers-leads)
8. [Fase F — API Route Handlers (Negócios)](#8-fase-f--api-route-handlers-negócios)
9. [Fase G — API Route Handlers (Utilitários)](#9-fase-g--api-route-handlers-utilitários)
10. [Fase H — API Route Handlers (IA)](#10-fase-h--api-route-handlers-ia)
11. [Fase I — Frontend: Listagem de Leads](#11-fase-i--frontend-listagem-de-leads)
12. [Fase J — Frontend: Detalhe/Edição do Lead](#12-fase-j--frontend-detalheedição-do-lead)
13. [Fase K — Frontend: Negócios](#13-fase-k--frontend-negócios)
14. [Fase L — Frontend: Funcionalidades IA](#14-fase-l--frontend-funcionalidades-ia)
15. [Ficheiros Criados vs Modificados](#15-ficheiros-criados-vs-modificados)
16. [Critérios de Sucesso](#16-critérios-de-sucesso)
17. [Fora de Escopo](#17-fora-de-escopo)
18. [Ordem de Execução Recomendada](#18-ordem-de-execução-recomendada)

---

## 1. Resumo Geral

O módulo de Leads é um sistema completo de gestão de contactos para a imobiliária. Inclui:

- **Leads** — contactos/clientes potenciais com dados pessoais, documentação, empresa e morada
- **Negócios** — intenções de compra/venda/arrendamento associadas a cada lead
- **Anexos** — ficheiros associados a cada lead
- **Funcionalidades IA** — análise de documentos de identificação (OCR via OpenAI), chat assistido para preenchimento de negócios, transcrição de áudio, extracção de dados de texto livre, resumo de negócio
- **Utilitários** — lookup de código postal (geoapi.pt), lookup de NIPC (nif.pt), matching de imóveis com negócios

### Dados existentes no Supabase

- Tabela `leads`: **5 registos** existentes
- Tabela `negocios`: **10 registos** existentes
- Tabela `lead_attachments`: **0 registos**

### Nota sobre nomenclatura

As tabelas `leads`, `negocios` e `lead_attachments` já existem no Supabase com nomes em **português** (diferente das tabelas core que usam inglês como `dev_properties`, `dev_users`). Manter esta convenção.

---

## 2. Schema da Base de Dados (JÁ EXISTE)

Todas as tabelas abaixo **já existem** no Supabase. NÃO criar migrações para estas tabelas.

### 2.1. Tabela `leads`

```
leads
├── id (UUID, PK, default gen_random_uuid())
├── nome (text, obrigatório)
├── full_name (text, nullable) — nome completo extraído do documento
├── email (text, nullable)
├── telefone (text, nullable) — telefone genérico
├── telemovel (text, nullable) — telemóvel
├── telefone_fixo (text, nullable)
├── estado (text, nullable) — status do lead
├── temperatura (text, nullable) — quente/morno/frio
├── data (timestamptz, nullable) — data de entrada
├── origem (text, nullable) — fonte do lead
├── agent_id (UUID, FK → dev_users.id, nullable) — consultor atribuído
├── forma_contacto (text, nullable)
├── observacoes (text, nullable)
├── consentimento_contacto (boolean, default false)
├── consentimento_webmarketing (boolean, default false)
├── meio_contacto_preferencial (text, nullable)
├── data_contacto (timestamptz, nullable)
├── genero (text, nullable) — Masculino/Feminino
├── data_nascimento (date, nullable)
├── nacionalidade (text, nullable)
├── tipo_documento (text, nullable) — CC, Passaporte, BI
├── numero_documento (text, nullable)
├── nif (text, nullable)
├── pais_emissor (text, nullable)
├── data_validade_documento (date, nullable)
├── codigo_postal (text, nullable)
├── localidade (text, nullable)
├── pais (text, nullable)
├── distrito (text, nullable)
├── concelho (text, nullable)
├── freguesia (text, nullable)
├── zona (text, nullable)
├── morada (text, nullable)
├── empresa (text, nullable) — nome da empresa
├── morada_empresa (text, nullable)
├── telefone_empresa (text, nullable)
├── email_empresa (text, nullable)
├── website_empresa (text, nullable)
├── tem_empresa (boolean, default false)
├── nipc (text, nullable) — NIF da empresa
├── documento_identificacao_url (text, nullable) — URL do doc (legado, único)
├── documento_identificacao_frente_url (text, nullable) — frente do doc
├── documento_identificacao_verso_url (text, nullable) — verso do doc
├── created_at (timestamptz, default now())
```

**FK existente:** `leads.agent_id → dev_users.id`

### 2.2. Tabela `negocios`

```
negocios
├── id (UUID, PK, default gen_random_uuid())
├── lead_id (UUID, FK → leads.id, obrigatório)
├── tipo (text, obrigatório) — "Compra" | "Venda" | "Compra e Venda" | "Arrendatário" | "Arrendador" | "Outro"
├── estado (text, default 'Aberto') — "Aberto" | "Em progresso" | "Fechado" | "Cancelado"
├── observacoes (text, nullable)
├── tipo_imovel (text, nullable) — Apartamento, Moradia, etc.
├── localizacao (text, nullable) — zonas pretendidas (string livre, separado por vírgula)
├── estado_imovel (text, nullable) — Novo, Usado, etc.
├── area_m2 (numeric, nullable)
├── quartos (int, nullable)
├── orcamento (numeric, nullable) — orçamento mínimo
├── orcamento_max (numeric, nullable) — orçamento máximo
├── renda_max_mensal (numeric, nullable)
├── area_min_m2 (numeric, nullable)
├── quartos_min (int, nullable)
├── preco_venda (numeric, nullable)
├── renda_pretendida (numeric, nullable)
├── credito_pre_aprovado (boolean, nullable)
├── valor_credito (numeric, nullable)
├── capital_proprio (numeric, nullable)
├── financiamento_necessario (boolean, nullable)
├── prazo_compra (text, nullable) — "Imediato" | "Até 3 meses" | etc.
├── motivacao_compra (text, nullable) — "Primeira habitação" | "Investimento" | etc.
├── tem_elevador, tem_estacionamento, tem_garagem, tem_exterior (boolean, nullable)
├── tem_varanda, tem_piscina, tem_porteiro, tem_arrumos (boolean, nullable)
├── classe_imovel (text, nullable) — "Habitação" | "Comercial" | etc.
├── casas_banho (smallint, nullable)
├── num_wc (smallint, nullable)
├── total_divisoes (smallint, nullable)
├── distrito, concelho, freguesia (text, nullable)
├── situacao_profissional (text, nullable)
├── rendimento_mensal (numeric, nullable)
├── tem_fiador (boolean, nullable)
├── duracao_minima_contrato (text, nullable)
├── caucao_rendas (smallint, nullable)
├── aceita_animais (boolean, nullable)
├── mobilado (boolean, nullable)
├── localizacao_venda, tipo_imovel_venda, estado_imovel_venda (text, nullable)
├── tem_elevador_venda, tem_estacionamento_venda, tem_garagem_venda (boolean, nullable)
├── tem_exterior_venda, tem_varanda_venda, tem_piscina_venda (boolean, nullable)
├── tem_porteiro_venda, tem_arrumos_venda (boolean, nullable)
├── created_at (timestamptz, default now())
```

**FK existente:** `negocios.lead_id → leads.id`

### 2.3. Tabela `lead_attachments`

```
lead_attachments
├── id (UUID, PK, default gen_random_uuid())
├── lead_id (UUID, FK → leads.id, obrigatório)
├── url (text, obrigatório)
├── name (text, nullable)
├── created_at (timestamptz, default now())
```

---

## 3. Fase A — Migrações DB

**NENHUMA migração necessária.** Todas as tabelas e colunas já existem no Supabase.

Apenas regenerar types após confirmar:

```bash
npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > src/types/database.ts
```

---

## 4. Fase B — Types TypeScript

### Ficheiro NOVO: `types/lead.ts`

```typescript
import type { Database } from './database'

type LeadRow = Database['public']['Tables']['leads']['Row']
type NegocioRow = Database['public']['Tables']['negocios']['Row']
type LeadAttachmentRow = Database['public']['Tables']['lead_attachments']['Row']
type DevUser = Database['public']['Tables']['dev_users']['Row']

// Lead com agente associado (usado na listagem)
export interface LeadWithAgent extends LeadRow {
  agent?: Pick<DevUser, 'id' | 'commercial_name'> | null
}

// Negócio com lead e agente (usado na listagem de negócios)
export interface NegocioWithLead extends NegocioRow {
  lead?: {
    id: string
    nome: string
    agent_id?: string | null
    agent?: Pick<DevUser, 'id' | 'commercial_name'> | null
  } | null
}

// Negócio com lead básico (usado no detalhe do negócio)
export interface NegocioWithLeadBasic extends NegocioRow {
  lead?: Pick<LeadRow, 'id' | 'nome' | 'telefone' | 'telemovel' | 'email'> | null
}

// Attachment
export type LeadAttachment = LeadAttachmentRow

// Tipos de negócio
export type NegocioTipo = 'Compra' | 'Venda' | 'Compra e Venda' | 'Arrendatário' | 'Arrendador' | 'Outro'
export type NegocioEstado = 'Aberto' | 'Em progresso' | 'Fechado' | 'Cancelado'

// Match de imóvel (retornado pelo endpoint de matches)
export interface PropertyMatch {
  id: string
  title: string
  slug: string
  listing_price: number | null
  property_type: string | null
  status: string | null
  city: string | null
  zone: string | null
  specs: {
    bedrooms: number | null
    area_util: number | null
  } | null
  cover_url: string | null
  price_flag: 'yellow' | 'orange' | null
}

// Interessado (retornado pelo endpoint de interessados)
export interface NegocioInteressado {
  negocioId: string
  firstName: string
  colleague: string
  phone: string | null
}

// Resposta do chat IA
export interface ChatResponse {
  reply: string
  fields: Record<string, any>
}

// Resultado da análise de documento
export interface DocumentAnalysis {
  tipo_documento: string | null
  numero_documento: string | null
  full_name: string | null
  nif: string | null
  data_nascimento: string | null
  data_validade_documento: string | null
  nacionalidade: string | null
  pais_emissor: string | null
  genero: string | null
}
```

---

## 5. Fase C — Validações Zod

### Ficheiro a MODIFICAR: `lib/validations/lead.ts`

Substituir o conteúdo actual por:

```typescript
import { z } from 'zod'

// Schema de criação de lead (campos mínimos)
export const createLeadSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').trim(),
  email: z.string().email('Email inválido').optional().or(z.literal('')).transform(v => v || undefined),
  telefone: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  telemovel: z.string().optional().or(z.literal('')).transform(v => v || undefined),
  origem: z.string().optional(),
  agent_id: z.string().uuid().optional().or(z.literal('')).transform(v => v || undefined),
  estado: z.string().optional(),
  observacoes: z.string().optional(),
})

// Schema de actualização de lead (todos os campos opcionais)
export const updateLeadSchema = z.object({
  // Dados básicos
  nome: z.string().min(1).trim().optional(),
  full_name: z.string().trim().optional().nullable(),
  email: z.string().email().optional().nullable(),
  telefone: z.string().optional().nullable(),
  telemovel: z.string().optional().nullable(),
  telefone_fixo: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  temperatura: z.string().optional().nullable(),
  data: z.string().optional().nullable(),
  origem: z.string().optional().nullable(),
  agent_id: z.string().uuid().optional().nullable(),
  forma_contacto: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  
  // Consentimentos
  consentimento_contacto: z.boolean().optional(),
  consentimento_webmarketing: z.boolean().optional(),
  meio_contacto_preferencial: z.string().optional().nullable(),
  data_contacto: z.string().optional().nullable(),
  
  // Dados pessoais
  genero: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  nacionalidade: z.string().optional().nullable(),
  
  // Documentos
  tipo_documento: z.string().optional().nullable(),
  numero_documento: z.string().optional().nullable(),
  nif: z.string().optional().nullable(),
  pais_emissor: z.string().optional().nullable(),
  data_validade_documento: z.string().optional().nullable(),
  documento_identificacao_url: z.string().url().optional().nullable(),
  documento_identificacao_frente_url: z.string().url().optional().nullable(),
  documento_identificacao_verso_url: z.string().url().optional().nullable(),
  
  // Morada
  codigo_postal: z.string().optional().nullable(),
  localidade: z.string().optional().nullable(),
  pais: z.string().optional().nullable(),
  distrito: z.string().optional().nullable(),
  concelho: z.string().optional().nullable(),
  freguesia: z.string().optional().nullable(),
  zona: z.string().optional().nullable(),
  morada: z.string().optional().nullable(),
  
  // Empresa
  tem_empresa: z.boolean().optional(),
  empresa: z.string().optional().nullable(),
  nipc: z.string().optional().nullable(),
  morada_empresa: z.string().optional().nullable(),
  telefone_empresa: z.string().optional().nullable(),
  email_empresa: z.string().email().optional().nullable(),
  website_empresa: z.string().url().optional().nullable(),
})

// Schema de criação de negócio
export const createNegocioSchema = z.object({
  lead_id: z.string().uuid('Lead ID inválido'),
  tipo: z.enum(['Compra', 'Venda', 'Compra e Venda', 'Arrendatário', 'Arrendador', 'Outro']),
  estado: z.string().optional(),
  observacoes: z.string().optional(),
  tipo_imovel: z.string().optional(),
  localizacao: z.string().optional(),
  estado_imovel: z.string().optional(),
  area_m2: z.number().positive().optional(),
  quartos: z.number().int().min(0).optional(),
  orcamento: z.number().positive().optional(),
  orcamento_max: z.number().positive().optional(),
  renda_max_mensal: z.number().positive().optional(),
  area_min_m2: z.number().positive().optional(),
  quartos_min: z.number().int().min(0).optional(),
  preco_venda: z.number().positive().optional(),
  renda_pretendida: z.number().positive().optional(),
})

// Schema de actualização de negócio (todos os campos do formulário)
export const updateNegocioSchema = z.object({
  tipo: z.string().optional(),
  estado: z.string().optional(),
  observacoes: z.string().optional().nullable(),
  tipo_imovel: z.string().optional().nullable(),
  localizacao: z.string().optional().nullable(),
  estado_imovel: z.string().optional().nullable(),
  area_m2: z.number().optional().nullable(),
  quartos: z.number().optional().nullable(),
  orcamento: z.number().optional().nullable(),
  orcamento_max: z.number().optional().nullable(),
  renda_max_mensal: z.number().optional().nullable(),
  area_min_m2: z.number().optional().nullable(),
  quartos_min: z.number().optional().nullable(),
  preco_venda: z.number().optional().nullable(),
  renda_pretendida: z.number().optional().nullable(),
  credito_pre_aprovado: z.boolean().optional().nullable(),
  valor_credito: z.number().optional().nullable(),
  capital_proprio: z.number().optional().nullable(),
  financiamento_necessario: z.boolean().optional().nullable(),
  prazo_compra: z.string().optional().nullable(),
  motivacao_compra: z.string().optional().nullable(),
  tem_elevador: z.boolean().optional().nullable(),
  tem_estacionamento: z.boolean().optional().nullable(),
  tem_garagem: z.boolean().optional().nullable(),
  tem_exterior: z.boolean().optional().nullable(),
  tem_varanda: z.boolean().optional().nullable(),
  tem_piscina: z.boolean().optional().nullable(),
  tem_porteiro: z.boolean().optional().nullable(),
  tem_arrumos: z.boolean().optional().nullable(),
  classe_imovel: z.string().optional().nullable(),
  casas_banho: z.number().optional().nullable(),
  num_wc: z.number().optional().nullable(),
  total_divisoes: z.number().optional().nullable(),
  distrito: z.string().optional().nullable(),
  concelho: z.string().optional().nullable(),
  freguesia: z.string().optional().nullable(),
  situacao_profissional: z.string().optional().nullable(),
  rendimento_mensal: z.number().optional().nullable(),
  tem_fiador: z.boolean().optional().nullable(),
  duracao_minima_contrato: z.string().optional().nullable(),
  caucao_rendas: z.number().optional().nullable(),
  aceita_animais: z.boolean().optional().nullable(),
  mobilado: z.boolean().optional().nullable(),
  // Campos _venda (para tipo "Compra e Venda")
  localizacao_venda: z.string().optional().nullable(),
  tipo_imovel_venda: z.string().optional().nullable(),
  estado_imovel_venda: z.string().optional().nullable(),
  tem_elevador_venda: z.boolean().optional().nullable(),
  tem_estacionamento_venda: z.boolean().optional().nullable(),
  tem_garagem_venda: z.boolean().optional().nullable(),
  tem_exterior_venda: z.boolean().optional().nullable(),
  tem_varanda_venda: z.boolean().optional().nullable(),
  tem_piscina_venda: z.boolean().optional().nullable(),
  tem_porteiro_venda: z.boolean().optional().nullable(),
  tem_arrumos_venda: z.boolean().optional().nullable(),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type CreateNegocioInput = z.infer<typeof createNegocioSchema>
export type UpdateNegocioInput = z.infer<typeof updateNegocioSchema>
```

---

## 6. Fase D — Constantes e Labels PT-PT

### Ficheiro a MODIFICAR: `lib/constants.ts`

Adicionar estas constantes (não remover as existentes):

```typescript
// --- LEADS ---

export const LEAD_ESTADOS = [
  'Novo',
  'Em contacto',
  'Qualificado',
  'Em negociação',
  'Convertido',
  'Perdido',
] as const

export const LEAD_TEMPERATURAS = [
  { value: 'Quente', label: 'Quente', color: 'text-red-600 bg-red-50' },
  { value: 'Morno', label: 'Morno', color: 'text-amber-600 bg-amber-50' },
  { value: 'Frio', label: 'Frio', color: 'text-blue-600 bg-blue-50' },
] as const

export const LEAD_ORIGENS = [
  'Idealista',
  'Imovirtual',
  'Casa Sapo',
  'Website',
  'Referência',
  'Walk-in',
  'Telefone',
  'Redes Sociais',
  'Outro',
] as const

export const LEAD_FORMAS_CONTACTO = [
  'Telefone',
  'Email',
  'WhatsApp',
  'Presencial',
  'Redes Sociais',
  'Outro',
] as const

export const LEAD_MEIOS_CONTACTO = [
  'Telefone',
  'Email',
  'WhatsApp',
  'SMS',
] as const

export const LEAD_GENEROS = ['Masculino', 'Feminino'] as const

export const LEAD_TIPOS_DOCUMENTO = [
  'Cartão de Cidadão',
  'Passaporte',
  'Bilhete de Identidade',
  'Autorização de Residência',
] as const

// --- NEGÓCIOS ---

export const NEGOCIO_TIPOS = [
  'Compra',
  'Venda',
  'Compra e Venda',
  'Arrendatário',
  'Arrendador',
  'Outro',
] as const

export const NEGOCIO_ESTADOS = [
  'Aberto',
  'Em progresso',
  'Fechado',
  'Cancelado',
] as const

export const NEGOCIO_TIPOS_IMOVEL = [
  'Apartamento',
  'Moradia',
  'Terreno',
  'Escritório',
  'Loja',
  'Armazém',
  'Outro',
] as const

export const NEGOCIO_ESTADOS_IMOVEL = [
  'Novo',
  'Em construção',
  'Usado',
  'Para recuperação',
] as const

export const NEGOCIO_MOTIVACOES = [
  'Primeira habitação',
  'Investimento',
  'Upgrade',
  'Downsize',
  'Relocalização',
  'Outro',
] as const

export const NEGOCIO_PRAZOS = [
  'Imediato',
  'Até 3 meses',
  '3 a 6 meses',
  '6 a 12 meses',
  'Mais de 1 ano',
] as const

export const NEGOCIO_CLASSES_IMOVEL = [
  'Habitação',
  'Comercial',
  'Misto',
  'Rústico',
  'Outro',
] as const

export const NEGOCIO_SITUACOES_PROFISSIONAIS = [
  'Empregado por conta de outrem',
  'Trabalhador independente',
  'Empresário',
  'Reformado',
  'Estudante',
  'Outro',
] as const

export const NEGOCIO_DURACOES_CONTRATO = [
  'Sem mínimo',
  '1 ano',
  '2 anos',
  '3 anos',
] as const
```

---

## 7. Fase E — API Route Handlers (Leads)

Todos os ficheiros devem ser criados em `app/api/leads/`. Usar `createClient` do `lib/supabase/server.ts`.

### 7.1. `GET /api/leads` — Listagem com filtros

**Ficheiro:** `app/api/leads/route.ts` (export GET)

**Query params:** `nome`, `estado`, `temperatura`, `origem`, `agent_id`, `limit` (default 20, max 100), `offset` (default 0)

**Select:** `*, agent:dev_users(id, commercial_name)` com `count: 'exact'`

**Filtros:**
- `nome` → `.ilike('nome', '%{nome}%')`
- `estado` → `.eq('estado', estado)`
- `temperatura` → `.eq('temperatura', temperatura)`
- `origem` → `.eq('origem', origem)`
- `agent_id` → `.eq('agent_id', agent_id)`

**Ordenação:** `created_at DESC`

**Retorno:** `{ data: Lead[], total: number }`

### 7.2. `POST /api/leads` — Criar lead

**Ficheiro:** `app/api/leads/route.ts` (export POST)

**Validação:** `createLeadSchema` do Zod

**Campo obrigatório:** `nome`

**Campos opcionais:** `estado`, `data`, `telefone`, `email`, `origem`, `agent_id`, `telemovel`, `telefone_fixo`, `forma_contacto`, `observacoes`, `consentimento_contacto`, `consentimento_webmarketing`, `meio_contacto_preferencial`, `data_contacto`, `genero`, `data_nascimento`, `nacionalidade`, `tipo_documento`, `numero_documento`, `nif`, `pais_emissor`, `data_validade_documento`, `codigo_postal`, `localidade`, `pais`, `distrito`, `concelho`, `freguesia`, `zona`, `morada`, `empresa`, `morada_empresa`, `telefone_empresa`

**Lógica:** Trim strings, converter strings vazias em null.

**Retorno:** `{ id: string }`

### 7.3. `GET /api/leads/[id]` — Detalhe

**Ficheiro:** `app/api/leads/[id]/route.ts` (export GET)

**Select:** `*, agent:dev_users(id, commercial_name)`

**Retorno:** objecto lead completo ou 404

### 7.4. `PUT /api/leads/[id]` — Actualizar

**Ficheiro:** `app/api/leads/[id]/route.ts` (export PUT)

**Campos actualizáveis:** todos os campos do `updateLeadSchema`

**Lógica:** Iterar sobre campos, trim strings, converter strings vazias em null. Ignorar body vazio (retornar `{ id }` sem update).

**Retorno:** `{ id: string }`

### 7.5. `DELETE /api/leads/[id]` — Eliminar

**Ficheiro:** `app/api/leads/[id]/route.ts` (export DELETE)

**Retorno:** `{ ok: true }`

### 7.6. `GET /api/leads/[id]/attachments` — Listar anexos

**Ficheiro:** `app/api/leads/[id]/attachments/route.ts` (export GET)

**Select:** `id, url, name, created_at` da tabela `lead_attachments` onde `lead_id = id`

**Ordenação:** `created_at ASC`

**Retorno:** array de attachments

### 7.7. `POST /api/leads/[id]/attachments` — Adicionar anexo

**Ficheiro:** `app/api/leads/[id]/attachments/route.ts` (export POST)

**Body:** `{ url: string, name?: string }`

**Retorno:** objecto attachment criado

### 7.8. `DELETE /api/leads/attachments/[attachmentId]` — Eliminar anexo

**Ficheiro:** `app/api/leads/attachments/[attachmentId]/route.ts` (export DELETE)

**Retorno:** `{ success: true }`

---

## 8. Fase F — API Route Handlers (Negócios)

Ficheiros em `app/api/negocios/`.

### 8.1. `GET /api/negocios` — Listagem

**Ficheiro:** `app/api/negocios/route.ts` (export GET)

**Query params:** `lead_id`, `tipo`, `estado`, `limit` (default 50, max 100), `offset`

**Select:** `*, lead:leads(id, nome, agent:dev_users(id, commercial_name))`

**Retorno:** `{ data: Negocio[], total: number }`

### 8.2. `POST /api/negocios` — Criar

**Ficheiro:** `app/api/negocios/route.ts` (export POST)

**Campos obrigatórios:** `lead_id`, `tipo`

**Campos opcionais:** `estado`, `observacoes`, `tipo_imovel`, `localizacao`, `estado_imovel`, `area_m2`, `quartos`, `orcamento`, `renda_max_mensal`, `area_min_m2`, `quartos_min`, `preco_venda`, `renda_pretendida`

**Retorno:** `{ id: string }`

### 8.3. `GET /api/negocios/[id]` — Detalhe

**Ficheiro:** `app/api/negocios/[id]/route.ts` (export GET)

**Select:** `*, lead:leads(id, nome, telefone, telemovel, email)`

**Retorno:** negócio completo ou 404

### 8.4. `PUT /api/negocios/[id]` — Actualizar

**Ficheiro:** `app/api/negocios/[id]/route.ts` (export PUT)

**Campos actualizáveis:** todos os do `updateNegocioSchema` (lista extensa — ver secção 2.2)

**Retorno:** `{ id: string }`

### 8.5. `DELETE /api/negocios/[id]` — Eliminar

**Ficheiro:** `app/api/negocios/[id]/route.ts` (export DELETE)

**Retorno:** `{ success: true }`

### 8.6. `GET /api/negocios/[id]/matches` — Matching de imóveis

**Ficheiro:** `app/api/negocios/[id]/matches/route.ts` (export GET)

**Lógica complexa:**

1. Buscar critérios do negócio (localizacao, orcamento, orcamento_max, quartos_min)
2. Consultar `dev_properties` com filtros:
   - `business_type = 'Venda'`
   - `status != 'Vendido'`
   - `listing_price <= orcamento_max * 1.15` (15% acima do budget)
   - `listing_price >= orcamento` (floor)
   - Zonas: split por vírgula, OR de `city.ilike` + `zone.ilike`
3. Buscar specs (`dev_property_specifications`) e covers (`dev_property_media`) em paralelo
4. Filtrar por quartos mínimos (post-filter)
5. Calcular `price_flag`:
   - `null` = dentro do orçamento
   - `'yellow'` = 0-10% acima
   - `'orange'` = 10-15% acima
6. Ordenar: dentro do orçamento primeiro, depois yellow, depois orange

**Retorno:** `{ data: PropertyMatch[] }`

### 8.7. `GET /api/negocios/[id]/interessados` — Leads interessados

**Ficheiro:** `app/api/negocios/[id]/interessados/route.ts` (export GET)

**Lógica:** Para um negócio de Venda, encontrar todos os negócios de Compra/Compra e Venda abertos de outros agentes. Retornar primeiro nome do lead, nome do colega consultor, e telefone comercial.

**Retorno:** `{ data: NegocioInteressado[] }`

---

## 9. Fase G — API Route Handlers (Utilitários)

### 9.1. `GET /api/postal-code/[cp]` — Lookup de código postal

**Ficheiro:** `app/api/postal-code/[cp]/route.ts` (export GET)

**Lógica:**
1. Normalizar o código postal (aceitar "4000-001" ou "4000001")
2. Validar formato com regex `^(\d{4})-?(\d{3})$`
3. Fetch externo: `https://json.geoapi.pt/cp/{cp4}-{cp3}?json=1`
4. Retornar dados como recebidos (contém distrito, concelho, freguesia, localidade)

**Utilização no frontend:** Quando o utilizador preenche o código postal, auto-preencher distrito, concelho, freguesia, localidade.

**IMPORTANTE:** Esta API é pública (geoapi.pt) e não precisa de API key.

### 9.2. `GET /api/nipc/[nipc]` — Lookup de NIPC/NIF empresarial

**Ficheiro:** `app/api/nipc/[nipc]/route.ts` (export GET)

**Lógica:**
1. Normalizar NIPC (remover não-dígitos, validar 9 dígitos)
2. Fetch externo: `https://www.nif.pt/?json=1&q={nipc}&key={NIF_PT_API_KEY}`
3. Tratar rate limits (429) e not found (404)
4. Retornar: `{ nipc, nome, morada, telefone, email, website }`

**Variável de ambiente necessária:** `NIF_PT_API_KEY`

**Utilização no frontend:** Quando o utilizador introduz o NIPC da empresa, auto-preencher nome, morada, telefone, email, website.

---

## 10. Fase H — API Route Handlers (IA)

**Variável de ambiente necessária:** `OPENAI_API_KEY`

**Dependência:** `openai` (npm package)

### 10.1. `POST /api/leads/[id]/analyze-document` — OCR de documento de identificação

**Ficheiro:** `app/api/leads/[id]/analyze-document/route.ts` (export POST)

**Lógica:**
1. Buscar `documento_identificacao_url` do lead
2. Se PDF: download + base64. Se imagem: enviar URL directamente
3. Enviar ao GPT-4o-mini com prompt de extracção
4. Retornar campos extraídos: `tipo_documento`, `numero_documento`, `full_name`, `nif`, `data_nascimento`, `data_validade_documento`, `nacionalidade`, `pais_emissor`, `genero`

**Utilização no frontend:** Após upload do documento de identificação, botão "Analisar documento" que preenche automaticamente os campos.

### 10.2. `POST /api/negocios/[id]/chat` — Chat assistido para preencher negócio

**Ficheiro:** `app/api/negocios/[id]/chat/route.ts` (export POST)

**Body:** `{ messages: { role: string, content: string }[] }`

**Lógica:**
1. Buscar dados actuais do negócio
2. Construir system prompt com campos preenchidos vs. em falta (contextuais ao tipo de negócio)
3. Enviar ao GPT-4o com histórico de conversa
4. Resposta em JSON: `{ reply: string, fields: Record<string, any> }`
5. O frontend aplica os fields extraídos ao negócio via PUT

**Modelo:** GPT-4o (melhor compreensão de contexto), max_tokens: 150, temperature: 0.3

### 10.3. `POST /api/negocios/[id]/fill-from-text` — Extracção de dados de texto livre

**Ficheiro:** `app/api/negocios/[id]/fill-from-text/route.ts` (export POST)

**Body:** `{ text: string }`

**Lógica:**
1. Buscar tipo do negócio
2. Enviar texto ao GPT-4o com prompt de extracção estruturada
3. Retornar campos extraídos (apenas os que foram detectados)

**Utilização:** Colar um texto descritivo de um cliente (ex: "Procuro T3 em Lisboa até 350k") e extrair automaticamente os campos relevantes.

### 10.4. `POST /api/negocios/[id]/transcribe` — Transcrição de áudio

**Ficheiro:** `app/api/negocios/[id]/transcribe/route.ts` (export POST)

**Body:** multipart/form-data com campo `audio` (blob de áudio webm)

**Lógica:**
1. Ler multipart form data
2. Enviar ao Whisper (whisper-1) com language: 'pt'
3. Retornar `{ text: string }`

**Utilização:** Gravar áudio com descrição verbal do que o cliente pretende, transcrever, e depois usar `fill-from-text` para extrair os campos.

### 10.5. `GET /api/negocios/[id]/summary` — Resumo do negócio

**Ficheiro:** `app/api/negocios/[id]/summary/route.ts` (export GET)

**Lógica:**
1. Buscar todos os dados do negócio + nome do lead
2. Formatar campos preenchidos com labels PT-PT
3. Enviar ao GPT-4o com prompt para resumo em prosa (2-4 parágrafos)
4. Retornar `{ summary: string }`

**Utilização:** Gerar um briefing profissional do negócio para partilhar com colegas.

---

## 11. Fase I — Frontend: Listagem de Leads

### Página: `app/dashboard/leads/page.tsx`

**Layout:**
- Header com título "Leads" e botão "Novo Lead"
- Barra de filtros: search (nome), select de estado, select de temperatura, select de origem, select de consultor
- Tabela/DataTable com colunas: Nome, Email, Telemóvel, Estado (badge), Temperatura (badge com cor), Origem, Consultor, Data criação, Acções
- Paginação (offset-based)

**Componentes shadcn/ui:** Input, Select, Button, Badge, Table (ou DataTable genérico), Skeleton

**Comportamento:**
- Debounce de 300ms no search
- Filtros actualizam query params na URL (para bookmarkable)
- Click na linha → navegar para `/dashboard/leads/{id}`
- Botão acções: Editar, Eliminar (com ConfirmDialog)

### Página: `app/dashboard/leads/novo/page.tsx`

**Formulário simples de criação rápida:**
- Nome (obrigatório)
- Email
- Telemóvel
- Origem (select)
- Consultor (select)
- Observações (textarea)

Após criar, redirigir para `/dashboard/leads/{id}` para preenchimento completo.

---

## 12. Fase J — Frontend: Detalhe/Edição do Lead

### Página: `app/dashboard/leads/[id]/page.tsx`

**Layout com tabs (shadcn Tabs):**

#### Tab 1 — Dados Pessoais
- **Secção: Informação Básica** — nome, full_name, email, telemóvel, telefone fixo, género, data nascimento, nacionalidade
- **Secção: Contacto** — forma de contacto, meio preferencial, data de contacto, consentimentos (checkbox)
- **Secção: Estado** — estado (select), temperatura (select com cores), origem (select), consultor (select)
- **Secção: Observações** — textarea

#### Tab 2 — Identificação
- **Upload de documento** — drag-and-drop para frente e verso (upload ao R2)
- **Botão "Analisar com IA"** — chama `/api/leads/{id}/analyze-document`, mostra preview dos dados extraídos, botão para aplicar
- **Campos do documento** — tipo_documento, numero_documento, nif, pais_emissor, data_validade_documento (editáveis manualmente)

#### Tab 3 — Morada
- **Código postal** com auto-fill — ao introduzir código postal válido (XXXX-XXX), chama `/api/postal-code/{cp}` e preenche distrito, concelho, freguesia, localidade automaticamente
- **Campos:** morada, código postal, localidade, distrito, concelho, freguesia, zona, país

#### Tab 4 — Empresa
- **Toggle "Tem empresa"** — mostra/esconde campos
- **NIPC com auto-fill** — ao introduzir NIPC (9 dígitos), chama `/api/nipc/{nipc}` e preenche nome, morada, telefone, email, website
- **Campos:** empresa, nipc, morada_empresa, telefone_empresa, email_empresa, website_empresa

#### Tab 5 — Negócios
- Lista de negócios associados ao lead (`GET /api/negocios?lead_id={id}`)
- Botão "Novo Negócio" → dialog de criação rápida (tipo obrigatório)
- Cada negócio mostra: tipo (badge), estado (badge), localização, orçamento, data
- Click → navega para detalhe do negócio

#### Tab 6 — Anexos
- Lista de ficheiros (`GET /api/leads/{id}/attachments`)
- Upload drag-and-drop (ao R2, depois POST attachment)
- Preview de imagens, link para download de outros tipos
- Botão eliminar com confirmação

**Padrão de gravação:** Auto-save com debounce (500ms) OU botão "Guardar" explícito por secção. Recomendação: **botão Guardar explícito** para evitar saves parciais.

**Toast de confirmação:** Usar Sonner → `toast.success('Lead actualizado com sucesso')` ou `toast.error('Erro ao actualizar lead')`

---

## 13. Fase K — Frontend: Negócios

### Página: `app/dashboard/leads/[id]/negocios/[negocioId]/page.tsx`

**Layout com tabs:**

#### Tab 1 — Detalhes do Negócio
- Campos dinâmicos baseados no `tipo` do negócio:
  - **Compra:** orçamento min/max, financiamento, crédito, motivação, prazo, tipo imóvel, localização, quartos min, área min, estado, amenidades (checkboxes)
  - **Venda:** preço venda, tipo imóvel, classe, quartos, área, casas banho, WC, divisões, estado, localização (distrito/concelho/freguesia), amenidades
  - **Arrendatário:** renda max, tipo imóvel, localização, quartos min, área min, situação profissional, rendimento, fiador, mobilado
  - **Arrendador:** renda pretendida, duração mínima, caução, aceita animais, mobilado, tipo imóvel, classe, quartos, área, etc.
  - **Compra e Venda:** combinação dos campos de Compra + Venda

#### Tab 2 — Assistente IA (Chat)
- Interface de chat integrada
- Mostra conversa com assistente que faz perguntas sobre campos em falta
- Campos extraídos pelo assistente são aplicados automaticamente via PUT
- Botão "Reiniciar conversa"

#### Tab 3 — Preenchimento Rápido
- **Textarea** para colar texto descritivo
- **Botão de gravação** de áudio (MediaRecorder API → webm → `/api/negocios/{id}/transcribe` → texto)
- Botão "Extrair dados" → `/api/negocios/{id}/fill-from-text`
- Preview dos dados extraídos antes de aplicar

#### Tab 4 — Matching (apenas para tipo Compra/Compra e Venda)
- Lista de imóveis correspondentes (`GET /api/negocios/{id}/matches`)
- Cards com: foto de capa, título, preço, tipologia, área, cidade
- Badge de preço: verde (dentro do orçamento), amarelo (0-10% acima), laranja (10-15% acima)
- Click → abre imóvel em nova tab

#### Tab 5 — Interessados (apenas para tipo Venda)
- Lista de compradores potenciais (`GET /api/negocios/{id}/interessados`)
- Mostra: primeiro nome do lead, consultor colega, telefone comercial
- Botão "Resumo IA" → gera resumo do negócio

---

## 14. Fase L — Frontend: Funcionalidades IA

### Componente: `components/leads/document-analyzer.tsx`

- Recebe `leadId` como prop
- Mostra imagem do documento (se existe `documento_identificacao_url` ou as URLs frente/verso)
- Botão "Analisar com IA" com loading state
- Dialog/sheet com preview dos dados extraídos
- Botão "Aplicar dados" que faz PUT com os campos

### Componente: `components/negocios/negocio-chat.tsx`

- Interface de chat (messages state local)
- Envia ao `/api/negocios/{id}/chat` com histórico completo
- Mostra reply do assistente
- Aplica fields automaticamente via PUT
- Loading indicator enquanto espera resposta

### Componente: `components/negocios/quick-fill.tsx`

- Textarea para texto
- Botão de gravar áudio (toggle on/off)
- Indicador visual de gravação (pulsing dot)
- Preview de dados extraídos em form editável
- Botão "Aplicar" para confirmar

### Componente: `components/negocios/negocio-summary.tsx`

- Botão "Gerar Resumo"
- Mostra resumo formatado em card
- Botão "Copiar" para clipboard

---

## 15. Ficheiros Criados vs Modificados

### CRIAR (novos):

```
types/lead.ts
app/api/leads/route.ts                              (GET + POST)
app/api/leads/[id]/route.ts                          (GET + PUT + DELETE)
app/api/leads/[id]/attachments/route.ts              (GET + POST)
app/api/leads/[id]/analyze-document/route.ts         (POST)
app/api/leads/attachments/[attachmentId]/route.ts    (DELETE)
app/api/negocios/route.ts                            (GET + POST)
app/api/negocios/[id]/route.ts                       (GET + PUT + DELETE)
app/api/negocios/[id]/matches/route.ts               (GET)
app/api/negocios/[id]/interessados/route.ts          (GET)
app/api/negocios/[id]/chat/route.ts                  (POST)
app/api/negocios/[id]/fill-from-text/route.ts        (POST)
app/api/negocios/[id]/transcribe/route.ts            (POST)
app/api/negocios/[id]/summary/route.ts               (GET)
app/api/postal-code/[cp]/route.ts                    (GET)
app/api/nipc/[nipc]/route.ts                         (GET)
app/dashboard/leads/page.tsx
app/dashboard/leads/novo/page.tsx
app/dashboard/leads/[id]/page.tsx
app/dashboard/leads/[id]/negocios/[negocioId]/page.tsx
components/leads/document-analyzer.tsx
components/leads/lead-form.tsx
components/leads/lead-filters.tsx
components/negocios/negocio-form.tsx
components/negocios/negocio-chat.tsx
components/negocios/negocio-matches.tsx
components/negocios/negocio-interessados.tsx
components/negocios/negocio-summary.tsx
components/negocios/quick-fill.tsx
```

### MODIFICAR (existentes):

```
lib/validations/lead.ts         (substituir conteúdo — ver Fase C)
lib/constants.ts                (adicionar constantes — ver Fase D)
components/layout/app-sidebar.tsx  (verificar que link de Leads existe)
```

---

## 16. Critérios de Sucesso

### Verificação Automatizada

- [ ] `npm run build` compila sem erros de TypeScript
- [ ] Todos os endpoints GET retornam 200 com dados
- [ ] POST de lead com `nome` retorna `{ id }` com status 201
- [ ] POST de negócio com `lead_id` + `tipo` retorna `{ id }` com status 201
- [ ] PUT de lead actualiza campos correctamente
- [ ] DELETE de lead remove o registo

### Verificação Manual

- [ ] Listagem de leads mostra dados existentes (5 registos)
- [ ] Filtros de estado, temperatura, origem funcionam
- [ ] Criação de lead redirige para detalhe
- [ ] Tab de Identificação permite upload e análise IA
- [ ] Código postal auto-preenche distrito/concelho/freguesia
- [ ] NIPC auto-preenche dados da empresa
- [ ] Criação de negócio funciona desde o detalhe do lead
- [ ] Campos do negócio mudam dinamicamente conforme o tipo
- [ ] Chat IA responde e preenche campos
- [ ] Matching de imóveis retorna resultados (se houver dados compatíveis)
- [ ] Toasts de sucesso/erro aparecem correctamente
- [ ] UI toda em PT-PT

---

## 17. Fora de Escopo

1. **Vista Kanban** — implementar apenas lista/tabela nesta fase
2. **Score visual** (barra 0-100) — adiar para fase posterior
3. **Timeline de actividades** — tabela `lead_activities` não existe; adiar
4. **Notificações push** — fora de escopo
5. **Supabase Realtime** — fora de escopo
6. **RLS policies** — projecto opera sem RLS

---

## 18. Ordem de Execução Recomendada

```
1.  Regenerar types/database.ts (confirmar schema actual)
2.  Fase B — Criar types/lead.ts
3.  Fase C — Actualizar lib/validations/lead.ts
4.  Fase D — Adicionar constantes a lib/constants.ts
5.  Fase E — APIs de Leads (CRUD + attachments)
6.  Fase F — APIs de Negócios (CRUD + matches + interessados)
7.  Fase G — APIs utilitárias (postal-code + nipc)
8.  Fase I — Frontend: listagem de leads + criação
9.  Fase J — Frontend: detalhe do lead com tabs
10. Fase K — Frontend: detalhe do negócio com tabs
11. Fase H — APIs de IA (analyze-document, chat, fill-from-text, transcribe, summary)
12. Fase L — Frontend: componentes IA
13. Verificação final (build + testes manuais)
```

**Nota:** As fases H e L (IA) podem ser adiadas e implementadas como melhoria posterior. O módulo funciona sem IA — apenas sem as funcionalidades de auto-preenchimento e chat assistido.

---

## Variáveis de Ambiente Necessárias

```env
# Já existentes (confirmar)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Novas (necessárias para IA e lookups)
OPENAI_API_KEY=...          # Para análise de documentos, chat, transcrição, resumo
NIF_PT_API_KEY=...          # Para lookup de NIPC via nif.pt
```
