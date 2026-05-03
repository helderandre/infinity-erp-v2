## Why

Acabámos de abrir o módulo Financeiro aos consultores (`/dashboard/financeiro` + `/dashboard/financeiro/conta-corrente`) — a permissão `commissions` foi concedida aos roles `Consultor`, `Consultora Executiva` e `Team Leader` na migration [20260606_grant_commissions_to_consultor_roles.sql](supabase/migrations/20260606_grant_commissions_to_consultor_roles.sql). O consultor passa a ver o seu P&L pessoal: comissões recebidas, KPIs do mês/ano, próximas entradas e o ledger da conta corrente interna (transacções escrituradas pela empresa: comissões + compras na loja institucional + ajustes manuais).

Falta o outro lado do P&L pessoal: **as despesas reais do consultor para gerar receita** — combustível, refeições com clientes, parking de visitas, brindes para proprietários, telemóvel/dados, ferramentas de marketing fora da loja interna, etc. Hoje o consultor não tem onde registar isto no ERP, por isso:

1. **Não consegue ver o seu lucro líquido real** — a conta corrente interna mostra "loja (mês)" mas isso é só uma fatia das despesas; o resto fica no Excel pessoal de cada um (ou perdido).
2. **Perde recibos físicos** — fotos de talões e facturas ficam dispersas pelo telemóvel, WhatsApp pessoal, gavetas. Não há nenhum local consolidado.
3. **Não pode usar isto para a contabilidade pessoal** — quando o contabilista pede os justificativos no fim do ano, o consultor faz uma caça aos recibos de meses atrás.

A oferta natural do ERP é dar-lhe um espaço pessoal de despesas com uma **foto-para-registo** assistida por IA (já temos [POST /api/financial/scan-receipt](app/api/financial/scan-receipt/route.ts) com GPT-4o-mini para faturas portuguesas) — o consultor tira foto do recibo e o sistema extrai entidade, NIF, valor, IVA, data, descrição. Em <10s tem o registo arquivado.

**Decisão de arquitectura**: estas despesas são **estritamente pessoais** ao consultor — não tocam na contabilidade da empresa, não geram linhas em `company_transactions`, não afectam o `balance_after` da conta corrente, não são vistas por gestão (a menos que seja o próprio a abrir essa vista no portátil dela). O ERP age como cofre pessoal organizado, não como ferramenta de reporting fiscal.

**Conformidade com o art. 19.º do DL 28/2019 (arquivo digital substitutivo)**: o sistema é desenhado para que a foto/PDF do recibo no ERP **substitua legalmente o arquivo em papel**, libertando o consultor da obrigação de guardar talões físicos durante 10 anos. Para isso garantimos os 5 requisitos do art. 19.º: (1) **integridade** via hash SHA-256 da imagem original + chain hash entre linhas (qualquer adulteração detectável); (2) **autenticidade** via timestamp e identidade do `archived_by` imutáveis; (3) **legibilidade** via validação de resolução mínima no upload; (4) **pesquisabilidade** via campos indexados (NIF, data, valor); (5) **retenção 10 anos** via lock de delete após grace period de 30 dias e export AT-ready a qualquer momento. Importante: isto é obrigação de **arquivo**, não de **emissão** — não precisamos de certificação AT (essa só se aplica a software emissor de facturas).

## What Changes

### 1. Tabela `agent_personal_expenses` (nova, isolada da contabilidade)

Schema mínimo necessário, espelho parcial dos campos extraídos pelo `scan-receipt`. **Inclui colunas de arquivo certificável** (hash, chain hash, timestamps imutáveis, status de arquivo) para cumprir os requisitos do art. 19.º do DL 28/2019:

```sql
CREATE TABLE agent_personal_expenses (
  id uuid PK DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,

  -- Metadata fiscal (editável dentro do grace period)
  expense_date date NOT NULL,
  category text NOT NULL,                       -- categoria livre (ver §2)
  description text,
  vendor_name text,                             -- entidade emitente
  vendor_nif text,
  amount_gross numeric(12,2) NOT NULL,          -- valor com IVA
  amount_net numeric(12,2),                     -- valor sem IVA (opcional)
  vat_amount numeric(12,2),
  vat_pct numeric(5,2),
  invoice_number text,
  notes text,

  -- Original archive (IMUTÁVEL após INSERT)
  receipt_url text NOT NULL,                    -- foto/PDF em R2
  receipt_mimetype text NOT NULL,
  receipt_size_bytes bigint NOT NULL,
  receipt_hash text NOT NULL,                   -- SHA-256 (hex) do ficheiro original
  receipt_width_px int,                         -- p/ requisito de legibilidade
  receipt_height_px int,

  -- OCR (auxiliar)
  ocr_confidence numeric(3,2),
  ocr_field_confidences jsonb,

  -- Compliance / arquivo (IMUTÁVEL após INSERT)
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid NOT NULL REFERENCES dev_users(id),
  archive_chain_hash text NOT NULL,             -- SHA-256 (this_digest || prev_chain_hash)
  archive_status text NOT NULL DEFAULT 'pending'
    CHECK (archive_status IN ('pending','archived','invalidated')),
  archive_locked_at timestamptz,                -- quando termina o grace period

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agent_personal_expenses_agent_date
  ON agent_personal_expenses(agent_id, expense_date DESC);
CREATE INDEX idx_agent_personal_expenses_archived_at
  ON agent_personal_expenses(agent_id, archived_at DESC);

ALTER TABLE agent_personal_expenses ENABLE ROW LEVEL SECURITY;
-- self-only read/write; gestão NÃO vê (decisão explícita — privacidade)
CREATE POLICY agent_self_rw ON agent_personal_expenses
  FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Trigger BEFORE UPDATE: bloqueia mutação de colunas de arquivo
CREATE OR REPLACE FUNCTION agent_personal_expenses_immutable_archive()
RETURNS trigger AS $$
BEGIN
  IF (NEW.receipt_url IS DISTINCT FROM OLD.receipt_url
      OR NEW.receipt_hash IS DISTINCT FROM OLD.receipt_hash
      OR NEW.receipt_size_bytes IS DISTINCT FROM OLD.receipt_size_bytes
      OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
      OR NEW.archived_by IS DISTINCT FROM OLD.archived_by
      OR NEW.archive_chain_hash IS DISTINCT FROM OLD.archive_chain_hash
      OR NEW.agent_id IS DISTINCT FROM OLD.agent_id) THEN
    RAISE EXCEPTION 'Colunas de arquivo são imutáveis (DL 28/2019)';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Trigger BEFORE DELETE: bloqueia delete após grace period
CREATE OR REPLACE FUNCTION agent_personal_expenses_retention_lock()
RETURNS trigger AS $$
BEGIN
  IF OLD.archive_status = 'archived'
     AND OLD.archive_locked_at IS NOT NULL
     AND OLD.archive_locked_at <= now() THEN
    RAISE EXCEPTION 'Despesa arquivada — não pode ser eliminada antes dos 10 anos (DL 28/2019)';
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;
```

Nada de FK para `company_transactions`. **Zero participação nos books da empresa**, `balance_after`, KPIs de gestão. É um silo pessoal **com força legal de arquivo**.

### 1.1. Lifecycle do arquivo (3 estados)

```
INSERT → archive_status='pending', archive_locked_at = archived_at + 30 days
   │
   │ (durante 30 dias o consultor pode editar metadata e até apagar — período de "perdão")
   │
   ▼ (após 30 dias OU click "Confirmar arquivo" pelo consultor)
archive_status='archived'  ← imutável; DELETE bloqueado por trigger
   │
   │ (após 10 anos, consultor pode invocar purge manual)
   │
   ▼
archive_status='invalidated' (linha + ficheiro R2 são apagados)
```

A coluna `receipt_url` **NUNCA** muda. O ficheiro no R2 vive em path `personal-expenses-archive/{agent_id}/{yyyy}/{mm}/{hash[:8]}-{name}` e a permissão da nossa role API é write-once (sem `DeleteObject` excepto via service role usado no purge final ou no grace-period DELETE).

### 2. Categorias (livres, com defaults)

Categorias por defeito (10 buckets fixos, multilíngua PT-PT) — apresentadas como autocomplete mas o consultor pode escrever uma categoria nova (texto livre):

- Deslocações & combustível
- Refeições com clientes
- Estacionamento & portagens
- Brindes & atenções
- Telemóvel & dados
- Marketing pessoal
- Material de escritório
- Subscrições & software
- Formação & eventos
- Outras

Implementação: `category` é apenas um `text NOT NULL`; uma constante client-side `DEFAULT_PERSONAL_EXPENSE_CATEGORIES` alimenta o `<Combobox>` mas não há tabela. Mantém-se simples — não é uma taxonomia de empresa.

### 3. Fluxo "Foto-para-registo" (com arquivo certificável)

Reutilizar a infra existente, adicionando os passos de integridade:

1. **Upload da foto/PDF** para R2 — `POST /api/agent-personal-expenses/upload-receipt` (multipart). Valida `image/jpeg|png|webp|heic` ou `application/pdf`, max 10MB. Calcula **SHA-256 server-side** do stream antes de gravar. Lê dimensões da imagem (`image-size` ou similar; PDFs ficam sem dimensões). Valida resolução mínima: lado mais curto ≥ 1000px (heurística para legibilidade — ajustável). Guarda em `personal-expenses-archive/{agent_id}/{yyyy}/{mm}/{hash[:8]}-{sanitized-name}`. Devolve `{ url, mimetype, size_bytes, hash, width_px, height_px }`.

2. **Extracção IA** — reusar [POST /api/financial/scan-receipt](app/api/financial/scan-receipt/route.ts), mas **relaxar a permissão**: actualmente está `requirePermission('financial')` (broker-only). Mudança: aceita também o próprio consultor — `requireAuth()` + log de uso. Os dados extraídos são devolvidos ao cliente, **não escritos automaticamente** — o consultor revê antes de gravar.

3. **Persistência (arquivo)** — `POST /api/agent-personal-expenses` recebe o JSON revisto + `{ receipt_url, receipt_hash, receipt_size_bytes, receipt_width_px, receipt_height_px }`. Antes do INSERT:
   1. Re-valida que o ficheiro existe no R2 e que o hash bate com o reportado pelo cliente (defesa anti-tamper).
   2. Calcula `archive_chain_hash` lendo a última linha em `agent_personal_expenses WHERE agent_id = auth.uid() ORDER BY archived_at DESC LIMIT 1`. Se não existir, usa `'0' x 64`.
   3. `row_digest = SHA-256(receipt_hash || expense_date || amount_gross || vendor_nif || archived_at_iso)`.
   4. `archive_chain_hash = SHA-256(prev_chain_hash || row_digest)`.
   5. Define `archive_locked_at = archived_at + interval '30 days'`.
   6. INSERT com `archive_status='pending'`.
   - Validação Zod completa.

4. **CRUD com regras de retenção**:
   - `GET /api/agent-personal-expenses?from=&to=&category=&page=` — paginado, scoped ao próprio.
   - `PUT /api/agent-personal-expenses/[id]` — edita só metadata (categoria, notas, descrição). Trigger bloqueia mutação das colunas de arquivo. Cada UPDATE escreve linha em `log_audit` com diff dos campos.
   - `DELETE /api/agent-personal-expenses/[id]` — só permitido se `archive_status='pending'` E `now() < archive_locked_at`. Após isso, retorna 409 "Despesa arquivada — não pode ser eliminada (DL 28/2019)". Chama `DeleteObjectCommand` no R2 quando permitido.
   - `POST /api/agent-personal-expenses/[id]/confirm-archive` — atalho opcional para o consultor "selar" antes do grace period acabar (`archive_status='archived'`, define `archive_locked_at=now()`).

5. **Verificação de integridade** — `GET /api/agent-personal-expenses/integrity-check` corre walk do chain por `agent_id`, recalcula cada `archive_chain_hash` e devolve `{ verified: bool, broken_at_id?: uuid, total_rows: int }`. UI mostra badge global "✓ Arquivo íntegro" no header da tab.

6. **Export AT-ready** — `GET /api/agent-personal-expenses/export-archive?from=&to=` produz ZIP com:
   - `manifest.csv` — linhas com todos os campos fiscais + hash + chain hash.
   - `integrity-report.txt` — resultado do `integrity-check` no momento do export.
   - `receipts/YYYY-MM-DD_NIF_NUM.ext` — todos os originais renomeados.
   - `LEIA-ME.txt` — referência ao art. 19.º DL 28/2019, instruções de verificação manual do hash, contacto AT.

### 4. UI no `<VistaConsultor>`

Adicionar uma quarta tab ao `<ConsultorResumo>` (actualmente: Visão geral / Despesas e entradas / Histórico): nova tab **"Despesas pessoais"** que renderiza:

- **Cabeçalho com KPI**: total despesas (mês), total despesas (YTD), nº de recibos arquivados, comparação com comissões ("para cada €1 de comissão, gastaste €X em despesas"). **Badge de integridade** "✓ Arquivo íntegro · X recibos · DL 28/2019" (clicável → modal com explicação legal e link para export AT-ready).
- **Banner informativo (uma vez, dismissível)**: "Os recibos digitalizados aqui substituem o arquivo em papel ao abrigo do art. 19.º do DL 28/2019. Podes destruir os originais."
- **Botão CTA prominente**: "📷 Tirar foto de recibo" (mobile abre câmera; desktop abre file picker).
- **Lista cronológica**: cards/linhas com data + entidade + valor + categoria + thumbnail do recibo. Cada item mostra **status badge**: 🟡 "Editável (até DD/MM)" durante o grace period, 🔒 "Arquivado" depois. Click abre o diálogo de detalhe (foto + campos editáveis se pending + Eliminar se permitido).
- **Filtros leves**: período (mês actual / últimos 3m / ano / custom) e categoria.
- **Botão "Exportar para contabilista"** no header — gera ZIP AT-ready do período filtrado.
- **Gráfico** (opcional na primeira iteração): donut por categoria.

Componentes novos:
- `<PersonalExpensesTab agentId>` — orchestrator + integrity check + export.
- `<ReceiptCaptureDialog>` — duas etapas: (1) upload + scan IA + cálculo de hash; (2) review/edit + save (mostra hash truncado como prova de integridade). Reusa o pattern já em uso em `<DocumentAnalyzer>` e `<DealMarketingMomentCard>`.
- `<PersonalExpenseRow>` — card list-item com status badge (pending/archived).
- `<PersonalExpenseDetailSheet>` — Sheet lateral com foto full-screen + form edit (campos editáveis vs. campos imutáveis claramente distinguidos) + Eliminar (apenas se permitido).
- `<ArchiveIntegrityBadge>` — badge clicável no header com modal explicativo + botão "Verificar agora" que dispara `/integrity-check`.
- `<LegalArchiveDisclaimerBanner>` — banner dismissível, persistido em `localStorage`.

Hooks:
- `usePersonalExpenses({ from, to, category })`
- `usePersonalExpensesIntegrity()` — caches resultado por 5 min.
- `useReceiptScan()` — wraps `/api/financial/scan-receipt`.
- `useReceiptUpload()` — wraps upload + cálculo de hash (também client-side para UI feedback rápido; o server re-valida).

### 5. Garantias de isolamento

- **Não modificar** `conta_corrente_transactions`, `company_transactions`, `deal_payments`, `marketing_orders`. Zero triggers.
- **Não juntar** os totais ao `kpis.liquido_mes` em [/api/financial/consultor-summary](app/api/financial/consultor-summary/route.ts). O consultor verá os totais na nova tab; o `liquido_mes` da Visão geral mantém a definição actual (comissões − loja interna − ajustes), com hint inline a explicar "exclui despesas pessoais".
- **Brokers/gestão não vêem**. RLS acima garante self-only, e nenhum endpoint expõe `agent_id` arbitrário.

## Capabilities

### New Capabilities
- `agent-personal-expenses`: registo pessoal de despesas do consultor com upload de recibo + extracção IA + **arquivo digital substitutivo conforme art. 19.º do DL 28/2019** (hash SHA-256, chain hash, retenção 10 anos, export AT-ready), isolado da contabilidade da empresa.
- `agent-personal-expenses-ui`: tab "Despesas pessoais" em `<VistaConsultor>` com captura por foto, listagem, filtros, KPIs, badge de integridade e export para contabilista.

### Modified Capabilities
- `financial-scan-receipt`: relaxar gate `requirePermission('financial')` para `requireAuth()` (qualquer consultor pode usar OCR para os seus próprios recibos). Resposta inalterada.

## Open Questions

1. **Resolução mínima — 1000px lado curto, é suficiente para legibilidade legal?** A AT não fixa um valor; o guidance é "legível por um humano competente". 1000px cobre talões A6 com texto pequeno. Validar com 5-10 talões reais de bombas/restaurantes antes de fixar o threshold.
2. **Grace period de 30 dias é apropriado?** Permite ao consultor corrigir erros de OCR sem perder integridade do arquivo. Mais curto = mais protecção legal mas mais frustração; mais longo = adversário tem janela maior. 30 dias é a média no setor.
3. **Timestamping com Time Stamping Authority (RFC 3161)?** Hoje uso timestamp do servidor + chain hash. Para defesa absoluta numa fiscalização AT, integrar com TSA externa (ex.: DigiCert, Sectigo) custaria ~€100/ano. Não-bloqueante para v1; arquivo de servidor + chain hash é defensável. Reavaliar se houver fiscalização real ou pedido explícito do contabilista.
4. **R2 Object Lock vs. trigger SQL?** R2 suporta Object Lock (S3-compatible) com modo COMPLIANCE — bloqueia delete absoluto. Mais robusto que trigger SQL (que pode ser ignorado por service_role). Custo: zero. Implementação: adicionar configuração de bucket + lock retention de 10 anos. Sugestão: aplicar como segunda camada além do trigger SQL.
5. **PDFs de e-fatura (sem foto, descarregados do portal AT)?** Sim — o `scan-receipt` já aceita PDF; estender o upload para mimetype `application/pdf`. Para PDFs sem visão (texto puro), GPT-4o-mini lê. Para PDFs scanneados, precisa de fallback para visão (ou rejeitamos com mensagem "PDF sem texto detectável; tira foto da fatura").
6. **HEIC do iPhone?** A conversão HEIC→JPEG já é feita noutros uploads (ver `lib/r2/images.ts`). Reutilizar.
7. **Quem é responsável legal pelo arquivo se houver fiscalização AT — a empresa ou o consultor?** Como o silo é per-agent (RLS) e a obrigação fiscal é pessoal do consultor (Categoria B / sole proprietor), a responsabilidade é dele. O ERP é a ferramenta. Convém ter um T&C explícito a esclarecer isto antes de o consultor "Confirmar arquivo" — texto: "Confirmas que estes recibos cobrem despesas pessoais tuas e que assumes a responsabilidade fiscal pelos mesmos."
8. **Purge após 10 anos — automático ou manual?** Manual (consultor invoca `archive_status='invalidated'`). Automático seria preocupante: e se o consultor estivesse no meio de uma auditoria que dura 11 anos? Purge fica sob controlo dele.
