# SPEC: Fecho de Negocio (Deal Closing Form)

## 1. Visao Geral

Formulario multi-step para formalizar o fecho de um negocio imobiliario. O formulario adapta-se a **4 cenarios** de partilha e ao **tipo de negocio** (Venda / Arrendamento / Trespasse).

### Cenarios

| Cenario | Descricao | Angariacao | Comprador |
|---------|-----------|------------|-----------|
| **Pleno** | Angariacao e comprador sao teus | Tua | Teu |
| **Comprador Externo** | Angariacao tua, comprador de outra agencia | Tua | Externo |
| **Pleno de Agencia** | Angariacao de colega interno, comprador teu | Colega interno | Teu |
| **Angariacao Externa** | Angariacao de outra agencia, comprador teu | Externa | Teu |

### Tipos de Negocio

| Tipo | Descricao | Contrato | Escritura |
|------|-----------|----------|-----------|
| **Venda** | Compra e venda de imovel | CPCV + Escritura Publica | Sim |
| **Arrendamento** | Contrato de arrendamento | Contrato de Arrendamento | Nao |
| **Trespasse** | Transferencia de estabelecimento comercial (negocio + contrato de arrendamento + equipamentos + clientela) | Contrato de Trespasse (documento escrito, sem escritura) | Nao |

### Pontos de Entrada

1. **Pagina de detalhe do imovel** > tab "Negocio" > botao "Fecho de Negocio"
2. **Quick actions no topbar/dashboard** > "Fecho de Negocio"
3. **Pagina de detalhe do negocio (lead)** > botao "Fecho de Negocio"

O formulario abre como **Dialog** (mesmo padrao do `AcquisitionDialog`), max-width 800px, 90vh.

---

## 2. Estrutura do Formulario (5 Steps)

### Step 1: PARTILHA

**Sempre presente. Campos mudam conforme o cenario.**

#### Campos comuns a todos os cenarios
- **Upload da proposta** (file upload, required) — ficheiro PDF da proposta assinada
- **Cenario** (toggle group: Pleno / Comprador Externo / Pleno de Agencia / Angariacao Externa, required)
- **Observacoes sobre a Partilha** (textarea, optional)

#### Campos por cenario

| Campo | Pleno | Comprador Externo | Pleno de Agencia | Angariacao Externa |
|-------|-------|-------------------|------------------|--------------------|
| Banner info | "Angariacao e comprador teus" | "Angariacao tua e comprador externo" | "Angariacao interna e comprador teu" | "Angariacao externa e comprador teu" |
| Qual o teu imovel? (select property) | Sim | Sim | - | - |
| Nome do Colega com a Angariacao (select consultant) | - | - | Sim | - |
| Imovel do colega (select property filtrada por colega) | - | - | Sim | - |
| Link do imovel (text) | - | - | - | Sim |
| Nome da Agencia (text, required) | - | Sim | - | Sim |
| Nome do Consultor (text, required) | - | Sim | - | Sim |
| Contacto do Consultor (text, required) | - | Sim | - | Sim |
| Email do Consultor (text, required) | - | Sim | - | Sim |
| Partilha % (default 50%, editable) | - | Sim | Sim | Sim |

**Nota:** Partilha % default = 50. Quick pick "50%" predefine; campo "outro" permite valor customizado. Hint: "Indica a percentagem atribuida a tua parte (ex: numa partilha atipica em que ficas so com 40%, insere 40. Num cenario comum de 50/50 insere 50)"

---

### Step 2: IDENTIFICACAO DOS CLIENTES COMPRADORES OU ARRENDATARIOS

**Condicional conforme cenario.**

O titulo deste step adapta-se ao tipo de negocio:
- Venda: "Identificacao dos Clientes Compradores"
- Arrendamento: "Identificacao dos Clientes Arrendatarios"
- Trespasse: "Identificacao dos Clientes Trespassarios"

#### Cenarios com formulario completo: Pleno, Pleno de Agencia, Angariacao Externa

- **Pessoa** (toggle: Singular / Coletiva, required)
- **Lista de clientes** (dinamica, botao "+ Adicionar Cliente", minimo 1)
  - Por cada cliente:
    - Nome (text, required)
    - Email (text, required)
    - Contacto (text, required)
- **Observacoes sobre o/s cliente/s** (textarea, optional)

**Nota:** Nao usar contadores fixos (1/2/2+). Usar lista dinamica com botao de adicionar/remover, identico ao padrao do `StepOwners` na angariacao.

#### Cenario Comprador Externo

- **Banner warning** (vermelho): "Nao necessitas preencher pois os clientes nao sao teus"
- Todos os campos de cliente ficam **escondidos**
- Apenas **Observacoes sobre o/s cliente/s** (textarea, optional) permanece visivel

---

### Step 3: CONDICOES DO NEGOCIO

**Sempre presente. Adapta-se ao cenario e ao tipo de negocio.**

#### Campos comuns a todos os cenarios e tipos

- **Tipo de Negocio** (toggle: Venda / Arrendamento / Trespasse, required)
- **Valor acordado** (number input com sufixo euro, required) — label adapta-se (ver tabela abaixo)
- **Comissao final** (quick picks: 4% / 5% / 6% + campo "Outra" com sufixo %, required)
  - Hint: "Se 5% coloca 5. Se 150% coloca 150. Se valor fixo coloca o valor (ex. 2000)"
- **Observacoes sobre as condicoes de negocio** (textarea, optional)

#### Campos condicionais por tipo de negocio

##### VENDA

| Campo | Label | Descricao |
|-------|-------|-----------|
| Pagamento no CPCV | "Pagamento no CPCV" | Quick picks: 0% / 50% / 100% + custom %. Hint: "Indica a percentagem paga no cpcv e faremos o calculo automatico da percentagem da escritura" |
| Deposito | "Valor do sinal no CPCV (euro)" | Valor numerico do sinal entregue no CPCV |
| Data contrato | "Data prevista para assinatura do CPCV" | Date picker |
| Prazo | "Prazo maximo para a Escritura (Dias)" | Numero de dias entre CPCV e escritura |

##### ARRENDAMENTO

| Campo | Label | Descricao |
|-------|-------|-----------|
| Pagamento no CPCV | **Escondido** | Nao se aplica — nao ha CPCV nem escritura |
| Deposito | "Caucao / Rendas adiantadas (euro)" | Valor da caucao ou numero de rendas adiantadas |
| Data contrato | "Data prevista para assinatura do Contrato de Arrendamento" | Date picker |
| Prazo | "Duracao do Arrendamento (Anos)" | Duracao do contrato |

##### TRESPASSE

| Campo | Label | Descricao |
|-------|-------|-----------|
| Pagamento no CPCV | **Escondido** | Nao se aplica — trespasse nao tem CPCV/escritura |
| Deposito | "Sinal / Pagamento inicial (euro)" | Valor entregue como sinal do trespasse |
| Data contrato | "Data prevista para assinatura do Contrato de Trespasse" | Date picker |
| Prazo | "Prazo para contrato definitivo (Dias)" | Dias entre promessa e contrato definitivo |

#### Labels adaptativas — resumo

| Campo | Venda | Arrendamento | Trespasse |
|-------|-------|--------------|-----------|
| Valor acordado | "Preco de venda (euro)" | "Valor da renda mensal (euro)" | "Valor do trespasse (euro)" |
| Deposito | "Valor do sinal no CPCV (euro)" | "Caucao / Rendas adiantadas (euro)" | "Sinal / Pagamento inicial (euro)" |
| Data | "Data prevista assinatura CPCV" | "Data prevista assinatura Contrato Arrendamento" | "Data prevista assinatura Contrato Trespasse" |
| Prazo | "Prazo maximo Escritura (Dias)" | "Duracao Arrendamento (Anos)" | "Prazo contrato definitivo (Dias)" |
| Pagamento CPCV | Visivel | Escondido | Escondido |

#### Campos adicionais APENAS para Angariacao Externa

Quando cenario = "Angariacao Externa", o imovel nao esta no sistema, por isso e necessario recolher os dados manualmente. Estes campos aparecem **antes** dos campos financeiros:

- **ID do Imovel** (text, required) — referencia externa
- **Tipo de Imovel** (toggle: Apartamento / Moradia / Quinta / Predio / Comercio / Garagem / Terreno Urbano / Terreno Rustico + campo "outro", required)
- **Tipologia** (toggle: T0 / T1 / T2 / T3 / T4 / T5 / T6 / T7 + campo "outra", required)
- **Zona** (text, optional)
- **Identificacao extra** (textarea, optional, placeholder: "Opcional, por exemplo: empreendimento X")
- **Ano de Construcao** (text, required)

---

### Step 4: CONDICOES EXTRA

**Sempre presente. Alguns campos sao condicionais conforme o tipo de negocio.**

#### Campos comuns (todos os tipos)

- **O imovel vai ser vendido ou arrendado com mobilia?** (toggle: Sim / Nao, required)
  - Label adapta-se: Venda → "vendido com mobilia", Arrendamento → "arrendado com mobilia", Trespasse → "trespassado com mobilia/equipamentos"
- **O contrato necessita de ser bilingue (PT/ENG)?** (toggle: Sim / Nao, required)
- **Informacao Adicional Relevante** (textarea, optional, placeholder: "Por exemplo: Existencia de Procuracoes, etc..")

#### Campos condicionais por tipo

| Campo | Venda | Arrendamento | Trespasse | Notas |
|-------|-------|--------------|-----------|-------|
| **Tem Fiador?** | Escondido | Sim | Sim | Fiador e relevante apenas para arrendamento e trespasse (pagamentos recorrentes) |
| **Ha Financiamento?** | Sim | Escondido | Escondido | Credito habitacao aplica-se apenas a venda |
| **Ha Condicao Resolutiva de Financiamento?** | Sim (se financiamento = Sim) | Escondido | Escondido | So faz sentido quando ha financiamento bancario |
| **Vai Haver Reconhecimento de Assinaturas?** | Sim | Escondido | Escondido | Reconhecimento notarial aplica-se a CPCV/escritura |
| **Regime** | Sim (HPP / Secundaria / NA) | Sim (HPP / Secundaria / NA) | Escondido (default NA) | Trespasse e comercial, regime nao se aplica |

#### Logica de visibilidade detalhada

```
Se tipo = 'venda':
  - Mostrar: Mobilia, Bilingue, Financiamento, Reconhecimento Assinaturas, Regime
  - Se Financiamento = Sim → Mostrar Condicao Resolutiva
  - Esconder: Fiador

Se tipo = 'arrendamento':
  - Mostrar: Fiador, Mobilia, Bilingue, Regime
  - Esconder: Financiamento, Condicao Resolutiva, Reconhecimento Assinaturas

Se tipo = 'trespasse':
  - Mostrar: Fiador, Mobilia (label "equipamentos"), Bilingue
  - Esconder: Financiamento, Condicao Resolutiva, Reconhecimento Assinaturas, Regime
```

---

### Step 5: REFERENCIACAO

**Condicional conforme cenario. Independente do tipo de negocio.**

#### Cenarios com formulario completo: Pleno, Pleno de Agencia, Angariacao Externa

- **Existe Referencia?** (toggle: Sim / Nao, required)
- Se Sim:
  - **Quanto?** (number input com sufixo %, required, placeholder "exemplo: 25")
  - **Referenciacao** (toggle: Interna / Externa, required)
  - Se Externa:
    - **Informacao do referenciado** (textarea, required, placeholder: "Nome\ncontacto\nemail\nAgencia")

#### Cenario Comprador Externo

- **Banner info** (verde): "O comprador e externo, logo nao ha referencia no negocio, so na Angariacao"
- Sem campos a preencher

---

## 3. UX / Interacao

### Navegacao entre steps

- **Tab icons** no topo (5 icons, mesmo padrao do screenshot original)
- Labels dos tabs: Partilha | Clientes | Condicoes | Extra | Referenciacao
- Navegacao livre entre tabs (nao bloquear avanco)
- Botao "Seguinte" / "Anterior" no footer
- Botao "Submeter" no ultimo step

### Toggle Groups (Sim/Nao, cenarios, etc.)

Usar o padrao de **pill buttons** (rounded, border, fill quando activo) — identico aos screenshots. Componente sugerido: toggle group com variant outline, estilo similar ao usado nos filtros.

### Quick Picks + Campo Custom

Para campos como Comissao (4%/5%/6%) e Pagamento CPCV (0%/50%/100%):
- Quick pick buttons pre-preenchem o campo numerico
- O campo numerico e sempre editavel (override manual)
- Se o utilizador escreve um valor diferente, nenhum quick pick fica activo

### Banners de contexto

- **Verde (info)**: "Angariacao e comprador teus", "O comprador e externo, logo nao ha referencia..."
- **Vermelho (warning)**: "Nao necessitas preencher pois os clientes nao sao teus"

Usar `bg-emerald-50 text-emerald-700 border-emerald-200` e `bg-red-50 text-red-700 border-red-200`.

### Reactividade ao mudar tipo de negocio

Quando o utilizador muda o tipo de negocio no Step 3:
1. Labels dos campos financeiros actualizam-se imediatamente
2. Campos irrelevantes escondem-se (ex: CPCV % para arrendamento)
3. Step 4 reorganiza-se (mostra/esconde campos condicionais)
4. Valores de campos escondidos **nao sao limpos** — apenas ficam hidden (podem voltar se mudar de tipo)
5. Step 2 titulo actualiza-se ("Compradores" / "Arrendatarios" / "Trespassarios")

### Validacao

- Validar por step ao clicar "Seguinte" (highlight campos com erro)
- Validar tudo ao clicar "Submeter"
- Campos required marcados visualmente (label "Required" a direita ou asterisco)
- Mensagens de erro em PT-PT
- **Campos escondidos nao sao validados** (ex: se tipo = arrendamento, Pagamento CPCV nao e required)

### Draft / Auto-save

- Guardar rascunho automaticamente (mesmo padrao da angariacao)
- Permitir retomar mais tarde

---

## 4. Base de Dados

### Tabelas existentes (ja criadas)

#### `temp_deals`

Tabela principal do negocio. Campos ja existentes que mapeiam directamente:

| Campo do Form | Coluna DB | Notas |
|---------------|-----------|-------|
| Cenario | `deal_type` | Valores: 'pleno', 'comprador_externo', 'pleno_agencia', 'angariacao_externa' |
| Imovel | `property_id` | FK dev_properties. NULL para angariacao_externa |
| Consultor | `consultant_id` | FK dev_users (o utilizador que submete) |
| Valor acordado | `deal_value` | numeric |
| Data proposta | `deal_date` | date |
| Comissao % | `commission_pct` | numeric |
| Comissao total | `commission_total` | Calculado: deal_value * commission_pct / 100 |
| Partilha? | `has_share` | boolean |
| Tipo partilha | `share_type` | 'external_buyer', 'internal_agency', 'external_agency' |
| Partilha % | `share_pct` | numeric (a parte do agente) |
| Agencia parceira | `partner_agency_name` | text |
| Contacto parceiro | `partner_contact` | text |
| Pagamento CPCV % | `cpcv_pct` | numeric (NULL para arrendamento/trespasse) |
| Pagamento Escritura % | `escritura_pct` | numeric (100 - cpcv_pct, NULL para arrendamento/trespasse) |
| Estado | `status` | 'draft', 'submitted', 'approved', 'completed' |
| Notas | `notes` | text |
| Proc instance | `proc_instance_id` | FK proc_instances (processo de fecho associado) |

#### `temp_deal_compliance`

Dados de compliance/KYC dos compradores e vendedores. Ja tem campos para buyer e seller.

#### `temp_deal_payments`

Pagamentos associados ao negocio (CPCV, escritura, etc.).

### Novas colunas necessarias em `temp_deals`

```sql
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS proposal_file_url text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS proposal_file_name text;

-- Dados do consultor externo (Comprador Externo e Angariacao Externa)
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_consultant_name text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_consultant_phone text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_consultant_email text;

-- Pleno de Agencia
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS internal_colleague_id uuid REFERENCES dev_users(id);

-- Angariacao Externa - dados do imovel externo
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_property_link text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_property_id text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_property_type text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_property_typology text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_property_zone text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_property_extra text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS external_property_construction_year text;

-- Tipo de negocio (venda, arrendamento, trespasse)
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS business_type text;

-- Condicoes
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS deposit_value text; -- Sinal/caucao/rendas/pagamento inicial
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS contract_signing_date date; -- Data assinatura (CPCV, contrato, trespasse)
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS max_deadline text; -- Prazo (escritura dias / arrendamento anos / trespasse dias)

-- Condicoes Extra
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS has_guarantor boolean DEFAULT false; -- Arrendamento e Trespasse
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS has_furniture boolean DEFAULT false; -- Todos
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS is_bilingual boolean DEFAULT false; -- Todos
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS has_financing boolean DEFAULT false; -- Apenas Venda
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS has_financing_condition boolean DEFAULT false; -- Apenas Venda com financiamento
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS has_signature_recognition boolean DEFAULT false; -- Apenas Venda
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS housing_regime text; -- 'hpp', 'secundaria', 'na' — Venda e Arrendamento
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS extra_info text;

-- Referenciacao
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS has_referral boolean DEFAULT false;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS referral_pct numeric;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS referral_type text; -- 'interna', 'externa'
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS referral_info text; -- Dados do referenciado (externa)

-- Observacoes por step
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS share_notes text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS clients_notes text;
ALTER TABLE temp_deals ADD COLUMN IF NOT EXISTS conditions_notes text;
```

### Nova tabela: `temp_deal_clients`

Clientes compradores/arrendatarios/trespassarios associados ao negocio.

```sql
CREATE TABLE IF NOT EXISTS temp_deal_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES temp_deals(id) ON DELETE CASCADE,
  person_type text NOT NULL DEFAULT 'singular', -- 'singular', 'coletiva'
  name text NOT NULL,
  email text,
  phone text,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

---

## 5. API Routes

### `POST /api/deals`

Criar novo deal (rascunho). Body: dados do step 1 (minimo cenario).

### `PUT /api/deals/[id]`

Actualizar deal existente (qualquer step). Body: campos parciais.

### `GET /api/deals/[id]`

Obter deal completo com clientes.

### `POST /api/deals/[id]/submit`

Submeter deal para aprovacao. Valida todos os campos required conforme cenario + tipo de negocio.
Cria `proc_instances` com template de fecho apropriado (conforme cenario).

### `POST /api/deals/[id]/proposal-upload`

Upload do ficheiro da proposta ao R2. Path: `deals/{deal_id}/proposta-{timestamp}.pdf`

### `GET /api/deals/drafts`

Listar rascunhos do utilizador actual.

### `DELETE /api/deals/[id]`

Eliminar rascunho.

---

## 6. Componentes

### Estrutura de ficheiros

```
components/deals/
  deal-dialog.tsx            -- Dialog wrapper (como AcquisitionDialog)
  deal-form.tsx              -- Form principal com tabs/steps
  step-1-partilha.tsx        -- Step 1
  step-2-clientes.tsx        -- Step 2
  step-3-condicoes.tsx       -- Step 3
  step-4-extra.tsx           -- Step 4
  step-5-referenciacao.tsx   -- Step 5
  deal-field.tsx             -- Campo reutilizavel (label + required badge)
  deal-toggle-group.tsx      -- Toggle group estilizado (pills)
  deal-quick-pick.tsx        -- Quick pick + input combo

lib/validations/
  deal.ts                    -- Zod schema (condicional por cenario + tipo negocio)

types/
  deal.ts                    -- TypeScript types
```

### Componentes reutilizaveis

- **DealField**: Label + input com badge "Required" a direita. Reutilizar padrao `AcquisitionField`.
- **DealToggleGroup**: Grupo de botoes pill (Sim/Nao, cenarios, tipos). Componente thin wrapper sobre shadcn ToggleGroup.
- **DealQuickPick**: Quick pick buttons + input numerico. Ao clicar num quick pick, preenche o input. Ao editar o input, desmarca o quick pick.

---

## 7. Validacao (Zod Schema)

O schema deve ser condicional baseado no cenario E no tipo de negocio.

```typescript
// Pseudo-schema — validacao via .superRefine() para logica condicional
const dealSchema = z.object({
  // Step 1 — Partilha
  proposal_file: z.string().min(1),
  scenario: z.enum(['pleno', 'comprador_externo', 'pleno_agencia', 'angariacao_externa']),
  property_id: z.string().optional(),         // required se pleno ou comprador_externo
  internal_colleague_id: z.string().optional(), // required se pleno_agencia
  share_pct: z.number().optional(),            // required se nao e pleno
  external_consultant_name: z.string().optional(), // required se comprador_externo ou angariacao_externa
  // ... restantes campos condicionais

  // Step 2 — Clientes
  person_type: z.enum(['singular', 'coletiva']).optional(),
  clients: z.array(clientSchema).optional(), // required se cenario != comprador_externo

  // Step 3 — Condicoes
  business_type: z.enum(['venda', 'arrendamento', 'trespasse']),
  deal_value: z.number().positive(),
  commission_pct: z.number().positive(),
  cpcv_pct: z.number().optional(),             // required APENAS se venda
  deposit_value: z.string().min(1),
  contract_signing_date: z.string().min(1),
  max_deadline: z.string().min(1),
  // Angariacao externa
  external_property_id: z.string().optional(),  // required se angariacao_externa
  external_property_type: z.string().optional(), // required se angariacao_externa
  // ...

  // Step 4 — Extra (condicionais por tipo negocio)
  has_guarantor: z.boolean().optional(),        // required se arrendamento ou trespasse
  has_furniture: z.boolean(),                   // sempre
  is_bilingual: z.boolean(),                    // sempre
  has_financing: z.boolean().optional(),        // required se venda
  has_financing_condition: z.boolean().optional(), // required se venda E financing = true
  has_signature_recognition: z.boolean().optional(), // required se venda
  housing_regime: z.string().optional(),         // required se venda ou arrendamento

  // Step 5 — Referenciacao
  has_referral: z.boolean().optional(),         // required se cenario != comprador_externo
  referral_pct: z.number().optional(),          // required se has_referral = true
  referral_type: z.enum(['interna', 'externa']).optional(),
  referral_info: z.string().optional(),         // required se referral_type = externa
}).superRefine((data, ctx) => {
  // Validacao condicional por cenario
  if (data.scenario === 'pleno' || data.scenario === 'comprador_externo') {
    if (!data.property_id) ctx.addIssue({ path: ['property_id'], ... })
  }
  if (data.scenario !== 'pleno' && !data.share_pct) {
    ctx.addIssue({ path: ['share_pct'], ... })
  }
  // ...

  // Validacao condicional por tipo negocio
  if (data.business_type === 'venda') {
    if (data.cpcv_pct === undefined) ctx.addIssue({ path: ['cpcv_pct'], ... })
    if (data.has_financing === undefined) ctx.addIssue({ path: ['has_financing'], ... })
    // ...
  }
  if (data.business_type === 'arrendamento' || data.business_type === 'trespasse') {
    if (data.has_guarantor === undefined) ctx.addIssue({ path: ['has_guarantor'], ... })
  }
  // ...
})
```

---

## 8. Fluxo Completo

```
1. Utilizador abre dialog "Fecho de Negocio"
2. Selecciona cenario no Step 1
3. Form adapta-se (campos dinamicos por cenario)
4. No Step 3, selecciona tipo de negocio (Venda/Arrendamento/Trespasse)
5. Steps 3 e 4 adaptam-se (labels, campos visiveis)
6. Preenche steps 1-5 (pode saltar entre tabs)
7. Auto-save como rascunho a cada mudanca de tab
8. Clica "Submeter"
9. Validacao completa (todos os steps, condicional por cenario + tipo)
10. Se valido:
    a. Upload da proposta ao R2 (se ainda nao feito)
    b. Cria/actualiza registo em temp_deals + temp_deal_clients
    c. Cria proc_instances com template de fecho apropriado
    d. Redireciona para pagina do processo ou mostra confirmacao
11. Se invalido: mostra erros, foca no primeiro step com erro
```

---

## 9. Processo de Fecho Associado

Cada cenario deve ter um template de processo (`tpl_processes`) diferente, pois as tarefas documentais variam. Na submissao, o sistema selecciona o template correcto automaticamente (sem intervencao do aprovador, ao contrario da angariacao).

| Cenario | Template sugerido |
|---------|-------------------|
| Pleno | "Fecho Pleno" |
| Comprador Externo | "Fecho Comprador Externo" |
| Pleno de Agencia | "Fecho Pleno de Agencia" |
| Angariacao Externa | "Fecho Angariacao Externa" |

**Nota:** O tipo de negocio (venda/arrendamento/trespasse) pode influenciar as tarefas dentro do template (ex: venda tem tarefa de escritura, arrendamento nao). Isto pode ser tratado com tarefas condicionais no template ou com templates separados por tipo. Decisao a tomar na implementacao dos templates.

---

## 10. Matriz de Visibilidade Completa

### Por Cenario (afecta Steps 1, 2, 5)

| | Pleno | Comp. Externo | Pleno Agencia | Ang. Externa |
|---|:---:|:---:|:---:|:---:|
| Teu imovel (select) | X | X | - | - |
| Colega + imovel colega | - | - | X | - |
| Link imovel + agencia externa | - | - | - | X |
| Agencia + consultor externo | - | X | - | X |
| Partilha % | - | X | X | X |
| Clientes (Step 2) | Full | Disabled | Full | Full |
| Dados imovel manual (Step 3) | - | - | - | X |
| Referenciacao (Step 5) | Full | Disabled | Full | Full |

### Por Tipo Negocio (afecta Steps 3, 4)

| | Venda | Arrendamento | Trespasse |
|---|:---:|:---:|:---:|
| Pagamento CPCV % | X | - | - |
| Fiador | - | X | X |
| Financiamento | X | - | - |
| Condicao Resolutiva | X* | - | - |
| Reconhecimento Assinaturas | X | - | - |
| Regime Habitacao | X | X | - |
| Mobilia/Equipamentos | X | X | X |
| Bilingue | X | X | X |

*Apenas visivel se Financiamento = Sim

---

## 11. Prioridade de Implementacao

1. **Migration DB** — novas colunas em temp_deals + tabela temp_deal_clients
2. **Zod schema + types** — lib/validations/deal.ts + types/deal.ts
3. **API routes** — CRUD + upload + submit
4. **Step components** — 5 steps com logica condicional
5. **Form principal** — deal-form.tsx com tabs
6. **Dialog** — deal-dialog.tsx
7. **Integracao** — botoes nos pontos de entrada (imovel, dashboard, negocio)
