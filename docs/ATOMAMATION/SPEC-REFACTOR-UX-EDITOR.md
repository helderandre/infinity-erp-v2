# SPEC-REFACTOR-UX-EDITOR — Refactoring de UX do Editor de Automações

**Data:** 2026-03-06
**Ultima actualizacao:** 2026-03-06
**Status:** IMPLEMENTADO (parcial — ver secao de estado abaixo)
**Objectivo:** Tornar o editor de automações acessível a utilizadores leigos (consultores, office managers, gestoras processuais) que NÃO sabem SQL, JSON, nem nomes de tabelas.
**Principio central:** O utilizador nunca ve jargao tecnico. Tudo e apresentado em linguagem natural PT-PT.

---

## Estado da Implementacao

| Item | Estado | Notas |
|------|--------|-------|
| Migration SQL `auto_get_table_columns` | FEITO | Aplicada via Supabase MCP |
| API route `/api/automacao/schema/[table]` | FEITO | `app/api/automacao/schema/[table]/route.ts` |
| Constantes `lib/constants-automations.ts` | FEITO | TABLE_OPTIONS, COLUMN_LABELS (11 tabelas), OPERATION_OPTIONS, FILTER_OPERATORS, ENTITY_OPTIONS, STATUS_VALUES, RPC_PARAM_TYPES + helpers |
| Hook `useTableColumns` | FEITO | `hooks/use-table-columns.ts` — carrega colunas dinamicamente da API |
| R1. Supabase Query Node | FEITO | Cards de operacao, Select de tabela com icones, colunas dinamicas com checkbox, filtros em linguagem natural, RadioGroup para resultados, seta nos dados, "Outra tabela..." colapsavel |
| R2. Condition Node preview | FEITO | `describeCondition()` mostra frase legivel no canvas (ex: "nome e igual a ...") |
| R3. Trigger Status Node | FEITO | Selects assistidos com ENTITY_OPTIONS + STATUS_VALUES. Mostra "Quando um(a) Lead muda o estado para Novo" |
| R4. API Schema | FEITO | Mesmo que item 2 |
| R5. Previews dos nodes | PARCIAL | Supabase Query e Condition tem previews legiveis. Delay, WhatsApp e Email nao foram tocados (nao faziam parte do scope minimo) |
| `trigger-webhook-node.tsx` | NAO FEITO | Listado na tabela de ficheiros mas sem instrucoes detalhadas na spec. Adiado para proxima iteracao |
| `variable-picker.tsx` | NAO ALTERADO | Ja funcionava bem. A spec mencionava melhorias mas sem instrucoes concretas |
| Tipo `not_is` no operator union | FEITO | Adicionado `"not_is"` a `SupabaseQueryFilter.operator` em `automation-flow.ts` |

### Diferencas face a spec original

1. **Tabela como Select em vez de Combobox**: A spec sugeria usar `Command` (Combobox pesquisavel) para a seleccao de tabela. Foi implementado com `Select` do shadcn por simplicidade, com uma opcao "Outra tabela..." colapsavel via `Collapsible` para input livre. O resultado e equivalente e mais limpo.

2. **Conversao automatica para snake_case no outputVariable**: A spec sugeria converter "Dados do lead" para `dados_do_lead`. Nao foi implementado — o campo aceita texto livre e guarda tal como o utilizador escreve. Pode ser adicionado depois se necessario.

3. **Modo RPC com lista de funcoes**: A spec sugeria listar funcoes disponiveis num Combobox. Foi mantido como input de texto livre por agora, pois requer uma API adicional para listar funcoes do Supabase.

4. **Toggle E/OU entre filtros**: A spec mencionava um toggle entre condições. Actualmente mostra sempre "E" entre filtros (hardcoded). Pode ser adicionado depois.

5. **Previews de Delay/WhatsApp/Email**: Listados na tabela R5 mas nao implementados — esses nodes nao faziam parte do scope principal desta refactoring.

---

## 🚨 Problema Actual

A implementação actual expõe conceitos técnicos directamente na interface:
- Nomes de tabelas SQL (`leads`, `dev_properties`)
- Operadores SQL (`=`, `≠`, `>`, `<`)
- Termos de API (`.single()`, `query_result`, `coluna`)
- Nomes de funções (`get_lead_stats`)
- Variáveis como texto bruto (`{{lead_nome}}`)

**O utilizador-alvo** é uma gestora processual ou um consultor imobiliário que nunca abriu um terminal. A interface deve parecer um Zapier ou Monday.com, não um phpMyAdmin.

---

## 📋 Ficheiros a Refactorar

| Ficheiro | Problema | Complexidade |
|----------|----------|-------------|
| `components/automations/nodes/supabase-query-node.tsx` | Sheet inteira com jargão técnico | Alta |
| `components/automations/nodes/condition-node.tsx` | Operadores em linguagem natural (já parcial) | Baixa |
| `components/automations/nodes/trigger-status-node.tsx` | Select de entidade sem assistência | Média |
| `components/automations/nodes/trigger-webhook-node.tsx` | Mapeamento de campos do payload | Média |
| `components/automations/variable-picker.tsx` | Melhorar UX de inserção de variáveis | Média |

---

## R1. Refactoring do Supabase Query Node (PRINCIPAL)

**Ficheiro:** `components/automations/nodes/supabase-query-node.tsx`

### Conceito: "O que queres fazer?"

Em vez de expor operações SQL, apresentar como **acções em linguagem natural** com formulários assistidos.

### Passo 1: Substituir Select de operação

**ACTUAL (técnico):**
```
Operação: [Consultar ▼]  ← "Consultar" é ok mas "Inserir/Actualizar" é jargão
```

**NOVO (orientado a objectivo):**
```
O que queres fazer?

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ 🔍               │  │ ✏️               │  │ ➕               │
│ Buscar dados     │  │ Actualizar dados │  │ Criar registo    │
│ Encontrar info   │  │ Modificar info   │  │ Adicionar novo   │
│ no sistema       │  │ existente        │  │ ao sistema       │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ 🔄               │  │ 🗑️               │  │ ⚡               │
│ Criar ou         │  │ Remover registo  │  │ Executar função  │
│ actualizar       │  │ Apagar dados     │  │ Operação         │
│ Se existe, muda  │  │ do sistema       │  │ avançada         │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

Usar cards clicáveis (como os tipos de mensagem da F4) em vez de um Select dropdown. Cada card tem ícone, título e subtítulo explicativo.

**Mapeamento interno (invisível ao utilizador):**
- "Buscar dados" → `select`
- "Actualizar dados" → `update`
- "Criar registo" → `insert`
- "Criar ou actualizar" → `upsert`
- "Remover registo" → `delete`
- "Executar função" → `rpc`

### Passo 2: Substituir Input "Tabela" por Select com nomes amigáveis

**ACTUAL (técnico):**
```
Tabela
[Ex: leads, dev_properties]  ← o utilizador precisa saber nomes de tabelas SQL
```

**NOVO (assistido):**
```
Onde?

[🔍 Pesquisar...                              ▼]
┌──────────────────────────────────────────────┐
│ 👤 Leads / Contactos                         │
│ 🏠 Imóveis                                   │
│ 👥 Proprietários                              │
│ 📋 Processos                                  │
│ ✅ Tarefas de Processo                        │
│ 💼 Negócios / Oportunidades                  │
│ 🧑‍💼 Consultores / Utilizadores               │
│ 📄 Documentos                                 │
│ 📧 Templates de Email                         │
│ 🔔 Notificações                               │
└──────────────────────────────────────────────┘
```

**Mapeamento (constante no código):**

```typescript
const TABLE_OPTIONS = [
  { value: "leads",            label: "Leads / Contactos",          icon: "Users",        description: "Contactos e potenciais clientes" },
  { value: "dev_properties",   label: "Imóveis",                    icon: "Home",         description: "Propriedades no sistema" },
  { value: "owners",           label: "Proprietários",              icon: "UserCheck",    description: "Donos de imóveis" },
  { value: "proc_instances",   label: "Processos",                  icon: "ClipboardList",description: "Instâncias de processos activos" },
  { value: "proc_tasks",       label: "Tarefas de Processo",        icon: "CheckSquare",  description: "Tarefas individuais de processos" },
  { value: "negocios",         label: "Negócios / Oportunidades",   icon: "Briefcase",    description: "Negócios de compra/venda/arrendamento" },
  { value: "dev_users",        label: "Consultores / Utilizadores", icon: "UserCog",      description: "Equipa e consultores" },
  { value: "doc_registry",     label: "Documentos",                 icon: "FileText",     description: "Documentos carregados no sistema" },
  { value: "tpl_email_library",label: "Templates de Email",         icon: "Mail",         description: "Templates de email guardados" },
  { value: "notifications",    label: "Notificações",               icon: "Bell",         description: "Notificações do sistema" },
  { value: "log_emails",       label: "Histórico de Emails",        icon: "MailCheck",    description: "Emails enviados pelo sistema" },
] as const
```

Usar Combobox pesquisável (padrão `Command` do shadcn que já existe no projecto). Cada opção mostra ícone + label + descrição.

**Opção avançada:** Para utilizadores que saibam o nome da tabela, adicionar no final: "Outra tabela..." que abre input de texto livre. Mas escondido por defeito.

### Passo 3: Substituir "Colunas" por "Que informação queres?"

**ACTUAL:**
```
Colunas
[*]
Use * para todas ou separe por vírgula
```

**NOVO:**
```
Que informação queres?

(•) Toda a informação disponível
( ) Escolher campos específicos

[Se "Escolher campos":]
  ☑ Nome
  ☑ Email
  ☑ Telefone
  ☐ Estado
  ☐ Temperatura
  ☐ Origem
  ...
```

O multi-select de campos deve ser **dinâmico** — quando o utilizador seleciona a tabela ("Leads"), os campos disponíveis carregam automaticamente.

**Para carregar campos dinamicamente:**

```typescript
// Nova API route: GET /api/automacao/schema/[table]
// Retorna colunas da tabela com labels amigáveis

const COLUMN_LABELS: Record<string, Record<string, string>> = {
  leads: {
    id: "ID",
    nome: "Nome",
    email: "Email",
    telefone: "Telefone",
    telemovel: "Telemóvel",
    origem: "Origem",
    estado: "Estado",
    temperatura: "Temperatura",
    observacoes: "Observações",
    created_at: "Data de criação",
  },
  dev_properties: {
    id: "ID",
    title: "Título",
    external_ref: "Referência",
    listing_price: "Preço",
    city: "Cidade",
    zone: "Zona",
    status: "Estado",
    property_type: "Tipo",
    business_type: "Tipo de negócio",
    consultant_id: "Consultor",
  },
  owners: {
    id: "ID",
    name: "Nome",
    email: "Email",
    phone: "Telefone",
    nif: "NIF",
    person_type: "Tipo de pessoa",
    address: "Morada",
  },
  // ... mais tabelas
}
```

**OU (mais simples):** Manter `*` como default e não mostrar seletor de colunas — a maioria dos utilizadores quer "toda a informação". Adicionar "Campos específicos" como opção avançada colapsada.

### Passo 4: Refactorar Filtros para linguagem natural

**ACTUAL:**
```
Filtros                              + Filtro
[coluna]  [= ▼]  [{{var}}]  { } 🗑️

Dropdown de operadores: =, ≠, >, <, ≥, ≤, contém, é nulo, em
```

**NOVO:**
```
Condições                                   + Condição

Quando  [Email ▼]  [é igual a ▼]  [Lead > Email]  🗑️
E       [Estado ▼] [não está vazio ▼]              🗑️
```

**Mudanças:**

1. **"Filtros" → "Condições"** (linguagem mais natural)
2. **"coluna" → Select com labels amigáveis** (mesmo mapeamento de COLUMN_LABELS)
3. **Operadores com labels PT-PT completos:**

```typescript
const FILTER_OPERATORS = [
  { value: "eq",   label: "é igual a" },
  { value: "neq",  label: "é diferente de" },
  { value: "gt",   label: "é maior que" },
  { value: "lt",   label: "é menor que" },
  { value: "gte",  label: "é maior ou igual a" },
  { value: "lte",  label: "é menor ou igual a" },
  { value: "like", label: "contém" },
  { value: "is",   label: "está vazio" },
  { value: "not_is", label: "não está vazio" },
  { value: "in",   label: "é um de" },
] as const
```

4. **Integrar Variable Picker directamente no campo de valor** — em vez do botão `{ }` separado, o campo de valor deve ter o botão de variável inline

5. **"E" / "Ou" entre condições** — mostrar toggle entre os filtros

### Passo 5: Substituir "Resultado único (.single())" e "Limite"

**ACTUAL:**
```
☐ Resultado único (.single())
Limite: [Sem limite]
```

**NOVO:**
```
Quantos resultados?
(•) Apenas o primeiro
( ) Todos (até [100] resultados)
```

**"Apenas o primeiro"** = `.single()` internamente
**"Todos"** = sem `.single()`, com `limit` configurável

### Passo 6: Substituir "Guardar resultado em"

**ACTUAL:**
```
Guardar resultado em
[Ex: query_result]
Nome da variável onde o resultado ficará disponível
```

**NOVO:**
```
Como queres chamar este resultado?
[Dados do lead]
ℹ️ Usa este nome nos passos seguintes para aceder à informação
```

O campo deve ter placeholder amigável: "Ex: Dados do lead, Informação do imóvel". Internamente converte para snake_case: "Dados do lead" → `dados_do_lead`.

### Passo 7: Modo "Inserir" / "Actualizar" — Campos

**ACTUAL (modo Inserir):**
```
Dados                               + Campo
[coluna]  =  [{{lead_nome}}]  { } 🗑️
[coluna]  =  [valor ou {{var}}]  { } 🗑️
```

**NOVO:**
```
Que dados gravar?                    + Campo

[Nome ▼]        →  [Lead > Nome]         🗑️
[Email ▼]       →  [Lead > Email]        🗑️
[Telefone ▼]    →  [texto livre ou variável] 🗑️
```

**Mudanças:**
- "coluna" → Select com nomes amigáveis (carregados da tabela seleccionada)
- `=` → `→` (seta, mais intuitivo)
- Variable picker integrado no campo de valor (não botão separado)

### Passo 8: Modo "Função" — Simplificar

**ACTUAL:**
```
Nome da Função
[Ex: get_lead_stats]
```

**NOVO:**
```
⚡ Executar Função

Escolher função:
[🔍 Pesquisar...]
┌────────────────────────────────────────┐
│ 📊 get_lead_stats                      │
│    Estatísticas de leads               │
│ 📊 auto_claim_steps                    │
│    Reclamar passos de automação        │
│ 📊 auto_reset_stuck_steps              │
│    Resetar passos travados             │
└────────────────────────────────────────┘
Ou digitar nome: [________________]
```

Listar funções disponíveis com labels amigáveis quando possível. Manter fallback para texto livre.

---

## R2. Refactoring do Condition Node

**Ficheiro:** `components/automations/nodes/condition-node.tsx`

O condition node já usa alguns labels PT-PT, mas pode melhorar:

### Actual vs Novo

**Campo de variável:** Em vez de input texto livre para o campo, usar Combobox com as variáveis disponíveis (do `tpl_variables` + variáveis de webhook).

**Apresentação da condição no node (preview):** Em vez de mostrar dados técnicos, mostrar frase natural:

```
ACTUAL no canvas:     "rules: 1, logic: and"
NOVO no canvas:       "Quando Temperatura do Lead é igual a Quente"
```

O preview do node deve renderizar a primeira regra como frase legível:

```typescript
function describeCondition(rules: ConditionRule[], logic: "and" | "or"): string {
  if (rules.length === 0) return "Sem condições definidas"
  const first = rules[0]
  const fieldLabel = variableLabels[first.field] || first.field
  const opLabel = CONDITION_OPERATOR_LABELS[first.operator]
  const suffix = rules.length > 1 ? ` (+ ${rules.length - 1} condições)` : ""

  if (VALUE_LESS_OPERATORS.has(first.operator)) {
    return `${fieldLabel} ${opLabel}${suffix}`
  }
  return `${fieldLabel} ${opLabel} "${first.value}"${suffix}`
}
```

---

## R3. Refactoring do Trigger Status Node

**Ficheiro:** `components/automations/nodes/trigger-status-node.tsx`

### Actual vs Novo

**ACTUAL:** Select de entidade sem contexto.

**NOVO:**
```
Quando é que este fluxo deve iniciar?

Quando um(a)  [Lead / Contacto ▼]

muda o campo  [Estado ▼]           ← Select dinâmico com campos da entidade

para          [Aprovado ▼]         ← Select dinâmico com valores possíveis
              [Fechado]
              [Em análise]
```

**Mapeamento de entidades:**

```typescript
const ENTITY_OPTIONS = [
  { value: "lead",    label: "Lead / Contacto",    table: "leads",          statusField: "estado" },
  { value: "process", label: "Processo",            table: "proc_instances", statusField: "current_status" },
  { value: "deal",    label: "Negócio",             table: "negocios",       statusField: "estado" },
  { value: "property",label: "Imóvel",              table: "dev_properties", statusField: "status" },
]
```

**Valores possíveis por campo (hardcoded ou query DISTINCT):**

```typescript
const STATUS_VALUES: Record<string, string[]> = {
  "leads.estado": ["Novo", "Em contacto", "Qualificado", "Proposta", "Fechado", "Perdido"],
  "proc_instances.current_status": ["draft", "pending_approval", "approved", "in_progress", "completed", "cancelled"],
  "negocios.estado": ["Novo", "Em negociação", "Proposta enviada", "Fechado", "Perdido"],
  "dev_properties.status": ["pending_approval", "active", "reserved", "sold", "cancelled"],
}
```

---

## R4. Nova API Route: Schema das Tabelas

**Ficheiro a criar:** `app/api/automacao/schema/[table]/route.ts`

Retorna colunas de uma tabela com labels amigáveis para popular os Selects dinâmicos.

```typescript
// GET /api/automacao/schema/leads
// Response: { columns: [{ name: "nome", label: "Nome", type: "text" }, ...] }

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params
  const supabase = createAdminSupabaseClient()

  // Buscar colunas via information_schema
  const { data } = await supabase.rpc("auto_get_table_columns", { p_table: table })
  // OU query directa:
  // SELECT column_name, data_type FROM information_schema.columns
  // WHERE table_schema = 'public' AND table_name = $1

  // Mapear com labels amigáveis
  const labeled = (data || []).map((col: { column_name: string; data_type: string }) => ({
    name: col.column_name,
    label: COLUMN_LABELS[table]?.[col.column_name] || col.column_name,
    type: col.data_type,
  }))

  return NextResponse.json({ columns: labeled })
}
```

**Função SQL auxiliar:**

```sql
CREATE OR REPLACE FUNCTION auto_get_table_columns(p_table TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT column_name::TEXT, data_type::TEXT
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table
  ORDER BY ordinal_position;
$$;
```

---

## R5. Melhorar Preview dos Nodes no Canvas

Todos os nodes devem mostrar um **resumo legível** no canvas (não dados técnicos):

| Node | Actual | Novo |
|------|--------|------|
| Supabase Query | "select · leads" | "🔍 Buscar dados de Leads" |
| Supabase Query (insert) | "insert · leads" | "➕ Criar registo em Leads" |
| Supabase Query (rpc) | "rpc · get_lead_stats" | "⚡ Executar get_lead_stats" |
| Condition | "1 regra(s)" | "Quando Temperatura é Quente" |
| Delay | "3 days" | "Esperar 3 dias" |
| WhatsApp | "3 mensagens" | "💬 3 mensagens · Template: Boas-vindas" |
| Email | "template: Confirmação" | "✉️ Email: Confirmação de Angariação" |

---

## ⚙️ Implementação da API de Schema

Antes de implementar o refactoring no frontend, criar a função SQL e a API route:

### Migration SQL

```sql
CREATE OR REPLACE FUNCTION auto_get_table_columns(p_table TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT c.column_name::TEXT, c.data_type::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = p_table
  ORDER BY c.ordinal_position;
$$;
```

---

## 📋 Ordem de Implementação

1. **Criar migration SQL** (`auto_get_table_columns`)
2. **Criar API route** `/api/automacao/schema/[table]`
3. **Criar constantes** `TABLE_OPTIONS`, `COLUMN_LABELS`, `FILTER_OPERATORS` em `lib/constants-automations.ts`
4. **Refactorar `supabase-query-node.tsx`** — a peça principal
5. **Refactorar `condition-node.tsx`** — preview legível
6. **Refactorar `trigger-status-node.tsx`** — selects assistidos
7. **Melhorar previews** de todos os nodes no canvas

---

## 📝 Notas Importantes

1. **NÃO quebrar a estrutura de dados existente** — o `SupabaseQueryNodeData` em `automation-flow.ts` não muda. Apenas a UI muda. Os campos internos continuam `table`, `columns`, `filters`, etc. A UI traduz de/para labels amigáveis.

2. **Fallback para modo avançado** — No final da Sheet, adicionar link colapsável "Modo avançado" que mostra os inputs de texto livre originais. Para utilizadores técnicos que precisem.

3. **As constantes TABLE_OPTIONS e COLUMN_LABELS** são o coração desta refactoring. Se estiverem bem definidas, tudo o resto é UI.

4. **Testar com dados reais** — Depois de refactorar, criar um fluxo que faz "Buscar dados de Leads onde Estado é igual a Novo" e confirmar que o flow_definition guardado tem `{table: "leads", filters: [{column: "estado", operator: "eq", value: "Novo"}]}`.
