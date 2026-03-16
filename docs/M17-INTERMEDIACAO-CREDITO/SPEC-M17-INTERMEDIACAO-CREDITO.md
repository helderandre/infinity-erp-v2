# SPEC-M17-INTERMEDIACAO-CREDITO — Intermediação de Crédito Habitação

**Versao:** 1.0
**Data:** 2026-03-15
**Estado:** Rascunho — aguardar aprovacao antes de implementar
**Modulo:** M17 — Intermediacao de Credito
**Stack:** Next.js 16, App Router, Supabase, shadcn/ui, Tailwind v4

---

## Indice

1. [Objectivo](#1-objectivo)
2. [Contexto Regulatório](#2-contexto-regulatório)
3. [Modelo de Dados](#3-modelo-de-dados)
4. [Integracoes com Modulos Existentes](#4-integracoes-com-modulos-existentes)
5. [API Routes](#5-api-routes)
6. [Types TypeScript](#6-types-typescript)
7. [Validacoes Zod](#7-validacoes-zod)
8. [Constantes e Labels PT-PT](#8-constantes-e-labels-pt-pt)
9. [Paginas e Componentes](#9-paginas-e-componentes)
10. [Simulador de Credito](#10-simulador-de-credito)
11. [Checklist Documental](#11-checklist-documental)
12. [Alertas e Prazos](#12-alertas-e-prazos)
13. [Dashboard do Intermediario](#13-dashboard-do-intermediario)
14. [Comissoes de Credito](#14-comissoes-de-credito)
15. [Funcionalidades IA](#15-funcionalidades-ia)
16. [Hooks](#16-hooks)
17. [Sidebar e Navegacao](#17-sidebar-e-navegacao)
18. [Checklist de Implementacao](#18-checklist-de-implementacao)
19. [Fora de Ambito (v1)](#19-fora-de-ambito-v1)

---

## 1. Objectivo

Criar um modulo completo de **Intermediacao de Credito Habitacao** que permita ao intermediario de credito da imobiliaria:

1. **Gerir pedidos de credito** — pipeline completo desde a recolha de dados financeiros do cliente ate a escritura
2. **Submeter a multiplos bancos** simultaneamente e comparar propostas
3. **Controlar documentacao** — checklist inteligente por banco com tracking de documentos em falta
4. **Simular credito** — calculadora interactiva para usar com clientes
5. **Monitorizar prazos** — alertas automaticos para aprovacoes a expirar, documentos em falta, datas de escritura
6. **Calcular comissoes** — tracking das comissoes pagas pelos bancos ao intermediario

O modulo integra-se profundamente com os modulos existentes: **Leads/Negocios** (M05), **Processos** (M06), **Calendario** (M15) e **Documentos** (M08).

---

## 2. Contexto Regulatorio (Portugal)

A intermediacao de credito em Portugal e regulada por:

- **DL 81-C/2017** — Regime juridico dos intermediarios de credito (transpoe Directiva 2014/17/UE sobre credito a consumidores para imoveis de habitacao)
- **Recomendacao Macroprudencial 1/2018 (BdP)** — Limites de LTV, DSTI e maturidade para novos creditos habitacao
- **Aviso 4/2017 (BdP)** — Deveres de informacao e conduta na concessao de credito
- **RGPD / Lei 58/2019** — Proteccao de dados pessoais e financeiros

### Requisitos legais relevantes para o ERP:

| Requisito | Diploma | Implicacao no ERP |
|-----------|---------|-------------------|
| Registo no Banco de Portugal | DL 81-C/2017, art. 8 | Campo de registo no perfil do intermediario |
| Dever de informacao pre-contratual | DL 81-C/2017, art. 16 | Geracao de FINE (Ficha de Informacao Normalizada Europeia) |
| Apresentar pelo menos 3 propostas | DL 81-C/2017, art. 18 | Minimo 3 `propostas_banco` por pedido (aviso se < 3) |
| Registar todas as propostas | DL 81-C/2017, art. 18 | Historico imutavel de propostas (soft delete apenas) |
| Avaliacao de solvabilidade | Rec. BdP 1/2018 | Calculo automatico de DSTI (taxa de esforco) |
| Limites LTV | Rec. BdP 1/2018 | HPP ≤ 90%, HPS ≤ 80%, Investimento ≤ 70% |
| Limites DSTI | Rec. BdP 1/2018 | ≤ 50% (excepcoes limitadas a 20% da carteira) |
| Limites maturidade | Rec. BdP 1/2018 | Convergencia gradual para 30 anos; idade + prazo ≤ 75 |
| Vinculacao ao banco | DL 81-C/2017, art. 4 | Registar se ha protocolo/vinculacao com cada banco |
| Consentimento RGPD | Lei 58/2019 | Checkbox obrigatorio + data/hora/IP de consentimento |
| Imposto de selo | CIST, verba 17.1.4 | 0,6% sobre o montante do credito; 4% sobre juros e comissoes |

### Medidas macroprudenciais BdP (Recomendacao 1/2018, revista em 2023):

```
LTV (Loan-to-Value):
  - HPP (habitacao propria permanente): max 90%
  - HPS (habitacao secundaria):          max 80%
  - Investimento:                         max 70%
  - Terrenos:                             max 50%

DSTI (Debt Service-to-Income / Taxa de esforco):
  - Limite: 50% do rendimento liquido
  - Referencia: 35% para perfil de risco baixo
  - Bancos podem exceder ate 20% da carteira nova

Maturidade:
  - Maximo legal: 40 anos
  - Convergencia recomendada: ate 30 anos para mutuarios > 35 anos
  - Regra: idade do mutuario + prazo ≤ 75 anos

Stress test obrigatorio:
  - Bancos devem avaliar capacidade com subida de 3pp na taxa
  - O simulador do ERP oferece esta funcionalidade automaticamente
```

---

## 3. Modelo de Dados

### 3.1 Tabela: `TEMP_pedidos_credito`

Pedido de credito habitacao — 1 por negocio/cliente.

```sql
CREATE TABLE TEMP_pedidos_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relacoes
  negocio_id UUID REFERENCES negocios(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id UUID REFERENCES dev_properties(id) ON DELETE SET NULL,
  assigned_to UUID NOT NULL REFERENCES dev_users(id),       -- intermediario responsavel

  -- Referencia interna (gerada por trigger: CRED-YYYY-XXXX)
  reference TEXT UNIQUE,

  -- Estado do pedido
  status TEXT NOT NULL DEFAULT 'novo',
  -- Valores: 'novo' | 'recolha_docs' | 'analise_financeira' | 'submetido_bancos' |
  --          'pre_aprovado' | 'aprovado' | 'contratado' | 'escriturado' | 'concluido' |
  --          'recusado' | 'desistencia' | 'expirado'

  -- Dados do imovel alvo
  imovel_valor_avaliacao NUMERIC,         -- valor de avaliacao do imovel
  imovel_valor_escritura NUMERIC,         -- valor de escritura
  imovel_tipo TEXT,                        -- tipo de imovel (habitacao propria, secundaria, investimento)
  imovel_finalidade TEXT,                  -- 'habitacao_propria_permanente' | 'habitacao_propria_secundaria' | 'investimento'

  -- Dados pessoais do titular 1 (para calculo de limites BdP: idade + prazo ≤ 75)
  data_nascimento_titular DATE,            -- necessario para regra BdP: idade + prazo ≤ 75 anos
  estado_civil TEXT,                        -- 'solteiro' | 'casado' | 'uniao_facto' | 'divorciado' | 'viuvo'
  numero_dependentes INT DEFAULT 0,

  -- Dados financeiros do cliente (titular 1)
  rendimento_mensal_liquido NUMERIC,
  rendimento_anual_bruto NUMERIC,
  entidade_patronal TEXT,
  tipo_contrato_trabalho TEXT,            -- 'efetivo' | 'termo_certo' | 'termo_incerto' | 'independente' | 'reformado' | 'outro'
  antiguidade_emprego_meses INT,
  outros_rendimentos NUMERIC DEFAULT 0,
  fonte_outros_rendimentos TEXT,

  -- Encargos mensais
  encargos_creditos_existentes NUMERIC DEFAULT 0,   -- prestacoes de creditos em curso
  encargos_cartoes NUMERIC DEFAULT 0,                -- limites de cartoes de credito (conta como encargo)
  encargos_pensao_alimentos NUMERIC DEFAULT 0,
  outros_encargos NUMERIC DEFAULT 0,
  despesas_fixas_mensais NUMERIC DEFAULT 0,          -- condominio, seguros, etc.

  -- Patrimonio / capital
  capital_proprio NUMERIC,                -- valor disponivel para entrada
  origem_capital TEXT,                     -- 'poupanca' | 'venda_imovel' | 'doacao' | 'heranca' | 'outro'
  tem_fiador BOOLEAN DEFAULT false,

  -- Dados do 2o titular (se aplicavel)
  tem_segundo_titular BOOLEAN DEFAULT false,
  segundo_titular_nome TEXT,
  segundo_titular_nif TEXT,
  segundo_titular_data_nascimento DATE,    -- para regra BdP: idade + prazo ≤ 75 (aplica-se ao mais velho)
  segundo_titular_rendimento_liquido NUMERIC,
  segundo_titular_entidade_patronal TEXT,
  segundo_titular_tipo_contrato TEXT,
  segundo_titular_encargos NUMERIC DEFAULT 0,

  -- Credito pretendido
  montante_solicitado NUMERIC,            -- valor do credito pedido
  prazo_anos INT,                          -- prazo pretendido (anos)
  tipo_taxa TEXT DEFAULT 'variavel',       -- 'fixa' | 'variavel' | 'mista'
  ltv_calculado NUMERIC,                  -- loan-to-value (calculado: montante / valor_avaliacao * 100)

  -- Metricas calculadas
  taxa_esforco NUMERIC,                   -- (prestacao_estimada + encargos) / rendimento * 100
  rendimento_disponivel NUMERIC,           -- rendimento - encargos - despesas

  -- Consentimento RGPD
  rgpd_consentimento BOOLEAN NOT NULL DEFAULT false,
  rgpd_consentimento_data TIMESTAMPTZ,
  rgpd_consentimento_ip TEXT,

  -- Datas de marco
  data_submissao_bancos TIMESTAMPTZ,      -- quando foi submetido aos bancos
  data_pre_aprovacao TIMESTAMPTZ,
  data_aprovacao_final TIMESTAMPTZ,
  data_escritura_prevista DATE,
  data_escritura_real DATE,
  data_conclusao TIMESTAMPTZ,

  -- Motivos de encerramento
  motivo_recusa TEXT,                      -- motivo da recusa (se status = 'recusado')
  motivo_desistencia TEXT,                 -- motivo da desistencia (se status = 'desistencia')

  -- Notas internas
  notas TEXT,

  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_temp_pedidos_credito_lead ON TEMP_pedidos_credito (lead_id);
CREATE INDEX idx_temp_pedidos_credito_negocio ON TEMP_pedidos_credito (negocio_id);
CREATE INDEX idx_temp_pedidos_credito_status ON TEMP_pedidos_credito (status);
CREATE INDEX idx_temp_pedidos_credito_assigned ON TEMP_pedidos_credito (assigned_to);
CREATE INDEX idx_temp_pedidos_credito_ref ON TEMP_pedidos_credito (reference);

-- Trigger: gerar referencia CRED-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_credit_ref()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
  ref TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 'CRED-\d{4}-(\d{4})') AS INT)
  ), 0) + 1
  INTO next_num
  FROM TEMP_pedidos_credito
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  ref := 'CRED-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(next_num::TEXT, 4, '0');
  NEW.reference := ref;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_credit_ref
  BEFORE INSERT ON TEMP_pedidos_credito
  FOR EACH ROW
  EXECUTE FUNCTION generate_credit_ref();

-- Trigger: updated_at
CREATE TRIGGER trg_temp_pedidos_credito_updated
  BEFORE UPDATE ON TEMP_pedidos_credito
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 3.2 Tabela: `TEMP_propostas_banco`

Proposta de um banco especifico — N por pedido de credito.

```sql
CREATE TABLE TEMP_propostas_banco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_credito_id UUID NOT NULL REFERENCES TEMP_pedidos_credito(id) ON DELETE CASCADE,

  -- Banco
  banco TEXT NOT NULL,                     -- nome do banco
  banco_contacto TEXT,                     -- nome do gestor de conta no banco
  banco_email TEXT,
  banco_telefone TEXT,
  tem_protocolo BOOLEAN DEFAULT false,     -- se a imobiliaria tem protocolo com este banco
  protocolo_ref TEXT,                      -- referencia do protocolo (se aplicavel)

  -- Estado da proposta
  status TEXT NOT NULL DEFAULT 'rascunho',
  -- Valores: 'rascunho' | 'submetida' | 'em_analise' | 'pre_aprovada' | 'aprovada' |
  --          'recusada' | 'expirada' | 'aceite' | 'contratada'

  -- Condicoes propostas pelo banco
  montante_aprovado NUMERIC,               -- pode diferir do solicitado
  prazo_aprovado_anos INT,
  tipo_taxa TEXT,                           -- 'fixa' | 'variavel' | 'mista'
  spread NUMERIC,                           -- spread oferecido (ex: 0.85%)
  euribor_referencia TEXT,                  -- ex: 'Euribor 6M', 'Euribor 12M'
  taxa_fixa_valor NUMERIC,                 -- se taxa fixa, qual o valor
  taxa_fixa_periodo_anos INT,              -- se mista, quantos anos de fixa
  taeg NUMERIC,                             -- taxa anual efectiva global
  mtic NUMERIC,                             -- montante total imputado ao consumidor
  prestacao_mensal NUMERIC,                -- prestacao mensal estimada
  ltv_aprovado NUMERIC,                    -- LTV aprovado pelo banco
  financiamento_percentagem NUMERIC,       -- % do valor do imovel financiado

  -- Seguros obrigatorios
  seguro_vida_mensal NUMERIC,
  seguro_multirriscos_anual NUMERIC,
  seguro_incluido_prestacao BOOLEAN DEFAULT false,

  -- Custos adicionais
  comissao_avaliacao NUMERIC,              -- custo da avaliacao do imovel pelo banco
  comissao_dossier NUMERIC,                -- comissao de dossier/abertura
  comissao_formalizacao NUMERIC,           -- outras comissoes
  imposto_selo_credito NUMERIC,            -- imposto de selo sobre o credito (0.6%)
  imposto_selo_comissoes NUMERIC,          -- IS sobre comissoes (4%)

  -- Condicoes especiais
  condicoes_especiais TEXT,                 -- texto livre com condicoes/observacoes do banco
  exige_domiciliacao_salario BOOLEAN DEFAULT false,
  exige_cartao_credito BOOLEAN DEFAULT false,
  exige_seguros_banco BOOLEAN DEFAULT false,
  outros_produtos_obrigatorios TEXT,        -- ex: "PPR minimo 50€/mes"

  -- Datas
  data_submissao TIMESTAMPTZ,
  data_resposta TIMESTAMPTZ,               -- quando o banco respondeu
  data_aprovacao TIMESTAMPTZ,
  data_validade_aprovacao DATE,            -- ate quando a aprovacao e valida
  data_contratacao TIMESTAMPTZ,            -- quando foi formalizado o contrato

  -- Motivo de recusa (se status = 'recusada')
  motivo_recusa TEXT,

  -- Proposta escolhida pelo cliente
  is_selected BOOLEAN DEFAULT false,       -- marca a proposta aceite pelo cliente

  -- Notas internas
  notas TEXT,

  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_temp_propostas_banco_pedido ON TEMP_propostas_banco (pedido_credito_id);
CREATE INDEX idx_temp_propostas_banco_status ON TEMP_propostas_banco (status);
CREATE INDEX idx_temp_propostas_banco_validade ON TEMP_propostas_banco (data_validade_aprovacao);

-- Constraint: apenas 1 proposta pode ser is_selected = true por pedido
CREATE UNIQUE INDEX idx_temp_propostas_banco_selected
  ON TEMP_propostas_banco (pedido_credito_id)
  WHERE is_selected = true;

-- Trigger: updated_at
CREATE TRIGGER trg_temp_propostas_banco_updated
  BEFORE UPDATE ON TEMP_propostas_banco
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 3.3 Tabela: `TEMP_credito_documentos`

Checklist de documentos por pedido de credito. Cada linha = 1 tipo de documento necessario.

```sql
CREATE TABLE TEMP_credito_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_credito_id UUID NOT NULL REFERENCES TEMP_pedidos_credito(id) ON DELETE CASCADE,

  -- Tipo de documento
  nome TEXT NOT NULL,                       -- ex: "Declaracao IRS 2025", "Recibo Vencimento Mar/2026"
  categoria TEXT NOT NULL DEFAULT 'geral',
  -- Valores: 'identificacao' | 'rendimentos' | 'patrimonio' | 'imovel' | 'fiscal' | 'empresa' | 'geral'

  -- Estado
  status TEXT NOT NULL DEFAULT 'pendente',
  -- Valores: 'pendente' | 'solicitado' | 'recebido' | 'validado' | 'rejeitado' | 'expirado'

  -- Ficheiro (se ja recebido)
  file_url TEXT,
  file_name TEXT,
  file_size INT,
  file_mimetype TEXT,

  -- Ligacao a doc_registry existente (se o documento ja existe no sistema)
  doc_registry_id UUID REFERENCES doc_registry(id) ON DELETE SET NULL,

  -- Prazos
  data_solicitado TIMESTAMPTZ,             -- quando foi pedido ao cliente
  data_recebido TIMESTAMPTZ,
  data_validade DATE,                       -- data de validade do documento (ex: IRS = ano fiscal)

  -- Obrigatoriedade por banco
  obrigatorio BOOLEAN DEFAULT true,
  bancos_requeridos TEXT[],                 -- quais bancos exigem este documento (NULL = todos)

  -- Notas
  notas TEXT,
  motivo_rejeicao TEXT,                     -- se status = 'rejeitado'

  -- Titular
  titular TEXT DEFAULT 'titular_1',         -- 'titular_1' | 'titular_2' | 'ambos'

  -- Ordem de apresentacao
  order_index INT DEFAULT 0,

  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_temp_credito_docs_pedido ON TEMP_credito_documentos (pedido_credito_id);
CREATE INDEX idx_temp_credito_docs_status ON TEMP_credito_documentos (status);
CREATE INDEX idx_temp_credito_docs_categoria ON TEMP_credito_documentos (categoria);
```

### 3.4 Tabela: `TEMP_credito_simulacoes`

Historico de simulacoes de credito guardadas.

```sql
CREATE TABLE TEMP_credito_simulacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_credito_id UUID REFERENCES TEMP_pedidos_credito(id) ON DELETE CASCADE,
  -- pedido_credito_id pode ser NULL (simulacao avulsa, sem pedido associado)

  created_by UUID NOT NULL REFERENCES dev_users(id),

  -- Parametros da simulacao
  valor_imovel NUMERIC NOT NULL,
  montante_credito NUMERIC NOT NULL,
  capital_proprio NUMERIC NOT NULL,
  prazo_anos INT NOT NULL,
  euribor NUMERIC NOT NULL,                -- valor Euribor usado (ex: 2.90)
  spread NUMERIC NOT NULL,                 -- spread do banco (ex: 0.95)
  taxa_juro NUMERIC NOT NULL,              -- taxa total = euribor + spread
  tipo_taxa TEXT NOT NULL DEFAULT 'variavel',
  periodo_revisao_meses INT DEFAULT 6,     -- Euribor 3M, 6M ou 12M

  -- Resultados calculados
  prestacao_mensal NUMERIC NOT NULL,
  total_juros NUMERIC NOT NULL,
  mtic NUMERIC NOT NULL,                   -- Montante Total Imputado ao Consumidor (conforme BdP)
  ltv NUMERIC NOT NULL,                    -- loan-to-value %
  taxa_esforco NUMERIC,                    -- se rendimento disponivel
  -- Custos Portugal
  imposto_selo_credito NUMERIC,            -- 0,6% sobre montante (pago uma vez)
  total_imposto_selo_juros NUMERIC,        -- 4% IS sobre juros (acumulado)
  seguro_vida_mensal_estimado NUMERIC,
  seguro_multirriscos_anual_estimado NUMERIC,
  encargo_credito_mensal NUMERIC,          -- prestacao + seguros mensais

  -- Contexto
  rendimento_mensal_liquido NUMERIC,       -- rendimento usado no calculo da taxa de esforco
  label TEXT,                               -- nome dado a simulacao (ex: "Cenario optimista")
  notas TEXT,

  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_temp_credito_sim_pedido ON TEMP_credito_simulacoes (pedido_credito_id);
CREATE INDEX idx_temp_credito_sim_user ON TEMP_credito_simulacoes (created_by);
```

### 3.5 Tabela: `TEMP_credito_actividades`

Historico de actividades/interaccoes no processo de credito.

```sql
CREATE TABLE TEMP_credito_actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_credito_id UUID NOT NULL REFERENCES TEMP_pedidos_credito(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dev_users(id),

  -- Tipo de actividade
  tipo TEXT NOT NULL,
  -- Valores: 'status_change' | 'nota' | 'chamada_banco' | 'chamada_cliente' |
  --          'email_banco' | 'email_cliente' | 'reuniao' | 'documento_recebido' |
  --          'documento_enviado' | 'proposta_recebida' | 'proposta_aceite' |
  --          'simulacao' | 'avaliacao_imovel' | 'escritura'

  -- Descricao
  descricao TEXT NOT NULL,

  -- Metadata contextual
  metadata JSONB,
  -- Exemplos de metadata por tipo:
  -- status_change: { old_status: 'novo', new_status: 'recolha_docs' }
  -- chamada_banco: { banco: 'CGD', duracao_min: 15, resultado: 'aguarda_documentos' }
  -- proposta_recebida: { proposta_id: 'uuid', banco: 'BPI', spread: 0.85 }
  -- documento_recebido: { documento_id: 'uuid', nome: 'IRS 2025' }

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_temp_credito_act_pedido ON TEMP_credito_actividades (pedido_credito_id);
CREATE INDEX idx_temp_credito_act_tipo ON TEMP_credito_actividades (tipo);
```

### 3.6 Tabela: `TEMP_credito_bancos`

Lista de bancos com que a imobiliaria trabalha e respectivos protocolos.

```sql
CREATE TABLE TEMP_credito_bancos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  nome TEXT NOT NULL UNIQUE,               -- ex: "CGD", "BPI", "Millennium BCP"
  nome_completo TEXT,                       -- ex: "Caixa Geral de Depositos"
  logo_url TEXT,                            -- URL do logotipo

  -- Protocolo
  tem_protocolo BOOLEAN DEFAULT false,
  protocolo_ref TEXT,
  protocolo_validade DATE,
  spread_protocolo NUMERIC,                -- spread negociado via protocolo

  -- Contacto do banco
  gestor_nome TEXT,
  gestor_email TEXT,
  gestor_telefone TEXT,
  agencia TEXT,

  -- Comissao que o banco paga ao intermediario
  comissao_percentagem NUMERIC,            -- % sobre o montante do credito
  comissao_minima NUMERIC,                 -- valor minimo por operacao
  comissao_maxima NUMERIC,                 -- valor maximo (se aplicavel)

  -- Documentos exigidos por este banco (template de checklist)
  documentos_exigidos JSONB,               -- array de { nome, categoria, obrigatorio }
  -- Ex: [
  --   { "nome": "CC / Cartao de Cidadao", "categoria": "identificacao", "obrigatorio": true },
  --   { "nome": "Ultima declaracao IRS + Nota Liquidacao", "categoria": "fiscal", "obrigatorio": true },
  --   { "nome": "3 ultimos recibos de vencimento", "categoria": "rendimentos", "obrigatorio": true },
  --   { "nome": "Declaracao entidade patronal", "categoria": "rendimentos", "obrigatorio": true },
  --   { "nome": "Mapa responsabilidades Banco Portugal", "categoria": "patrimonio", "obrigatorio": true },
  --   { "nome": "Extractos bancarios 3 meses", "categoria": "patrimonio", "obrigatorio": false }
  -- ]

  -- Configuracao
  is_active BOOLEAN DEFAULT true,
  notas TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.7 Diagrama de Relacoes

```
leads ──1:N──▶ negocios ──1:1──▶ TEMP_pedidos_credito ──1:N──▶ TEMP_propostas_banco
                                        │
                                        ├──1:N──▶ TEMP_credito_documentos
                                        ├──1:N──▶ TEMP_credito_simulacoes
                                        └──1:N──▶ TEMP_credito_actividades

TEMP_credito_bancos (tabela de referencia, sem FK directa)

dev_properties ◀── TEMP_pedidos_credito.property_id
dev_users ◀── TEMP_pedidos_credito.assigned_to
```

---

## 4. Integracoes com Modulos Existentes

### 4.1 Negocios (M05) → Credito

Quando um negocio de tipo `Compra` ou `Arrendatario` tem `financiamento_necessario = true`:

- Mostrar botao **"Iniciar Pedido de Credito"** no detalhe do negocio
- Pre-preencher: `lead_id`, `negocio_id`, `capital_proprio`, `valor_credito` (do negocio)
- Se ja existe um pedido de credito para este negocio, mostrar **badge com status** e link directo

**Componente a adicionar:** `<CreditoStatusBadge>` no detalhe do negocio.

### 4.2 Imoveis (M03) → Credito

Quando um imovel e associado a um pedido de credito:

- No detalhe do imovel (tab Processo), mostrar **pedidos de credito** associados
- Pre-preencher `imovel_valor_avaliacao` com `listing_price` do imovel

### 4.3 Calendario (M15) → Credito

Novos tipos de evento automatico para o calendario:

| Categoria | Origem | Cor |
|-----------|--------|-----|
| `credit_deadline` | `TEMP_propostas_banco.data_validade_aprovacao` | `teal-500` |
| `credit_escritura` | `TEMP_pedidos_credito.data_escritura_prevista` | `violet-500` |
| `credit_followup` | Calculado: `data_submissao` + 7 dias por banco | `teal-300` |

Adicionar ao `CALENDAR_ROLE_PRESETS` do `intermediario_credito`:
```typescript
'intermediario_credito': {
  categories: ['process_task', 'process_subtask', 'meeting', 'reminder',
               'credit_deadline', 'credit_escritura', 'credit_followup'],
  filterSelf: true
}
```

### 4.4 Processos (M06) → Credito

O sistema de processos pode ter um template especifico para credito:

- Template "Processo de Credito Habitacao" com fases: Recolha Docs → Analise → Submissao → Aprovacao → Escritura
- As tarefas do tipo `UPLOAD` podem ligar-se aos `TEMP_credito_documentos`
- Quando o credito e aprovado, actualizar automaticamente o `proc_instances` (se existir) da angariacao

**Nota:** O template de processo e opcional e complementar. O pipeline do pedido de credito (`TEMP_pedidos_credito.status`) e o tracking principal. O template de processo permite ao Gestor Processual acompanhar via Stepper.

### 4.5 Documentos (M08) → Credito

Reutilizar `doc_registry` quando possivel:

- Ao criar a checklist de documentos, verificar se o documento ja existe em `doc_registry` para o imovel/lead
- Se existir, ligar via `TEMP_credito_documentos.doc_registry_id` e marcar como `recebido`
- Upload de novos documentos vai para R2: `credito/{pedido_credito_id}/{filename}`

---

## 5. API Routes

### 5.1 Pedidos de Credito (CRUD)

```
GET    /api/credit                          — Listar pedidos (com filtros)
POST   /api/credit                          — Criar pedido de credito
GET    /api/credit/[id]                     — Detalhe do pedido (com propostas, docs, actividades)
PUT    /api/credit/[id]                     — Actualizar dados do pedido
DELETE /api/credit/[id]                     — Eliminar pedido (soft: status → 'desistencia')
```

**GET /api/credit — Query params:**

| Param | Tipo | Descricao |
|-------|------|-----------|
| `status` | string (csv) | Filtro por status (ex: `novo,recolha_docs`) |
| `assigned_to` | UUID | Filtro por intermediario |
| `lead_id` | UUID | Filtro por lead |
| `search` | string | Pesquisa por referencia, nome do lead |
| `page` | int | Pagina (default 1) |
| `per_page` | int | Resultados por pagina (default 20) |
| `sort` | string | Campo de ordenacao (default `created_at`) |
| `order` | string | `asc` ou `desc` (default `desc`) |

**GET /api/credit/[id] — Resposta:**

```typescript
{
  ...pedido_credito,
  lead: { id, nome, email, telemovel, nif },
  negocio: { id, tipo, orcamento, estado },
  property: { id, title, listing_price, city },
  assigned_user: { id, commercial_name },
  propostas: TEMP_propostas_banco[],
  documentos: TEMP_credito_documentos[],
  actividades: TEMP_credito_actividades[],    // ultimas 50
  simulacoes: TEMP_credito_simulacoes[],
  metricas: {
    total_propostas: number,
    propostas_aprovadas: number,
    melhor_spread: number,
    melhor_prestacao: number,
    docs_pendentes: number,
    docs_total: number,
    dias_em_processo: number,
  }
}
```

### 5.2 Propostas de Banco

```
GET    /api/credit/[id]/proposals                — Listar propostas do pedido
POST   /api/credit/[id]/proposals                — Adicionar proposta
PUT    /api/credit/[id]/proposals/[proposalId]   — Actualizar proposta
DELETE /api/credit/[id]/proposals/[proposalId]   — Eliminar proposta (soft)
POST   /api/credit/[id]/proposals/[proposalId]/select  — Marcar como proposta aceite
```

### 5.3 Documentos do Credito

```
GET    /api/credit/[id]/documents                — Listar checklist de documentos
POST   /api/credit/[id]/documents                — Adicionar item a checklist
PUT    /api/credit/[id]/documents/[docId]        — Actualizar estado/ficheiro
DELETE /api/credit/[id]/documents/[docId]        — Remover da checklist
POST   /api/credit/[id]/documents/populate       — Popular checklist a partir de template de banco
POST   /api/credit/[id]/documents/[docId]/upload — Upload de ficheiro
```

**POST /api/credit/[id]/documents/populate — Body:**

```typescript
{
  banco_id: string    // ID do TEMP_credito_bancos — usa documentos_exigidos para gerar checklist
}
```

Este endpoint le os `documentos_exigidos` do banco e cria entradas em `TEMP_credito_documentos`, verificando se algum documento ja existe no sistema (`doc_registry`) para auto-ligar.

### 5.4 Simulacoes

```
POST   /api/credit/simulate                      — Calcular simulacao (sem guardar)
POST   /api/credit/[id]/simulations              — Calcular e guardar simulacao
GET    /api/credit/[id]/simulations              — Listar simulacoes guardadas
DELETE /api/credit/[id]/simulations/[simId]      — Eliminar simulacao
```

**POST /api/credit/simulate — Body e Resposta:**

```typescript
// Request
{
  valor_imovel: number,
  montante_credito: number,
  prazo_anos: number,
  euribor: number,                         // taxa Euribor actual (ex: 2.90)
  spread: number,                          // spread do banco (ex: 0.95)
  periodo_revisao_meses?: 3 | 6 | 12,     // Euribor 3M, 6M ou 12M (default 6)
  rendimento_mensal?: number,              // opcional, para calcular taxa de esforco
  euribor_cenarios?: number[],             // cenarios de stress test (ex: [3.90, 4.90, 5.90])
}

// Response
{
  prestacao_mensal: number,
  total_juros: number,
  mtic: number,                            // Montante Total Imputado ao Consumidor (BdP)
  ltv: number,
  capital_proprio: number,
  taxa_esforco?: number,                   // se rendimento fornecido
  // Custos especificos Portugal
  imposto_selo_credito: number,            // 0,6% sobre o montante (pago uma vez)
  total_imposto_selo_juros: number,        // 4% IS sobre juros (acumulado total prazo)
  seguro_vida_mensal_estimado: number,     // estimativa seguro vida
  seguro_multirriscos_anual_estimado: number,
  encargo_credito_mensal: number,          // prestacao + seguros (usado na taxa de esforco)
  tabela_amortizacao?: {                   // primeiros 12 meses + resumo anual
    mes: number,
    prestacao: number,
    capital: number,
    juros: number,
    imposto_selo_juros: number,            // 4% IS sobre juros desse mes
    capital_em_divida: number,
  }[]
}
```

**Formula — Sistema de Amortizacao Portugues (prestacoes constantes com revisao periodica):**

Em Portugal, o credito habitacao usa o sistema de **prestacoes constantes** com **revisao periodica da taxa** (tipicamente a cada 3, 6 ou 12 meses, conforme o indexante Euribor escolhido).

```
Prestacao mensal (entre revisoes):
  M = C_r * [ r * (1 + r)^n_r ] / [ (1 + r)^n_r - 1 ]

Onde:
  M   = prestacao mensal (constante ate a proxima revisao)
  C_r = capital em divida no momento da revisao
  r   = taxa de juro mensal = (Euribor_actual + spread) / 12
  n_r = numero de prestacoes restantes no momento da revisao

A cada revisao (3M, 6M ou 12M conforme contrato):
  1. Obtem-se o novo valor da Euribor
  2. Recalcula-se r = (Euribor_nova + spread) / 12
  3. C_r = capital em divida apos ultima prestacao
  4. n_r = prestacoes restantes
  5. Recalcula-se M com a formula acima
```

**Nota:** Para efeitos de simulacao, assume-se taxa constante ao longo de todo o prazo (cenario base). O simulador permite criar cenarios com diferentes valores de Euribor para stress test.

**Particularidades portuguesas incluidas na simulacao:**
- Imposto de selo sobre o credito: 0,6% do montante (pago uma vez)
- Imposto de selo sobre juros: 4% sobre os juros de cada prestacao
- Seguros obrigatorios: vida e multirriscos (estimados)
- Comissoes bancarias tipicas: avaliacao, dossier, formalizacao
- MTIC (Montante Total Imputado ao Consumidor) — inclui todos os custos

### 5.5 Actividades

```
GET    /api/credit/[id]/activities               — Listar actividades
POST   /api/credit/[id]/activities               — Registar actividade
```

### 5.6 Bancos (Configuracao)

```
GET    /api/credit/banks                          — Listar bancos activos
POST   /api/credit/banks                          — Adicionar banco
PUT    /api/credit/banks/[bankId]                 — Editar banco
DELETE /api/credit/banks/[bankId]                 — Desactivar banco (is_active = false)
```

### 5.7 Accoes de Estado

```
POST   /api/credit/[id]/submit-banks             — Submeter a bancos (status → 'submetido_bancos')
POST   /api/credit/[id]/approve                  — Marcar como aprovado (status → 'aprovado')
POST   /api/credit/[id]/refuse                   — Marcar como recusado (status → 'recusado')
POST   /api/credit/[id]/cancel                   — Desistencia (status → 'desistencia')
```

**POST /api/credit/[id]/submit-banks:**
- Valida que existem pelo menos 3 propostas (aviso regulatorio se < 3)
- Valida que todos os documentos obrigatorios estao `recebido` ou `validado`
- Actualiza status do pedido e das propostas para `submetida`
- Cria actividade `status_change`
- Cria eventos de follow-up no calendario (7 dias apos submissao, por banco)

---

## 6. Types TypeScript

```typescript
// types/credit.ts

// === Status ===

export type CreditRequestStatus =
  | 'novo'
  | 'recolha_docs'
  | 'analise_financeira'
  | 'submetido_bancos'
  | 'pre_aprovado'
  | 'aprovado'
  | 'contratado'
  | 'escriturado'
  | 'concluido'
  | 'recusado'
  | 'desistencia'
  | 'expirado'

export type ProposalStatus =
  | 'rascunho'
  | 'submetida'
  | 'em_analise'
  | 'pre_aprovada'
  | 'aprovada'
  | 'recusada'
  | 'expirada'
  | 'aceite'
  | 'contratada'

export type CreditDocStatus =
  | 'pendente'
  | 'solicitado'
  | 'recebido'
  | 'validado'
  | 'rejeitado'
  | 'expirado'

export type CreditDocCategory =
  | 'identificacao'
  | 'rendimentos'
  | 'patrimonio'
  | 'imovel'
  | 'fiscal'
  | 'empresa'
  | 'geral'

export type CreditActivityType =
  | 'status_change'
  | 'nota'
  | 'chamada_banco'
  | 'chamada_cliente'
  | 'email_banco'
  | 'email_cliente'
  | 'reuniao'
  | 'documento_recebido'
  | 'documento_enviado'
  | 'proposta_recebida'
  | 'proposta_aceite'
  | 'simulacao'
  | 'avaliacao_imovel'
  | 'escritura'

export type PropertyPurpose =
  | 'habitacao_propria_permanente'
  | 'habitacao_propria_secundaria'
  | 'investimento'

export type EmploymentContractType =
  | 'efetivo'
  | 'termo_certo'
  | 'termo_incerto'
  | 'independente'
  | 'reformado'
  | 'outro'

export type RateType = 'fixa' | 'variavel' | 'mista'

export type CapitalOrigin =
  | 'poupanca'
  | 'venda_imovel'
  | 'doacao'
  | 'heranca'
  | 'outro'

// === Entidades ===

export interface CreditRequest {
  id: string
  reference: string
  negocio_id: string | null
  lead_id: string
  property_id: string | null
  assigned_to: string
  status: CreditRequestStatus

  // Imovel
  imovel_valor_avaliacao: number | null
  imovel_valor_escritura: number | null
  imovel_tipo: string | null
  imovel_finalidade: PropertyPurpose | null

  // Dados pessoais titular 1 (para regra BdP: idade + prazo ≤ 75)
  data_nascimento_titular: string | null
  estado_civil: string | null
  numero_dependentes: number

  // Financeiro titular 1
  rendimento_mensal_liquido: number | null
  rendimento_anual_bruto: number | null
  entidade_patronal: string | null
  tipo_contrato_trabalho: EmploymentContractType | null
  antiguidade_emprego_meses: number | null
  outros_rendimentos: number | null
  fonte_outros_rendimentos: string | null

  // Encargos
  encargos_creditos_existentes: number
  encargos_cartoes: number
  encargos_pensao_alimentos: number
  outros_encargos: number
  despesas_fixas_mensais: number

  // Capital
  capital_proprio: number | null
  origem_capital: CapitalOrigin | null
  tem_fiador: boolean

  // 2o titular
  tem_segundo_titular: boolean
  segundo_titular_nome: string | null
  segundo_titular_nif: string | null
  segundo_titular_data_nascimento: string | null
  segundo_titular_rendimento_liquido: number | null
  segundo_titular_entidade_patronal: string | null
  segundo_titular_tipo_contrato: EmploymentContractType | null
  segundo_titular_encargos: number

  // Credito
  montante_solicitado: number | null
  prazo_anos: number | null
  tipo_taxa: RateType
  ltv_calculado: number | null

  // Metricas
  taxa_esforco: number | null
  rendimento_disponivel: number | null

  // RGPD
  rgpd_consentimento: boolean
  rgpd_consentimento_data: string | null

  // Datas
  data_submissao_bancos: string | null
  data_pre_aprovacao: string | null
  data_aprovacao_final: string | null
  data_escritura_prevista: string | null
  data_escritura_real: string | null
  data_conclusao: string | null

  // Encerramento
  motivo_recusa: string | null
  motivo_desistencia: string | null
  notas: string | null

  created_at: string
  updated_at: string
}

export interface CreditProposal {
  id: string
  pedido_credito_id: string
  banco: string
  banco_contacto: string | null
  banco_email: string | null
  banco_telefone: string | null
  tem_protocolo: boolean
  protocolo_ref: string | null
  status: ProposalStatus

  montante_aprovado: number | null
  prazo_aprovado_anos: number | null
  tipo_taxa: RateType | null
  spread: number | null
  euribor_referencia: string | null
  taxa_fixa_valor: number | null
  taxa_fixa_periodo_anos: number | null
  taeg: number | null
  mtic: number | null
  prestacao_mensal: number | null
  ltv_aprovado: number | null
  financiamento_percentagem: number | null

  seguro_vida_mensal: number | null
  seguro_multirriscos_anual: number | null
  seguro_incluido_prestacao: boolean

  comissao_avaliacao: number | null
  comissao_dossier: number | null
  comissao_formalizacao: number | null
  imposto_selo_credito: number | null
  imposto_selo_comissoes: number | null

  condicoes_especiais: string | null
  exige_domiciliacao_salario: boolean
  exige_cartao_credito: boolean
  exige_seguros_banco: boolean
  outros_produtos_obrigatorios: string | null

  data_submissao: string | null
  data_resposta: string | null
  data_aprovacao: string | null
  data_validade_aprovacao: string | null
  data_contratacao: string | null

  motivo_recusa: string | null
  is_selected: boolean
  notas: string | null

  created_at: string
  updated_at: string
}

export interface CreditDocument {
  id: string
  pedido_credito_id: string
  nome: string
  categoria: CreditDocCategory
  status: CreditDocStatus
  file_url: string | null
  file_name: string | null
  file_size: number | null
  file_mimetype: string | null
  doc_registry_id: string | null
  data_solicitado: string | null
  data_recebido: string | null
  data_validade: string | null
  obrigatorio: boolean
  bancos_requeridos: string[] | null
  notas: string | null
  motivo_rejeicao: string | null
  titular: 'titular_1' | 'titular_2' | 'ambos'
  order_index: number
  created_at: string
  updated_at: string
}

export interface CreditSimulation {
  id: string
  pedido_credito_id: string | null
  created_by: string
  valor_imovel: number
  montante_credito: number
  capital_proprio: number
  prazo_anos: number
  taxa_juro: number
  tipo_taxa: RateType
  spread: number | null
  euribor: number | null
  prestacao_mensal: number
  total_juros: number
  mtic: number
  ltv: number
  taxa_esforco: number | null
  rendimento_mensal_liquido: number | null
  label: string | null
  notas: string | null
  created_at: string
}

export interface CreditActivity {
  id: string
  pedido_credito_id: string
  user_id: string
  tipo: CreditActivityType
  descricao: string
  metadata: Record<string, unknown> | null
  created_at: string
  // Joined
  user_name?: string
}

export interface CreditBank {
  id: string
  nome: string
  nome_completo: string | null
  logo_url: string | null
  tem_protocolo: boolean
  protocolo_ref: string | null
  protocolo_validade: string | null
  spread_protocolo: number | null
  gestor_nome: string | null
  gestor_email: string | null
  gestor_telefone: string | null
  agencia: string | null
  comissao_percentagem: number | null
  comissao_minima: number | null
  comissao_maxima: number | null
  documentos_exigidos: BankDocRequirement[] | null
  is_active: boolean
  notas: string | null
  created_at: string
  updated_at: string
}

export interface BankDocRequirement {
  nome: string
  categoria: CreditDocCategory
  obrigatorio: boolean
}

// === Tipos compostos para UI ===

export interface CreditRequestWithRelations extends CreditRequest {
  lead: { id: string; nome: string; email: string | null; telemovel: string | null; nif: string | null }
  negocio?: { id: string; tipo: string; orcamento: number | null; estado: string } | null
  property?: { id: string; title: string; listing_price: number | null; city: string | null } | null
  assigned_user: { id: string; commercial_name: string }
  propostas: CreditProposal[]
  documentos: CreditDocument[]
  simulacoes: CreditSimulation[]
}

export interface CreditRequestListItem extends CreditRequest {
  lead_nome: string
  lead_email: string | null
  property_title: string | null
  assigned_user_name: string
  propostas_count: number
  docs_pendentes: number
  melhor_spread: number | null
}

export interface SimulationInput {
  valor_imovel: number
  montante_credito: number
  prazo_anos: number
  euribor: number                          // taxa Euribor actual (ex: 2.90)
  spread: number                           // spread do banco (ex: 0.95)
  periodo_revisao_meses?: 3 | 6 | 12      // Euribor 3M, 6M ou 12M (default 6)
  rendimento_mensal?: number
  // Para stress test
  euribor_cenarios?: number[]              // ex: [3.90, 4.90, 5.90] — cenarios de subida
}

export interface SimulationResult {
  prestacao_mensal: number
  total_juros: number
  mtic: number                             // Montante Total Imputado ao Consumidor (regulamento BdP)
  ltv: number
  capital_proprio: number
  taxa_esforco?: number
  // Custos especificos Portugal
  imposto_selo_credito: number             // 0,6% sobre o montante (pago uma vez)
  total_imposto_selo_juros: number         // 4% sobre juros acumulado
  seguro_vida_mensal_estimado: number
  seguro_multirriscos_anual_estimado: number
  encargo_credito_mensal: number           // prestacao + seguros (para taxa de esforco)
  tabela_amortizacao?: AmortizationRow[]
}

export interface AmortizationRow {
  mes: number
  prestacao: number
  capital: number
  juros: number
  imposto_selo_juros: number               // 4% sobre juros desse mes
  capital_em_divida: number
}
```

---

## 7. Validacoes Zod

```typescript
// lib/validations/credit.ts

import { z } from 'zod'

const uuidRegex = /^[0-9a-f-]{36}$/

// === Pedido de Credito ===

export const createCreditRequestSchema = z.object({
  lead_id: z.string().regex(uuidRegex),
  negocio_id: z.string().regex(uuidRegex).optional().nullable(),
  property_id: z.string().regex(uuidRegex).optional().nullable(),

  // Imovel
  imovel_valor_avaliacao: z.number().positive().optional().nullable(),
  imovel_valor_escritura: z.number().positive().optional().nullable(),
  imovel_finalidade: z.enum([
    'habitacao_propria_permanente', 'habitacao_propria_secundaria', 'investimento'
  ]).optional().nullable(),

  // Financeiro
  rendimento_mensal_liquido: z.number().min(0).optional().nullable(),
  rendimento_anual_bruto: z.number().min(0).optional().nullable(),
  entidade_patronal: z.string().max(200).optional().nullable(),
  tipo_contrato_trabalho: z.enum([
    'efetivo', 'termo_certo', 'termo_incerto', 'independente', 'reformado', 'outro'
  ]).optional().nullable(),
  antiguidade_emprego_meses: z.number().int().min(0).optional().nullable(),
  outros_rendimentos: z.number().min(0).optional().nullable(),
  fonte_outros_rendimentos: z.string().max(200).optional().nullable(),

  // Encargos
  encargos_creditos_existentes: z.number().min(0).default(0),
  encargos_cartoes: z.number().min(0).default(0),
  encargos_pensao_alimentos: z.number().min(0).default(0),
  outros_encargos: z.number().min(0).default(0),
  despesas_fixas_mensais: z.number().min(0).default(0),

  // Capital
  capital_proprio: z.number().min(0).optional().nullable(),
  origem_capital: z.enum([
    'poupanca', 'venda_imovel', 'doacao', 'heranca', 'outro'
  ]).optional().nullable(),
  tem_fiador: z.boolean().default(false),

  // 2o titular
  tem_segundo_titular: z.boolean().default(false),
  segundo_titular_nome: z.string().max(200).optional().nullable(),
  segundo_titular_nif: z.string().max(20).optional().nullable(),
  segundo_titular_rendimento_liquido: z.number().min(0).optional().nullable(),
  segundo_titular_entidade_patronal: z.string().max(200).optional().nullable(),
  segundo_titular_tipo_contrato: z.enum([
    'efetivo', 'termo_certo', 'termo_incerto', 'independente', 'reformado', 'outro'
  ]).optional().nullable(),
  segundo_titular_encargos: z.number().min(0).default(0),

  // Credito
  montante_solicitado: z.number().positive().optional().nullable(),
  prazo_anos: z.number().int().min(1).max(40).optional().nullable(),
  tipo_taxa: z.enum(['fixa', 'variavel', 'mista']).default('variavel'),

  // RGPD
  rgpd_consentimento: z.boolean(),

  notas: z.string().max(5000).optional().nullable(),
})

export const updateCreditRequestSchema = createCreditRequestSchema.partial().extend({
  status: z.enum([
    'novo', 'recolha_docs', 'analise_financeira', 'submetido_bancos',
    'pre_aprovado', 'aprovado', 'contratado', 'escriturado', 'concluido',
    'recusado', 'desistencia', 'expirado'
  ]).optional(),
  data_escritura_prevista: z.string().optional().nullable(),
  motivo_recusa: z.string().max(1000).optional().nullable(),
  motivo_desistencia: z.string().max(1000).optional().nullable(),
})

// === Proposta de Banco ===

export const createProposalSchema = z.object({
  banco: z.string().min(1).max(100),
  banco_contacto: z.string().max(200).optional().nullable(),
  banco_email: z.string().email().optional().nullable(),
  banco_telefone: z.string().max(20).optional().nullable(),
  tem_protocolo: z.boolean().default(false),
  protocolo_ref: z.string().max(100).optional().nullable(),

  montante_aprovado: z.number().positive().optional().nullable(),
  prazo_aprovado_anos: z.number().int().min(1).max(40).optional().nullable(),
  tipo_taxa: z.enum(['fixa', 'variavel', 'mista']).optional().nullable(),
  spread: z.number().min(0).max(10).optional().nullable(),
  euribor_referencia: z.string().max(50).optional().nullable(),
  taxa_fixa_valor: z.number().min(0).max(20).optional().nullable(),
  taxa_fixa_periodo_anos: z.number().int().min(1).max(40).optional().nullable(),
  taeg: z.number().min(0).max(30).optional().nullable(),
  mtic: z.number().positive().optional().nullable(),
  prestacao_mensal: z.number().positive().optional().nullable(),
  ltv_aprovado: z.number().min(0).max(100).optional().nullable(),
  financiamento_percentagem: z.number().min(0).max(100).optional().nullable(),

  seguro_vida_mensal: z.number().min(0).optional().nullable(),
  seguro_multirriscos_anual: z.number().min(0).optional().nullable(),
  seguro_incluido_prestacao: z.boolean().default(false),

  comissao_avaliacao: z.number().min(0).optional().nullable(),
  comissao_dossier: z.number().min(0).optional().nullable(),
  comissao_formalizacao: z.number().min(0).optional().nullable(),
  imposto_selo_credito: z.number().min(0).optional().nullable(),
  imposto_selo_comissoes: z.number().min(0).optional().nullable(),

  condicoes_especiais: z.string().max(2000).optional().nullable(),
  exige_domiciliacao_salario: z.boolean().default(false),
  exige_cartao_credito: z.boolean().default(false),
  exige_seguros_banco: z.boolean().default(false),
  outros_produtos_obrigatorios: z.string().max(500).optional().nullable(),

  data_validade_aprovacao: z.string().optional().nullable(),
  notas: z.string().max(5000).optional().nullable(),
})

export const updateProposalSchema = createProposalSchema.partial().extend({
  status: z.enum([
    'rascunho', 'submetida', 'em_analise', 'pre_aprovada',
    'aprovada', 'recusada', 'expirada', 'aceite', 'contratada'
  ]).optional(),
  motivo_recusa: z.string().max(1000).optional().nullable(),
})

// === Simulacao ===

export const simulationSchema = z.object({
  valor_imovel: z.number().positive(),
  montante_credito: z.number().positive(),
  prazo_anos: z.number().int().min(1).max(40),   // max 40 anos (limite legal Portugal)
  euribor: z.number().min(-1).max(15),             // Euribor pode ser negativa
  spread: z.number().min(0).max(10),
  periodo_revisao_meses: z.enum(['3', '6', '12']).transform(Number).optional(),
  rendimento_mensal: z.number().min(0).optional(),
  euribor_cenarios: z.array(z.number().min(-1).max(15)).max(5).optional(),
  label: z.string().max(100).optional(),
  notas: z.string().max(1000).optional(),
})

// === Actividade ===

export const createActivitySchema = z.object({
  tipo: z.enum([
    'status_change', 'nota', 'chamada_banco', 'chamada_cliente',
    'email_banco', 'email_cliente', 'reuniao', 'documento_recebido',
    'documento_enviado', 'proposta_recebida', 'proposta_aceite',
    'simulacao', 'avaliacao_imovel', 'escritura'
  ]),
  descricao: z.string().min(1).max(2000),
  metadata: z.record(z.unknown()).optional(),
})

// === Banco ===

export const bankSchema = z.object({
  nome: z.string().min(1).max(100),
  nome_completo: z.string().max(200).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  tem_protocolo: z.boolean().default(false),
  protocolo_ref: z.string().max(100).optional().nullable(),
  protocolo_validade: z.string().optional().nullable(),
  spread_protocolo: z.number().min(0).max(10).optional().nullable(),
  gestor_nome: z.string().max(200).optional().nullable(),
  gestor_email: z.string().email().optional().nullable(),
  gestor_telefone: z.string().max(20).optional().nullable(),
  agencia: z.string().max(200).optional().nullable(),
  comissao_percentagem: z.number().min(0).max(10).optional().nullable(),
  comissao_minima: z.number().min(0).optional().nullable(),
  comissao_maxima: z.number().min(0).optional().nullable(),
  documentos_exigidos: z.array(z.object({
    nome: z.string(),
    categoria: z.enum(['identificacao', 'rendimentos', 'patrimonio', 'imovel', 'fiscal', 'empresa', 'geral']),
    obrigatorio: z.boolean(),
  })).optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
})

// === Documento de credito ===

export const creditDocumentSchema = z.object({
  nome: z.string().min(1).max(200),
  categoria: z.enum(['identificacao', 'rendimentos', 'patrimonio', 'imovel', 'fiscal', 'empresa', 'geral']),
  obrigatorio: z.boolean().default(true),
  bancos_requeridos: z.array(z.string()).optional().nullable(),
  titular: z.enum(['titular_1', 'titular_2', 'ambos']).default('titular_1'),
  data_validade: z.string().optional().nullable(),
  notas: z.string().max(1000).optional().nullable(),
})
```

---

## 8. Constantes e Labels PT-PT

```typescript
// Adicionar a lib/constants.ts

// === Status do Pedido de Credito ===

export const CREDIT_STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  recolha_docs: 'Recolha de Documentos',
  analise_financeira: 'Analise Financeira',
  submetido_bancos: 'Submetido a Bancos',
  pre_aprovado: 'Pre-Aprovado',
  aprovado: 'Aprovado',
  contratado: 'Contratado',
  escriturado: 'Escriturado',
  concluido: 'Concluido',
  recusado: 'Recusado',
  desistencia: 'Desistencia',
  expirado: 'Expirado',
}

export const CREDIT_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  novo:                { bg: 'bg-sky-100',     text: 'text-sky-800',     dot: 'bg-sky-500' },
  recolha_docs:        { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500' },
  analise_financeira:  { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-500' },
  submetido_bancos:    { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  pre_aprovado:        { bg: 'bg-indigo-100',  text: 'text-indigo-800',  dot: 'bg-indigo-500' },
  aprovado:            { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  contratado:          { bg: 'bg-teal-100',    text: 'text-teal-800',    dot: 'bg-teal-500' },
  escriturado:         { bg: 'bg-violet-100',  text: 'text-violet-800',  dot: 'bg-violet-500' },
  concluido:           { bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-500' },
  recusado:            { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500' },
  desistencia:         { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  expirado:            { bg: 'bg-gray-100',    text: 'text-gray-700',    dot: 'bg-gray-400' },
}

// Pipeline do pedido — ordem visual para Kanban/Stepper
export const CREDIT_STATUS_PIPELINE: string[] = [
  'novo',
  'recolha_docs',
  'analise_financeira',
  'submetido_bancos',
  'pre_aprovado',
  'aprovado',
  'contratado',
  'escriturado',
  'concluido',
]

// === Status da Proposta ===

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  submetida: 'Submetida',
  em_analise: 'Em Analise',
  pre_aprovada: 'Pre-Aprovada',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  expirada: 'Expirada',
  aceite: 'Aceite pelo Cliente',
  contratada: 'Contratada',
}

export const PROPOSAL_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  rascunho:     { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  submetida:    { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  em_analise:   { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500' },
  pre_aprovada: { bg: 'bg-indigo-100',  text: 'text-indigo-800',  dot: 'bg-indigo-500' },
  aprovada:     { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  recusada:     { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500' },
  expirada:     { bg: 'bg-gray-100',    text: 'text-gray-700',    dot: 'bg-gray-400' },
  aceite:       { bg: 'bg-teal-100',    text: 'text-teal-800',    dot: 'bg-teal-500' },
  contratada:   { bg: 'bg-green-100',   text: 'text-green-800',   dot: 'bg-green-500' },
}

// === Status do Documento ===

export const CREDIT_DOC_STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  solicitado: 'Solicitado',
  recebido: 'Recebido',
  validado: 'Validado',
  rejeitado: 'Rejeitado',
  expirado: 'Expirado',
}

export const CREDIT_DOC_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  pendente:   { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  solicitado: { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500' },
  recebido:   { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  validado:   { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  rejeitado:  { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500' },
  expirado:   { bg: 'bg-gray-100',    text: 'text-gray-700',    dot: 'bg-gray-400' },
}

// === Categorias de Documento ===

export const CREDIT_DOC_CATEGORY_LABELS: Record<string, string> = {
  identificacao: 'Identificacao',
  rendimentos: 'Rendimentos',
  patrimonio: 'Patrimonio',
  imovel: 'Imovel',
  fiscal: 'Fiscal',
  empresa: 'Empresa',
  geral: 'Geral',
}

// === Tipo de contrato de trabalho ===

export const EMPLOYMENT_CONTRACT_OPTIONS = [
  { value: 'efetivo', label: 'Contrato Efectivo (sem termo)' },
  { value: 'termo_certo', label: 'Contrato a Termo Certo' },
  { value: 'termo_incerto', label: 'Contrato a Termo Incerto' },
  { value: 'independente', label: 'Trabalhador Independente' },
  { value: 'reformado', label: 'Reformado/Pensionista' },
  { value: 'outro', label: 'Outro' },
] as const

// === Finalidade do imovel ===

export const PROPERTY_PURPOSE_OPTIONS = [
  { value: 'habitacao_propria_permanente', label: 'Habitacao Propria Permanente' },
  { value: 'habitacao_propria_secundaria', label: 'Habitacao Propria Secundaria' },
  { value: 'investimento', label: 'Investimento' },
] as const

// === Tipo de taxa ===

export const RATE_TYPE_OPTIONS = [
  { value: 'variavel', label: 'Taxa Variavel (Euribor + Spread)' },
  { value: 'fixa', label: 'Taxa Fixa' },
  { value: 'mista', label: 'Taxa Mista (fixa + variavel)' },
] as const

// === Origem do capital ===

export const CAPITAL_ORIGIN_OPTIONS = [
  { value: 'poupanca', label: 'Poupanca' },
  { value: 'venda_imovel', label: 'Venda de Imovel' },
  { value: 'doacao', label: 'Doacao' },
  { value: 'heranca', label: 'Heranca' },
  { value: 'outro', label: 'Outro' },
] as const

// === Tipo de actividade ===

export const CREDIT_ACTIVITY_TYPE_OPTIONS = [
  { value: 'nota', label: 'Nota', icon: 'FileText' },
  { value: 'chamada_banco', label: 'Chamada ao Banco', icon: 'Phone' },
  { value: 'chamada_cliente', label: 'Chamada ao Cliente', icon: 'Phone' },
  { value: 'email_banco', label: 'Email ao Banco', icon: 'Mail' },
  { value: 'email_cliente', label: 'Email ao Cliente', icon: 'Mail' },
  { value: 'reuniao', label: 'Reuniao', icon: 'Users' },
  { value: 'documento_recebido', label: 'Documento Recebido', icon: 'FileCheck' },
  { value: 'documento_enviado', label: 'Documento Enviado', icon: 'Send' },
  { value: 'proposta_recebida', label: 'Proposta Recebida', icon: 'FileSpreadsheet' },
  { value: 'avaliacao_imovel', label: 'Avaliacao do Imovel', icon: 'Home' },
  { value: 'escritura', label: 'Escritura', icon: 'FileSignature' },
] as const

// === Bancos portugueses (valores por defeito) ===

export const DEFAULT_PORTUGUESE_BANKS = [
  'CGD',
  'Millennium BCP',
  'Novo Banco',
  'BPI',
  'Santander',
  'Bankinter',
  'Credito Agricola',
  'Montepio',
  'EuroBic',
  'Banco CTT',
  'UCI',
  'Cofidis',
] as const

// === Euribor referencias ===

export const EURIBOR_REFERENCE_OPTIONS = [
  { value: 'Euribor 3M', label: 'Euribor 3 Meses' },
  { value: 'Euribor 6M', label: 'Euribor 6 Meses' },
  { value: 'Euribor 12M', label: 'Euribor 12 Meses' },
] as const

// === Limites regulatorios (medidas macroprudenciais BdP — Recomendacao 1/2018, rev. 2023) ===

export const CREDIT_LIMITS = {
  // DSTI — Debt Service-to-Income (taxa de esforco)
  TAXA_ESFORCO_MAX: 50,             // % — limite maximo BdP (excepcoes ate 20% da carteira)
  TAXA_ESFORCO_RECOMENDADO: 35,     // % — valor de referencia para bom perfil
  TAXA_ESFORCO_ALERTA: 40,          // % — alerta amarelo

  // LTV — Loan-to-Value (conforme finalidade do imovel)
  LTV_MAX_HPP: 90,                   // % — Habitacao Propria Permanente
  LTV_MAX_HPS: 80,                   // % — Habitacao Propria Secundaria / ferias
  LTV_MAX_INVESTIMENTO: 70,          // % — Investimento / arrendamento
  LTV_MAX_TERRENO: 50,               // % — Credito para terrenos

  // Prazo — maturidade maxima (medidas BdP)
  PRAZO_MAX_ANOS: 40,                // anos — limite absoluto legal
  PRAZO_RECOMENDADO_ATE_30: 40,      // anos — se mutuario ate 30 anos de idade
  PRAZO_RECOMENDADO_30_35: 37,       // anos — se mutuario entre 30 e 35 anos
  PRAZO_RECOMENDADO_MAIS_35: 35,     // anos — se mutuario > 35 anos
  IDADE_MAX_FIM_CONTRATO: 75,        // anos — idade maxima no final do contrato

  // Minimo de propostas (DL 81-C/2017 — intermediacao de credito)
  MIN_PROPOSTAS_REGULATORIO: 3,      // minimo legal de propostas a apresentar ao cliente

  // Impostos Portugal
  IMPOSTO_SELO_CREDITO: 0.006,       // 0,6% sobre o montante do credito (pago uma vez)
  IMPOSTO_SELO_JUROS: 0.04,          // 4% sobre juros de cada prestacao
  IMPOSTO_SELO_COMISSOES: 0.04,      // 4% sobre comissoes bancarias

  // Euribor referencias padrao
  EURIBOR_PERIODO_DEFAULT: 6,        // meses — Euribor 6M e o mais comum em Portugal
} as const
```

---

## 9. Paginas e Componentes

### 9.1 Estrutura de Ficheiros

```
app/dashboard/credito/
├── layout.tsx                              ← PermissionGuard module="credit"
├── page.tsx                                ← DASHBOARD: KPIs, alertas, pipeline breakdown, actividade recente
├── pedidos/page.tsx                        ← Pipeline/Lista de pedidos com filtros
├── novo/page.tsx                           ← Criar pedido de credito (multi-step)
├── simulador/page.tsx                      ← Simulador publico (sem pedido associado)
├── bancos/page.tsx                         ← Gestao de bancos e protocolos
└── [id]/
    ├── page.tsx                            ← Detalhe do pedido (tabs: Resumo, Propostas, Documentos, Simulacoes, Actividade)
    └── editar/page.tsx                     ← Edicao do pedido

app/api/credit/
├── route.ts                                ← GET (listagem) + POST (criar)
├── dashboard/route.ts                      ← GET (KPIs, alertas, stats)
├── simulate/route.ts                       ← POST (calculo stateless)
├── banks/
│   ├── route.ts                            ← GET + POST
│   └── [bankId]/route.ts                   ← PUT + DELETE
└── [id]/
    ├── route.ts                            ← GET + PUT + DELETE
    ├── proposals/
    │   ├── route.ts                        ← GET + POST
    │   └── [proposalId]/
    │       ├── route.ts                    ← PUT + DELETE
    │       └── select/route.ts             ← POST
    ├── documents/
    │   ├── route.ts                        ← GET + POST
    │   ├── [docId]/route.ts                ← PUT + DELETE
    │   └── populate/route.ts               ← POST (popular de template banco)
    ├── activities/route.ts                 ← GET + POST
    ├── simulations/route.ts                ← GET + POST (guardar)
    ├── submit-banks/route.ts               ← POST (submeter a bancos)
    ├── approve/route.ts                    ← POST
    ├── refuse/route.ts                     ← POST
    └── cancel/route.ts                     ← POST

components/credit/
├── credit-pipeline.tsx                     ← Vista pipeline/kanban dos pedidos
├── credit-list.tsx                         ← Vista lista/tabela dos pedidos
├── credit-filters.tsx                      ← Filtros (status, intermediario, search)
├── credit-card.tsx                         ← Card do pedido para kanban
├── credit-form.tsx                         ← Formulario de criacao/edicao (multi-step)
├── credit-status-badge.tsx                 ← Badge de status com cor
├── credit-financial-summary.tsx            ← Resumo financeiro do cliente (metricas)
├── credit-proposals-tab.tsx                ← Tab de propostas de banco
├── credit-proposal-form.tsx                ← Formulario de proposta
├── credit-proposal-comparison.tsx          ← Comparacao side-by-side de propostas
├── credit-documents-tab.tsx                ← Tab de checklist documental
├── credit-document-checklist.tsx           ← Checklist visual com progress
├── credit-simulator.tsx                    ← Calculadora de credito interactiva
├── credit-simulation-result.tsx            ← Resultado da simulacao com grafico
├── credit-activity-timeline.tsx            ← Timeline de actividades
├── credit-activity-form.tsx                ← Formulario de nova actividade
├── credit-bank-form.tsx                    ← Formulario de banco
├── credit-bank-list.tsx                    ← Listagem de bancos
├── credit-alerts.tsx                       ← Alertas de prazos/documentos
└── credit-stepper.tsx                      ← Stepper horizontal do pipeline

hooks/
├── use-credit-requests.ts                  ← Listagem com filtros
├── use-credit-request.ts                   ← Detalhe individual
├── use-credit-proposals.ts                 ← CRUD propostas
├── use-credit-documents.ts                 ← CRUD checklist documental
├── use-credit-simulator.ts                 ← Logica de calculo
├── use-credit-banks.ts                     ← Listagem e gestao de bancos
└── use-credit-activities.ts                ← Timeline de actividades

lib/validations/
└── credit.ts                               ← Schemas Zod (seccao 7)

types/
└── credit.ts                               ← Types (seccao 6)
```

### 9.2 Pagina Principal — Listagem (`/dashboard/credito`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Intermediacao de Credito                            [+ Novo Pedido]    │
│                                                                          │
│  [Pipeline | Lista]     Pesquisar...     Status ▼    Intermediario ▼    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  VISTA PIPELINE (default para intermediario):                            │
│                                                                          │
│  Novo(2)  │ Recolha(3)  │ Analise(1)  │ Submetido(4) │ Pre-Aprov(2) │  │
│  ┌──────┐ │ ┌──────┐    │ ┌──────┐    │ ┌──────┐     │ ┌──────┐     │  │
│  │CRED- │ │ │CRED- │    │ │CRED- │    │ │CRED- │     │ │CRED- │     │  │
│  │0042  │ │ │0039  │    │ │0041  │    │ │0035  │     │ │0033  │     │  │
│  │J.Silva│ │ │M.Costa│   │ │A.Santos│  │ │R.Ferr.│    │ │P.Oliv.│    │  │
│  │250k€ │ │ │180k€ │    │ │320k€ │   │ │275k€ │     │ │195k€ │     │  │
│  │●●●○  │ │ │●●○○  │    │ │●●●● │    │ │●●●○  │     │ │●●●● │     │  │
│  │2/8doc│ │ │5/8doc│    │ │8/8doc│    │ │8/8doc │     │ │8/8doc│     │  │
│  └──────┘ │ └──────┘    │ └──────┘    │ └──────┘     │ └──────┘     │  │
│           │ ┌──────┐    │             │ ┌──────┐     │              │  │
│           │ │CRED- │    │             │ │CRED- │     │              │  │
│           │ │0040  │    │             │ │0036  │     │              │  │
│           │ └──────┘    │             │ └──────┘     │              │  │
│                                                                          │
│  ──── Estados terminais ─────────────────────────────────────────────    │
│  Aprovado(3) │ Contratado(2) │ Escriturado(1) │ Concluido(15)          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

  ●●●○ = 3/4 propostas recebidas
  2/8doc = documentos completos
```

**Vista Lista (tabela):**

| Ref. | Cliente | Montante | Prazo | Taxa Esforco | Melhor Spread | Status | Docs | Propostas |
|------|---------|----------|-------|--------------|---------------|--------|------|-----------|
| CRED-2026-0042 | Joao Silva | 250.000€ | 35 anos | 28.5% | 0.85% | Novo | 2/8 | 0/4 |

### 9.3 Detalhe do Pedido — Tabs (`/dashboard/credito/[id]`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Voltar    CRED-2026-0042    [Novo]                                   │
│  Cliente: Joao Silva    Imovel: T3 Parque das Nacoes                    │
│                                                                          │
│  STEPPER:  ● Novo  ● Recolha  ○ Analise  ○ Bancos  ○ Aprovado  ○ ...  │
│                                                                          │
│  [Resumo] [Propostas(4)] [Documentos(2/8)] [Simulacoes] [Actividade]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TAB RESUMO:                                                             │
│  ┌──────────────────────────┐  ┌──────────────────────────┐             │
│  │ PERFIL FINANCEIRO        │  │ CREDITO PRETENDIDO        │             │
│  │ Rendimento: 2.800€       │  │ Montante: 250.000€        │             │
│  │ Encargos: 450€           │  │ Prazo: 35 anos             │             │
│  │ Disponivel: 2.350€       │  │ Tipo taxa: Variavel        │             │
│  │ Taxa esforco: 28.5% ●   │  │ LTV: 83.3%                │             │
│  │ (< 35% ✓)               │  │ Capital proprio: 50.000€   │             │
│  └──────────────────────────┘  └──────────────────────────┘             │
│  ┌──────────────────────────┐  ┌──────────────────────────┐             │
│  │ ALERTAS                  │  │ DADOS DO IMOVEL           │             │
│  │ ⚠ 6 documentos em falta  │  │ T3 Parque das Nacoes      │             │
│  │ ⚠ Proposta CGD expira    │  │ Valor: 300.000€           │             │
│  │   em 12 dias             │  │ Finalidade: HPP            │             │
│  │ ✓ RGPD consentido        │  │ [Ver Imovel →]            │             │
│  └──────────────────────────┘  └──────────────────────────┘             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Tabs do detalhe:**

| Tab | Conteudo |
|-----|----------|
| **Resumo** | Perfil financeiro, credito pretendido, dados imovel, alertas, 2o titular |
| **Propostas** | Lista de propostas por banco + botao comparar + adicionar proposta |
| **Documentos** | Checklist documental com progress bar, upload, status por documento |
| **Simulacoes** | Simulador inline + historico de simulacoes guardadas |
| **Actividade** | Timeline cronologica de todas as interaccoes + formulario de nova actividade |

### 9.4 Formulario de Criacao — Multi-Step (`/dashboard/credito/novo`)

**Step 1 — Cliente e Negocio:**
- Select de lead (autocomplete por nome/email/NIF)
- Select de negocio (se o lead tiver negocios activos)
- Select de imovel (se aplicavel)
- Pre-preenchimento automatico dos dados do negocio

**Step 2 — Dados Financeiros (Titular 1):**
- Rendimento mensal liquido, rendimento anual bruto
- Entidade patronal, tipo de contrato, antiguidade
- Outros rendimentos e fonte
- Toggle "Tem 2o titular" → mostra campos duplicados

**Step 3 — Encargos e Capital:**
- Creditos existentes, cartoes, pensao de alimentos, outros
- Despesas fixas mensais
- Capital proprio e origem
- Toggle "Tem fiador"

**Step 4 — Credito Pretendido:**
- Valor do imovel / valor de avaliacao
- Montante solicitado (com calculo automatico do LTV)
- Prazo (anos), tipo de taxa
- Finalidade do imovel
- **Resumo automatico:** taxa de esforco estimada, LTV, alertas se exceder limites

**Step 5 — Consentimento e Confirmacao:**
- Checkbox RGPD (obrigatorio)
- Resumo de todos os dados introduzidos
- Botao "Criar Pedido de Credito"

### 9.5 Componente: `credit-proposal-comparison.tsx`

Comparacao side-by-side das propostas aprovadas:

```
┌─────────────────────────────────────────────────────────────────────┐
│  COMPARAR PROPOSTAS                                    [Fechar]     │
│                                                                      │
│                   │  CGD          │  BPI          │  Millennium     │
│  ─────────────────┼───────────────┼───────────────┼─────────────── │
│  Montante         │  245.000€     │  250.000€     │  240.000€      │
│  Prazo            │  35 anos      │  35 anos      │  30 anos       │
│  Spread           │  0.85%        │  0.95%        │  0.75% ★       │
│  TAEG             │  4.12%        │  4.22%        │  4.15%         │
│  Prestacao mensal │  987€         │  1.012€       │  1.045€        │
│  MTIC             │  415.540€     │  424.840€ ⚠   │  376.200€ ★   │
│  LTV              │  81.7%        │  83.3%        │  80.0%         │
│  Seguro vida      │  45€/mes      │  38€/mes ★    │  52€/mes       │
│  Seguro MR        │  280€/ano     │  320€/ano     │  290€/ano      │
│  Custos iniciais  │  1.850€       │  2.100€       │  1.500€ ★      │
│  ─────────────────┼───────────────┼───────────────┼─────────────── │
│  Condicoes        │  Domic.sal    │  Domic.sal    │  Domic.sal     │
│                   │  Cart. cred.  │               │  PPR 50€/mes   │
│  Validade         │  19/04/2026   │  25/04/2026   │  15/04/2026 ⚠  │
│  ─────────────────┼───────────────┼───────────────┼─────────────── │
│                   │  [Aceitar]    │  [Aceitar]    │  [Aceitar]     │
│                                                                      │
│  ★ = melhor valor na categoria    ⚠ = alerta                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.6 Componente: `credit-document-checklist.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  DOCUMENTOS    6/12 completos                    [Popular ▼]     │
│  ████████░░░░░░░░░░░░░ 50%                                       │
│                                                                    │
│  IDENTIFICACAO                                                     │
│  ✓ Cartao de Cidadao — Titular 1              Validado            │
│  ✓ Cartao de Cidadao — Titular 2              Recebido            │
│                                                                    │
│  RENDIMENTOS                                                       │
│  ✓ Ultimo recibo de vencimento — T1           Validado            │
│  ✓ Declaracao entidade patronal — T1          Recebido            │
│  ○ Ultimo recibo de vencimento — T2           Pendente  [Upload]  │
│  ○ Declaracao entidade patronal — T2          Pendente  [Upload]  │
│                                                                    │
│  FISCAL                                                            │
│  ✓ Declaracao IRS 2025 + Nota Liquidacao      Validado            │
│  ○ Declaracao IRS 2025 — Titular 2            Solicitado          │
│                                                                    │
│  PATRIMONIO                                                        │
│  ✓ Mapa responsabilidades Banco Portugal      Recebido            │
│  ○ Extractos bancarios 3 meses               Pendente  [Upload]  │
│                                                                    │
│  IMOVEL                                                            │
│  ○ Caderneta predial                          Pendente  [Upload]  │
│  ○ Certidao permanente                        Pendente  [Upload]  │
│                                                                    │
│  Bancos:  ☑ CGD  ☑ BPI  ☑ Millennium  (filtrar por exigencia)    │
└──────────────────────────────────────────────────────────────────┘
```

O botao **[Popular]** abre um dropdown com os bancos configurados. Ao seleccionar um banco, popula a checklist com os documentos exigidos por esse banco (via `POST /api/credit/[id]/documents/populate`).

---

## 10. Simulador de Credito

### 10.1 Pagina Standalone (`/dashboard/credito/simulador`)

Acessivel sem ter um pedido de credito. Permite ao intermediario fazer simulacoes rapidas com clientes.

### 10.2 Componente: `credit-simulator.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  SIMULADOR DE CREDITO HABITACAO                                   │
│                                                                    │
│  Valor do Imovel        [  300.000  ] €                           │
│  Capital Proprio        [   50.000  ] €                           │
│  Montante do Credito    [  250.000  ] €   (automatico)            │
│  Prazo                  [    35     ] anos  ──●──────── slider     │
│  Indexante              [ Euribor 6M ▼ ]   [  2.90  ] %          │
│  Spread                 [    0.95   ] %                           │
│  Taxa Total             3,85% (Euribor + Spread)                  │
│  Revisao de Taxa        A cada 6 meses                            │
│  Rendimento Mensal      [   2.800   ] €   (opcional)              │
│                                                                    │
│  ─────── RESULTADO ──────────────────────────────────────────     │
│                                                                    │
│  Prestacao Mensal          987,42 €                                │
│  Encargo Mensal Total      1.062 €  (c/ seguros estimados)        │
│  Total de Juros            164.517 €                               │
│  MTIC (BdP)               438.250 €  (inclui IS + seguros)       │
│  LTV                       83,3%          ⚠ > 80% (HPS/INV)      │
│  Taxa de Esforco           37,9%          ⚠ > 35% (rec. BdP)    │
│                                                                    │
│  ─────── CUSTOS PORTUGAL ────────────────────────────────────     │
│  IS sobre credito (0,6%)   1.500 €   (pago uma vez)              │
│  IS sobre juros (4%)       6.581 €   (ao longo do prazo)         │
│  Seguro vida estimado      75 €/mes                               │
│  Seguro multirriscos       300 €/ano                              │
│                                                                    │
│  [Ver Tabela Amortizacao]  [Guardar Simulacao]  [Exportar PDF]    │
│                                                                    │
│  ─────── STRESS TEST EURIBOR ────────────────────────────────     │
│  E se a Euribor subir? (spread fixo: 0,95%)                      │
│                                                                    │
│  Euribor│ Actual    │ +1pp       │ +2pp       │ +3pp              │
│  Taxa   │ 2.90%     │ 3.90%      │ 4.90%      │ 5.90%            │
│  Total  │ 3.85%     │ 4.85%      │ 5.85%      │ 6.85%            │
│  Prest. │ 987€      │ 1.108€     │ 1.237€     │ 1.373€           │
│  Var.   │ —         │ +121€      │ +250€      │ +386€            │
│  T.Esf. │ 37.9%     │ 42.5% ⚠   │ 47.4% ⚠   │ 52.6% ⚠⚠        │
│                                                                    │
│  ─────── COMPARAR PROPOSTAS BANCO ───────────────────────────     │
│  [+ Adicionar Cenario]                                             │
│                                                                    │
│        │ CGD       │ BPI        │ Millennium                      │
│  Spread│ 0.95%     │ 0.75%      │ 1.10%                          │
│  Prazo │ 35 anos   │ 30 anos    │ 35 anos                        │
│  Prest.│ 987€      │ 1.045€     │ 1.024€                         │
│  MTIC  │ 438.250€  │ 394.800€ ★ │ 452.100€                      │
│  T.Esf.│ 37.9%     │ 40.1% ⚠   │ 39.3% ⚠                       │
└──────────────────────────────────────────────────────────────────┘
```

### 10.3 Logica de Calculo (`lib/credit/simulator.ts`)

```typescript
// lib/credit/simulator.ts

export interface SimulationParams {
  valorImovel: number
  montanteCredito: number
  prazoAnos: number
  taxaJuroAnual: number        // Euribor + spread, ex: 3.85 (%)
  rendimentoMensal?: number
  // Nota: taxaJuroAnual = euribor + spread
  // O frontend envia euribor e spread separados, a API soma-os
}

export interface SimulationOutput {
  prestacaoMensal: number
  totalJuros: number
  mtic: number                             // Montante Total Imputado ao Consumidor (BdP)
  ltv: number
  capitalProprio: number
  taxaEsforco?: number
  // Custos especificos Portugal
  impostoSeloCredito: number               // 0,6% sobre o montante (pago uma vez)
  totalImpostoSeloJuros: number            // 4% IS sobre juros (acumulado)
  seguroVidaMensalEstimado: number
  seguroMultirriscosAnualEstimado: number
  encargoCreditoMensal: number             // prestacao + seguros (para taxa de esforco)
  tabelaAmortizacao: AmortizationRow[]
}

/**
 * Sistema de amortizacao portugues — prestacoes constantes com revisao periodica.
 *
 * Em Portugal, o credito habitacao funciona assim:
 * 1. A prestacao e constante entre revisoes de taxa (3M, 6M ou 12M)
 * 2. A cada revisao, recalcula-se com a nova Euribor + spread fixo
 * 3. Para simulacao, assume-se taxa constante (cenario base)
 * 4. O MTIC inclui: capital + juros + IS sobre credito + IS sobre juros
 *    + seguros estimados + comissoes bancarias
 *
 * Impostos especificos de Portugal:
 * - IS sobre utilizacao de credito: 0,6% do montante (pago uma vez)
 * - IS sobre juros: 4% sobre os juros de cada prestacao
 */
export function calculateMortgage(params: SimulationParams): SimulationOutput {
  const { valorImovel, montanteCredito, prazoAnos, taxaJuroAnual, rendimentoMensal } = params

  const capitalProprio = valorImovel - montanteCredito
  const taxaMensal = taxaJuroAnual / 100 / 12
  const nPrestacoes = prazoAnos * 12
  const ltv = (montanteCredito / valorImovel) * 100

  // Prestacao constante (sistema portugues — recalculada a cada revisao de Euribor,
  // mas para simulacao assume-se taxa constante ao longo do prazo)
  let prestacaoMensal: number
  if (taxaMensal === 0) {
    prestacaoMensal = montanteCredito / nPrestacoes
  } else {
    prestacaoMensal = montanteCredito *
      (taxaMensal * Math.pow(1 + taxaMensal, nPrestacoes)) /
      (Math.pow(1 + taxaMensal, nPrestacoes) - 1)
  }

  // Tabela de amortizacao completa
  const tabelaAmortizacao: AmortizationRow[] = []
  let capitalEmDivida = montanteCredito
  let totalJuros = 0
  let totalImpostoSeloJuros = 0

  for (let mes = 1; mes <= nPrestacoes; mes++) {
    const jurosMes = capitalEmDivida * taxaMensal
    const capitalMes = prestacaoMensal - jurosMes
    const isJurosMes = jurosMes * 0.04  // IS sobre juros: 4% (Portugal)
    capitalEmDivida -= capitalMes
    totalJuros += jurosMes
    totalImpostoSeloJuros += isJurosMes

    tabelaAmortizacao.push({
      mes,
      prestacao: Math.round(prestacaoMensal * 100) / 100,
      capital: Math.round(capitalMes * 100) / 100,
      juros: Math.round(jurosMes * 100) / 100,
      impostoSeloJuros: Math.round(isJurosMes * 100) / 100,
      capitalEmDivida: Math.max(0, Math.round(capitalEmDivida * 100) / 100),
    })
  }

  // Custos unicos (Portugal)
  const impostoSeloCredito = montanteCredito * 0.006  // IS utilizacao credito: 0,6%

  // Estimativa de seguros (valores medios Portugal — o utilizador pode ajustar)
  const seguroVidaMensalEstimado = (montanteCredito / 1000) * 0.30  // ~0,30€ por 1000€
  const seguroMultirriscosAnualEstimado = valorImovel * 0.001        // ~0,1% do valor

  // MTIC — Montante Total Imputado ao Consumidor (conforme regulamento BdP)
  // Inclui: prestacoes + IS credito + IS juros + seguros ao longo do prazo
  const totalPrestacoes = prestacaoMensal * nPrestacoes
  const totalSeguros = (seguroVidaMensalEstimado * nPrestacoes) +
                       (seguroMultirriscosAnualEstimado * prazoAnos)
  const mtic = totalPrestacoes + impostoSeloCredito + totalImpostoSeloJuros + totalSeguros

  // Taxa de esforco (recomendacao macroprudencial BdP: max 50%, alerta a 35%)
  // Inclui prestacao + seguros mensais como encargo
  const encargoCreditoMensal = prestacaoMensal + seguroVidaMensalEstimado +
                                (seguroMultirriscosAnualEstimado / 12)
  const taxaEsforco = rendimentoMensal
    ? (encargoCreditoMensal / rendimentoMensal) * 100
    : undefined

  return {
    prestacaoMensal: Math.round(prestacaoMensal * 100) / 100,
    totalJuros: Math.round(totalJuros * 100) / 100,
    mtic: Math.round(mtic * 100) / 100,
    ltv: Math.round(ltv * 100) / 100,
    capitalProprio,
    taxaEsforco: taxaEsforco ? Math.round(taxaEsforco * 100) / 100 : undefined,
    // Custos Portugal
    impostoSeloCredito: Math.round(impostoSeloCredito * 100) / 100,
    totalImpostoSeloJuros: Math.round(totalImpostoSeloJuros * 100) / 100,
    seguroVidaMensalEstimado: Math.round(seguroVidaMensalEstimado * 100) / 100,
    seguroMultirriscosAnualEstimado: Math.round(seguroMultirriscosAnualEstimado * 100) / 100,
    encargoCreditoMensal: Math.round(encargoCreditoMensal * 100) / 100,
    tabelaAmortizacao,
  }
}

/**
 * Simulacao com revisao de Euribor (cenarios de stress test).
 * Recalcula a prestacao a cada periodo de revisao com uma nova taxa.
 *
 * Usado para mostrar ao cliente: "Se a Euribor subir para X%, a sua prestacao passa a Y€"
 */
export function calculateWithEuriborRevision(params: {
  montanteCredito: number
  prazoAnos: number
  spread: number                           // fixo ao longo do contrato
  euriborActual: number                    // taxa Euribor actual
  euriborCenarios: number[]                // ex: [3.0, 4.0, 5.0] — cenarios de subida
  periodoRevisaoMeses: 3 | 6 | 12         // Euribor 3M, 6M ou 12M
}): {
  cenarioBase: { prestacao: number; totalJuros: number }
  cenarios: { euribor: number; prestacao: number; totalJuros: number; variacao: number }[]
} {
  const { montanteCredito, prazoAnos, spread, euriborActual, euriborCenarios } = params

  // Cenario base
  const taxaBase = euriborActual + spread
  const base = calculateMortgage({
    valorImovel: montanteCredito * 1.2,  // estimativa para LTV
    montanteCredito,
    prazoAnos,
    taxaJuroAnual: taxaBase,
  })

  // Cenarios de stress
  const cenarios = euriborCenarios.map(euribor => {
    const taxa = euribor + spread
    const result = calculateMortgage({
      valorImovel: montanteCredito * 1.2,
      montanteCredito,
      prazoAnos,
      taxaJuroAnual: taxa,
    })
    return {
      euribor,
      prestacao: result.prestacaoMensal,
      totalJuros: result.totalJuros,
      variacao: result.prestacaoMensal - base.prestacaoMensal,
    }
  })

  return {
    cenarioBase: { prestacao: base.prestacaoMensal, totalJuros: base.totalJuros },
    cenarios,
  }
}
```

---

## 11. Checklist Documental

### 11.1 Documentos Standard por Categoria

Ao criar um pedido de credito, a checklist pode ser populada automaticamente com base no banco seleccionado (`TEMP_credito_bancos.documentos_exigidos`) ou com uma lista generica.

**Lista generica (todos os bancos exigem):**

| # | Documento | Categoria | Obrigatorio | Titular |
|---|-----------|-----------|-------------|---------|
| 1 | Cartao de Cidadao (frente e verso) | identificacao | Sim | Cada titular |
| 2 | Comprovativo de morada (factura servicos) | identificacao | Sim | titular_1 |
| 3 | Ultima declaracao IRS + Nota de Liquidacao | fiscal | Sim | Cada titular |
| 4 | 3 ultimos recibos de vencimento | rendimentos | Sim | Cada titular |
| 5 | Declaracao da entidade patronal | rendimentos | Sim | Cada titular |
| 6 | Extractos bancarios (3 meses) | patrimonio | Sim | titular_1 |
| 7 | Mapa de responsabilidades Banco de Portugal | patrimonio | Sim | Cada titular |
| 8 | Caderneta predial do imovel | imovel | Sim | titular_1 |
| 9 | Certidao permanente do imovel | imovel | Sim | titular_1 |
| 10 | Planta do imovel | imovel | Nao | titular_1 |
| 11 | CPCV (se ja assinado) | imovel | Nao | titular_1 |
| 12 | Contrato de trabalho (se < 1 ano) | rendimentos | Condicional | Cada titular |

**Documentos adicionais (trabalhador independente):**

| # | Documento | Categoria | Obrigatorio |
|---|-----------|-----------|-------------|
| 13 | Declaracao inicio de actividade | empresa | Sim |
| 14 | Modelo 3 IRS (ultimos 2 anos) | fiscal | Sim |
| 15 | Extractos da conta da empresa (6 meses) | patrimonio | Sim |
| 16 | Declaracao de nao-divida AT e SS | fiscal | Sim |

### 11.2 Auto-Deteccao de Documentos Existentes

Ao popular a checklist, o sistema verifica:

1. `doc_registry` — documentos ja carregados no imovel (caderneta, certidao, planta)
2. `lead_attachments` — documentos ja carregados no lead (CC, IRS)

Se encontrar, cria o `TEMP_credito_documentos` com `doc_registry_id` preenchido e status `recebido`.

---

## 12. Alertas e Prazos

### 12.1 Tipos de Alerta

| Alerta | Condicao | Severidade | Accao |
|--------|----------|------------|-------|
| Aprovacao a expirar | `data_validade_aprovacao` - hoje <= 15 dias | Alta (vermelho se <= 7 dias) | Link para proposta |
| Documentos em falta | Docs obrigatorios com status `pendente` ha > 7 dias | Media | Link para checklist |
| Taxa de esforco elevada | `taxa_esforco` > 50% (limite BdP) ou > 35% (alerta) | Alta se > 50%, Media se > 35% | Mostrar no resumo |
| LTV acima do limite | `ltv_calculado` > limite para a finalidade | Media | Mostrar no resumo |
| Menos de 3 propostas | Total propostas < 3 (regulatorio) | Media | Aviso no submit |
| Escritura proxima | `data_escritura_prevista` - hoje <= 7 dias | Alta | Link para pedido |
| Pedido sem actividade | Ultima actividade ha > 14 dias | Baixa | Lembrete |
| Idade + prazo > 75 anos | idade_titular + prazo_anos > 75 (regra BdP) | Alta | Sugerir reduzir prazo |
| Protocolo a expirar | `TEMP_credito_bancos.protocolo_validade` - hoje <= 30 dias | Baixa | Link para banco |

### 12.2 Componente: `credit-alerts.tsx`

Exibido no detalhe do pedido e no dashboard do intermediario.

```typescript
// Calculo de alertas feito no frontend (dados ja disponiveis no detalhe)
function calculateAlerts(request: CreditRequestWithRelations): Alert[] {
  const alerts: Alert[] = []
  const now = new Date()

  // Aprovacoes a expirar
  for (const proposal of request.propostas) {
    if (proposal.data_validade_aprovacao && proposal.status === 'aprovada') {
      const expiry = new Date(proposal.data_validade_aprovacao)
      const daysLeft = differenceInDays(expiry, now)
      if (daysLeft <= 15) {
        alerts.push({
          type: 'proposal_expiring',
          severity: daysLeft <= 7 ? 'high' : 'medium',
          message: `Aprovacao ${proposal.banco} expira em ${daysLeft} dias`,
          link: proposal.id,
        })
      }
    }
  }

  // Documentos pendentes
  const pendingDocs = request.documentos.filter(d => d.obrigatorio && d.status === 'pendente')
  if (pendingDocs.length > 0) {
    alerts.push({
      type: 'missing_docs',
      severity: 'medium',
      message: `${pendingDocs.length} documento(s) obrigatorio(s) em falta`,
    })
  }

  // Taxa de esforco (limites macroprudenciais BdP)
  if (request.taxa_esforco && request.taxa_esforco > CREDIT_LIMITS.TAXA_ESFORCO_MAX) {
    alerts.push({
      type: 'high_dti',
      severity: 'high',
      message: `Taxa de esforco ${request.taxa_esforco.toFixed(1)}% excede limite BdP de ${CREDIT_LIMITS.TAXA_ESFORCO_MAX}%`,
    })
  } else if (request.taxa_esforco && request.taxa_esforco > CREDIT_LIMITS.TAXA_ESFORCO_RECOMENDADO) {
    alerts.push({
      type: 'elevated_dti',
      severity: 'medium',
      message: `Taxa de esforco ${request.taxa_esforco.toFixed(1)}% acima do valor recomendado de ${CREDIT_LIMITS.TAXA_ESFORCO_RECOMENDADO}%`,
    })
  }

  return alerts
}
```

### 12.3 Integracao com Calendario (M15)

Novos eventos automaticos derivados das tabelas de credito:

```typescript
// Adicionar ao GET /api/calendar/events

// Aprovacoes a expirar
async function fetchCreditDeadlines(supabase, start, end, userId?) {
  const { data } = await supabase
    .from('TEMP_propostas_banco')
    .select(`
      id, banco, data_validade_aprovacao, status,
      TEMP_pedidos_credito!inner(id, reference, assigned_to, lead_id,
        leads(nome)
      )
    `)
    .eq('status', 'aprovada')
    .gte('data_validade_aprovacao', start)
    .lte('data_validade_aprovacao', end)

  return (data || []).map(p => ({
    id: `credit_deadline:${p.id}`,
    title: `Aprovacao ${p.banco} expira — ${p.TEMP_pedidos_credito.reference}`,
    category: 'credit_deadline',
    start_date: p.data_validade_aprovacao,
    all_day: true,
    color: 'teal-500',
    source: 'auto',
    // ... relacoes
  }))
}

// Escrituras previstas
async function fetchCreditEscrituras(supabase, start, end, userId?) {
  const { data } = await supabase
    .from('TEMP_pedidos_credito')
    .select(`
      id, reference, data_escritura_prevista, assigned_to,
      leads(nome)
    `)
    .gte('data_escritura_prevista', start)
    .lte('data_escritura_prevista', end)
    .not('data_escritura_prevista', 'is', null)

  return (data || []).map(p => ({
    id: `credit_escritura:${p.id}`,
    title: `Escritura Credito — ${p.reference}`,
    category: 'credit_escritura',
    start_date: p.data_escritura_prevista,
    all_day: true,
    color: 'violet-500',
    source: 'auto',
    // ... relacoes
  }))
}
```

---

## 13. Dashboard do Intermediario

O modulo de credito possui **duas paginas principais** no sidebar:
- **`/dashboard/credito`** — Dashboard com KPIs, alertas, pipeline breakdown e actividade recente
- **`/dashboard/credito/pedidos`** — Pipeline/Lista de pedidos com filtros

### 13.1 Pagina de Dashboard (`/dashboard/credito`)

**API:** `GET /api/credit/dashboard`

A pagina de abertura do modulo de credito apresenta uma visao geral completa:

```
┌─────────────────────────────────────────────────────────────────┐
│  Intermediacao de Credito                [Ver Pedidos] [+ Novo] │
│                                                                  │
│  ┌── ALERTAS (se existirem) ────────────────────────────────┐   │
│  │ ⚠ Taxa de esforco 42.3% acima do recomendado   CRED-0003│   │
│  │ ⚠ 7 documento(s) obrigatorio(s) pendente(s)             │   │
│  │ ⚠ Proposta BPI expira em 12 dias               CRED-0004│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── ROW 1: VOLUME ─────────────────────────────────────────┐   │
│  │ Pedidos    │ Volume em    │ Volume      │ Taxa de        │   │
│  │ Activos    │ Pipeline     │ Aprovado    │ Aprovacao      │   │
│  │    3       │  €825.000    │  €390.000   │   75%          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── ROW 2: METRICAS ──────────────────────────────────────┐   │
│  │ Melhor     │ Taxa Esforco │ LTV         │ Docs          │   │
│  │ Spread     │ Media        │ Medio       │ Pendentes     │   │
│  │  0.85%     │  32.3%       │  81.1%      │  7 (de 26)    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── ROW 3: 3 COLUNAS ─────────────────────────────────────┐   │
│  │ Pipeline por Estado  │ Propostas por   │ Actividade     │   │
│  │                      │ Banco           │ Recente        │   │
│  │ ● Novo          0   │                 │                │   │
│  │ ● Recolha Docs  1   │ CGD        3    │ CRED-0001      │   │
│  │ ● Analise Fin.  0   │ BCP        2    │ Submetido a    │   │
│  │ ● Submetido     1   │ Bankinter  1    │ bancos         │   │
│  │ ● Pre-Aprovado  1   │ Santander  2    │ Claudia · 3d   │   │
│  │ ● Aprovado      1   │ Novo Banco 1    │                │   │
│  │ ● Contratado    0   │ BPI        2    │ CRED-0004      │   │
│  │ ● Escriturado   0   │                 │ Proposta aceite│   │
│  │ ● Concluido     0   │                 │ Claudia · 5d   │   │
│  │ ○ Recusado      1   │                 │                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── ROW 4: ATALHOS ───────────────────────────────────────┐   │
│  │ Total Propostas     │ Simulador          │ Bancos e     │   │
│  │ 11 em 5 pedidos  → │ Calcular MTIC    → │ Protocolos → │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 KPIs do Dashboard

| KPI | Descricao | Calculo |
|-----|-----------|---------|
| **Pedidos Activos** | N. de pedidos nao terminais | `COUNT WHERE status IN (novo...escriturado)` |
| **Volume em Pipeline** | Montante total solicitado dos activos | `SUM(montante_solicitado) WHERE status activo` |
| **Volume Aprovado** | Montante dos pedidos aprovados+ | `SUM(montante_solicitado) WHERE status IN (aprovado, contratado, escriturado, concluido)` |
| **Taxa de Aprovacao** | % pedidos aprovados vs decididos | `aprovados / (aprovados + recusados) * 100` |
| **Melhor Spread** | Spread mais baixo nas propostas activas | `MIN(spread) WHERE proposal status IN (aprovada, aceite, contratada, pre_aprovada)` |
| **Taxa Esforco Media** | Media da taxa de esforco dos activos | `AVG(taxa_esforco) WHERE status activo AND taxa_esforco NOT NULL` |
| **LTV Medio** | Media do LTV calculado dos activos | `AVG(ltv_calculado) WHERE status activo AND ltv_calculado NOT NULL` |
| **Docs Pendentes** | Docs obrigatorios por resolver | `COUNT WHERE obrigatorio AND status NOT IN (recebido, validado) AND pedido activo` |

### 13.3 Alertas Automaticos

O dashboard calcula e apresenta alertas em tempo real:

| Tipo | Condicao | Severidade |
|------|----------|------------|
| Taxa esforco > 50% | `taxa_esforco > 50` em pedido activo | Urgente (vermelho) |
| Taxa esforco > 35% | `taxa_esforco > 35 AND <= 50` em pedido activo | Aviso (amarelo) |
| Docs pendentes | Existem docs obrigatorios pendentes | Aviso (amarelo) |
| Proposta a expirar | `data_validade_aprovacao` dentro de 15 dias | Urgente (vermelho) |

Cada alerta e clicavel e navega directamente para o detalhe do pedido.

### 13.4 Seccoes do Dashboard

**Pipeline por Estado** — Barra vertical com cada estado do pipeline, contagem e barra de progresso proporcional. Estados terminais (recusado, desistencia) aparecem em opacidade reduzida.

**Propostas por Banco** — Lista dos bancos com total de propostas e badges de aprovadas. Ordenado por total descendente.

**Actividade Recente** — Ultimas 8 actividades de todos os pedidos, com referencia do pedido, tipo, descricao, nome do utilizador e data. Clicavel para navegar ao detalhe.

**Atalhos** — 3 cards de navegacao rapida: Total Propostas (vai para pedidos), Simulador (vai para `/dashboard/credito/simulador`), Bancos e Protocolos (vai para `/dashboard/credito/bancos`).

### 13.5 API Endpoint

```typescript
// GET /api/credit/dashboard
// Retorna:
{
  kpis: {
    total_pedidos: number
    pedidos_activos: number
    pedidos_concluidos: number
    pedidos_recusados: number
    volume_pipeline: number
    volume_aprovado: number
    taxa_aprovacao: number
    melhor_spread: number | null
    taxa_esforco_media: number | null
    ltv_medio: number | null
    docs_pendentes: number
    docs_total: number
    total_propostas: number
  }
  status_counts: Record<string, number>
  bank_stats: Record<string, { total: number; aprovadas: number }>
  alertas: { tipo: 'urgente' | 'aviso' | 'info'; mensagem: string; pedido_id?: string; pedido_ref?: string }[]
  actividades: { id: string; pedido_credito_id: string; pedido_ref: string; user_name: string; tipo: string; descricao: string; created_at: string }[]
}
```

### 13.6 Pagina de Pedidos (`/dashboard/credito/pedidos`)

A pagina de pedidos mantem o toggle Pipeline/Lista com filtros (status, consultor, search) e e acessivel directamente ou via botao "Ver Pedidos" no dashboard.

---

## 14. Comissoes de Credito

### 14.1 Calculo

Os bancos pagam ao intermediario uma comissao sobre o montante do credito formalizado. O calculo e:

```
comissao = montante_contratado * (comissao_percentagem / 100)

Se comissao < comissao_minima → comissao = comissao_minima
Se comissao > comissao_maxima → comissao = comissao_maxima
```

Os valores de `comissao_percentagem`, `comissao_minima` e `comissao_maxima` vem da tabela `TEMP_credito_bancos`.

### 14.2 Vista na Listagem

Adicionar coluna "Comissao Estimada" na listagem de pedidos (visivel apenas para admin/broker):

```
Comissao = montante_aprovado * taxa_comissao_banco
```

### 14.3 Integracao com Comissoes (M11)

Quando o modulo de comissoes for implementado, cada pedido de credito `concluido` gera uma linha na tabela de comissoes:

- Tipo: `comissao_credito`
- Valor: calculado a partir do banco escolhido
- Consultor: `assigned_to` do pedido de credito
- Referencia: `CRED-YYYY-XXXX`

---

## 15. Funcionalidades IA

Reutilizar a integracao OpenAI existente (GPT-4o) para:

### 15.1 OCR de Documentos Financeiros

Reutilizar o padrao de `analyze-document` (M05):

```
POST /api/credit/[id]/analyze-document
```

Aceita imagem/PDF de:
- **Recibo de vencimento** → extrai rendimento liquido, entidade patronal
- **Declaracao IRS** → extrai rendimento bruto anual, deducoes
- **Mapa responsabilidades BdP** → extrai encargos mensais, creditos em curso

Preenche automaticamente os campos financeiros do pedido.

### 15.2 Resumo IA do Pedido

```
GET /api/credit/[id]/summary
```

Gera um resumo textual do pedido para usar em comunicacoes com bancos:

> "Cliente Joao Silva, 38 anos, contrato efectivo ha 8 anos na empresa X, rendimento liquido de 2.800€. Pretende credito de 250.000€ a 35 anos para HPP. Taxa de esforco estimada de 28.5%. Capital proprio de 50.000€ (poupanca). Sem encargos de outros creditos. LTV de 83.3%."

### 15.3 Assistente de Credito (Chat)

```
POST /api/credit/[id]/chat
```

Chat IA contextualizado com os dados do pedido, que pode responder a perguntas como:
- "Qual o melhor banco para este perfil?"
- "O cliente pode reduzir o prazo para 30 anos?"
- "Que documentos faltam para submeter ao BPI?"

---

## 16. Hooks

```typescript
// hooks/use-credit-requests.ts
interface UseCreditRequestsParams {
  status?: string[]
  assignedTo?: string
  search?: string
  page?: number
  perPage?: number
}
interface UseCreditRequestsReturn {
  requests: CreditRequestListItem[]
  total: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}

// hooks/use-credit-request.ts
interface UseCreditRequestReturn {
  request: CreditRequestWithRelations | null
  isLoading: boolean
  error: string | null
  refetch: () => void
  updateRequest: (data: Partial<CreditRequest>) => Promise<void>
  changeStatus: (status: CreditRequestStatus) => Promise<void>
}

// hooks/use-credit-proposals.ts
interface UseCreditProposalsReturn {
  proposals: CreditProposal[]
  isLoading: boolean
  addProposal: (data: CreateProposalInput) => Promise<void>
  updateProposal: (id: string, data: Partial<CreditProposal>) => Promise<void>
  deleteProposal: (id: string) => Promise<void>
  selectProposal: (id: string) => Promise<void>
}

// hooks/use-credit-documents.ts
interface UseCreditDocumentsReturn {
  documents: CreditDocument[]
  isLoading: boolean
  progress: { total: number; completed: number; percentage: number }
  addDocument: (data: CreateCreditDocInput) => Promise<void>
  updateDocument: (id: string, data: Partial<CreditDocument>) => Promise<void>
  uploadFile: (docId: string, file: File) => Promise<void>
  populateFromBank: (bankId: string) => Promise<void>
}

// hooks/use-credit-simulator.ts
interface UseCreditSimulatorReturn {
  result: SimulationOutput | null
  isCalculating: boolean
  calculate: (params: SimulationParams) => void           // calculo local (instantaneo)
  save: (params: SimulationParams, label?: string) => Promise<void>  // guardar no servidor
  savedSimulations: CreditSimulation[]
}

// hooks/use-credit-banks.ts
interface UseCreditBanksReturn {
  banks: CreditBank[]
  isLoading: boolean
  addBank: (data: CreateBankInput) => Promise<void>
  updateBank: (id: string, data: Partial<CreditBank>) => Promise<void>
  deleteBank: (id: string) => Promise<void>
}

// hooks/use-credit-activities.ts
interface UseCreditActivitiesReturn {
  activities: CreditActivity[]
  isLoading: boolean
  hasMore: boolean
  loadMore: () => void
  addActivity: (data: CreateActivityInput) => Promise<void>
}
```

---

## 17. Sidebar e Navegacao

Adicionar ao sidebar principal, na seccao de negocios:

```typescript
{
  title: 'Credito',
  icon: Landmark,              // lucide-react (icone de banco)
  href: '/dashboard/credito',
  permission: 'credit',
}
```

**Sub-itens (se o sidebar suportar):**
- Pedidos (`/dashboard/credito`)
- Simulador (`/dashboard/credito/simulador`)
- Bancos (`/dashboard/credito/bancos`)

---

## 18. Checklist de Implementacao

### Fase A — Base de Dados

- [ ] Criar tabela `TEMP_credito_bancos` (configuracao de bancos)
- [ ] Criar tabela `TEMP_pedidos_credito` (pedidos de credito)
- [ ] Criar tabela `TEMP_propostas_banco` (propostas por banco)
- [ ] Criar tabela `TEMP_credito_documentos` (checklist documental)
- [ ] Criar tabela `TEMP_credito_simulacoes` (historico de simulacoes)
- [ ] Criar tabela `TEMP_credito_actividades` (timeline de actividades)
- [ ] Criar trigger `generate_credit_ref()` para CRED-YYYY-XXXX
- [ ] Inserir dados de bancos portugueses por defeito

### Fase B — Types, Validacoes, Constantes

- [ ] `types/credit.ts` — todos os types
- [ ] `lib/validations/credit.ts` — schemas Zod
- [ ] `lib/constants.ts` — adicionar constantes de credito
- [ ] `lib/credit/simulator.ts` — logica de calculo de credito

### Fase C — API Routes (Core)

- [ ] `GET /api/credit` — listagem com filtros
- [ ] `POST /api/credit` — criar pedido
- [ ] `GET /api/credit/[id]` — detalhe completo
- [ ] `PUT /api/credit/[id]` — actualizar pedido
- [ ] `DELETE /api/credit/[id]` — soft delete
- [ ] `POST /api/credit/[id]/submit-banks` — submeter a bancos
- [ ] `POST /api/credit/[id]/approve` — marcar aprovado
- [ ] `POST /api/credit/[id]/refuse` — marcar recusado
- [ ] `POST /api/credit/[id]/cancel` — desistencia

### Fase D — API Routes (Sub-recursos)

- [ ] `GET/POST /api/credit/[id]/proposals` — CRUD propostas
- [ ] `PUT/DELETE /api/credit/[id]/proposals/[proposalId]`
- [ ] `POST /api/credit/[id]/proposals/[proposalId]/select`
- [ ] `GET/POST /api/credit/[id]/documents` — CRUD checklist
- [ ] `PUT/DELETE /api/credit/[id]/documents/[docId]`
- [ ] `POST /api/credit/[id]/documents/populate` — popular de template banco
- [ ] `POST /api/credit/[id]/documents/[docId]/upload` — upload ficheiro
- [ ] `POST /api/credit/simulate` — simulacao avulsa
- [ ] `GET/POST /api/credit/[id]/simulations` — simulacoes guardadas
- [ ] `GET/POST /api/credit/[id]/activities` — timeline

### Fase E — API Routes (Bancos)

- [ ] `GET/POST /api/credit/banks` — CRUD bancos
- [ ] `PUT/DELETE /api/credit/banks/[bankId]`

### Fase F — Hooks

- [ ] `hooks/use-credit-requests.ts`
- [ ] `hooks/use-credit-request.ts`
- [ ] `hooks/use-credit-proposals.ts`
- [ ] `hooks/use-credit-documents.ts`
- [ ] `hooks/use-credit-simulator.ts`
- [ ] `hooks/use-credit-banks.ts`
- [ ] `hooks/use-credit-activities.ts`

### Fase G — Componentes

- [ ] `credit-pipeline.tsx` — vista kanban dos pedidos
- [ ] `credit-list.tsx` — vista tabela
- [ ] `credit-filters.tsx` — filtros
- [ ] `credit-card.tsx` — card para kanban
- [ ] `credit-form.tsx` — formulario multi-step
- [ ] `credit-status-badge.tsx` — badge de status
- [ ] `credit-stepper.tsx` — stepper horizontal do pipeline
- [ ] `credit-financial-summary.tsx` — resumo financeiro
- [ ] `credit-proposals-tab.tsx` — tab de propostas
- [ ] `credit-proposal-form.tsx` — formulario de proposta
- [ ] `credit-proposal-comparison.tsx` — comparacao side-by-side
- [ ] `credit-documents-tab.tsx` — tab de documentos
- [ ] `credit-document-checklist.tsx` — checklist visual
- [ ] `credit-simulator.tsx` — calculadora interactiva
- [ ] `credit-simulation-result.tsx` — resultado com metricas
- [ ] `credit-activity-timeline.tsx` — timeline
- [ ] `credit-activity-form.tsx` — formulario de actividade
- [ ] `credit-bank-form.tsx` — formulario de banco
- [ ] `credit-bank-list.tsx` — listagem de bancos
- [ ] `credit-alerts.tsx` — alertas de prazos

### Fase H — Paginas

- [ ] `app/dashboard/credito/layout.tsx` — PermissionGuard
- [ ] `app/dashboard/credito/page.tsx` — listagem pipeline/tabela
- [ ] `app/dashboard/credito/novo/page.tsx` — criacao multi-step
- [ ] `app/dashboard/credito/simulador/page.tsx` — simulador standalone
- [ ] `app/dashboard/credito/bancos/page.tsx` — gestao de bancos
- [ ] `app/dashboard/credito/[id]/page.tsx` — detalhe com tabs
- [ ] `app/dashboard/credito/[id]/editar/page.tsx` — edicao
- [ ] Adicionar item ao sidebar

### Fase I — Integracoes

- [ ] Negocio: botao "Iniciar Pedido de Credito" + badge status
- [ ] Calendario: eventos `credit_deadline`, `credit_escritura`, `credit_followup`
- [ ] Dashboard: cards de KPIs para role `intermediario_credito`
- [ ] Documentos: auto-deteccao de docs existentes no sistema

### Fase J — IA (stretch)

- [ ] `POST /api/credit/[id]/analyze-document` — OCR de docs financeiros
- [ ] `GET /api/credit/[id]/summary` — resumo IA do pedido
- [ ] `POST /api/credit/[id]/chat` — assistente de credito

---

## 19. Fora de Ambito (v1)

- Integracao directa com APIs bancarias (submissao electronica a bancos portugueses)
- Geracao automatica de FINE (Ficha de Informacao Normalizada Europeia, DL 81-C/2017) — prioritario para v2
- Assinatura digital de documentos (Chave Movel Digital / CMD)
- Integracao com Central de Responsabilidades de Credito do Banco de Portugal
- Integracao com Portal das Financas (e-AT) para obter declaracoes IRS
- Multi-moeda (apenas EUR — mercado portugues)
- Credito para construcao ou obras
- Credito pessoal / credito automovel (apenas credito habitacao)
- Notificacoes push / email automatico ao cliente
- Portal do cliente (self-service de upload de documentos)
- Exportacao de dados para contabilidade
- Suporte a mercados fora de Portugal (legislacao, impostos e limites sao exclusivamente portugueses)

### Nota sobre ambito geografico

Este modulo e **exclusivamente para o mercado portugues**. Todos os calculos, impostos, limites regulatorios e documentacao exigida sao baseados na legislacao portuguesa em vigor. Especificamente:
- Imposto de selo: CIST, verba 17.1.4 (credito) e verba 17.3 (juros)
- Limites LTV/DSTI/maturidade: Recomendacao Macroprudencial BdP 1/2018
- Intermediacao de credito: DL 81-C/2017
- Euribor como indexante padrao (mercado interbancario europeu, mas uso regulado em PT)
- Documentacao: modelo portugues (IRS, NIF, Caderneta Predial, Certidao Permanente, etc.)
