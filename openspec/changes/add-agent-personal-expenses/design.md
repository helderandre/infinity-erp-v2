## Decisões de design

### 1. Tabela separada vs. flag em `company_transactions`

**Optado**: tabela `agent_personal_expenses` separada.

**Alternativa rejeitada**: adicionar `is_personal boolean DEFAULT false` + `agent_id` em `company_transactions`. Vantagens: UI única, hooks reutilizados. Desvantagens fatais:
- Pollui os books — qualquer query de gestão tem de lembrar-se de filtrar `is_personal=false`.
- O fluxo de aprovação e auditoria de `company_transactions` (com `status`, `category` constrangida, `vat_pct DEFAULT 23`, FK a referências de deal_payments/marketing_orders) não bate com despesas pessoais (categorias livres, sem aprovação, sem efeitos contabilísticos).
- RLS combinatória fica complexa (gestão vê `is_personal=false`, próprio vê os seus `is_personal=true`).
- Apagar uma linha pessoal por engano via UI de gestão é catastrófico.

A tabela separada custa ~150 linhas de DDL+endpoints e dá-nos isolamento total de privacidade e simplicidade.

### 2. Categorias livres vs. enum vs. tabela

**Optado**: `text NOT NULL` sem constraint, com lista default no client.

**Alternativas rejeitadas**:
- Enum SQL: rígido, qualquer adição obriga migration.
- Tabela `personal_expense_categories`: overkill para silo pessoal; ainda obrigaria gestão a manter o catálogo.

A lista default cobre 95% dos casos; o restante 5% é tipicamente "Outras" ou um caso pontual ("Ferramenta X específica") onde o consultor prefere escrever directamente. UI: `<Combobox>` com `creatable`.

### 3. Receipt storage — R2 path

`personal-expenses/{agent_id}/{timestamp}-{sanitized-name}` no bucket `public`. Privacidade: o bucket é tecnicamente público (R2 sem Auth), mas o path inclui `agent_id` (UUID) — não é enumerável sem ter referência. **Não** colocamos em bucket público "discoverable". Aceitável para a primeira iteração; se sensibilidade aumentar, mover para signed URLs (já temos infra).

### 4. OCR endpoint — relaxar `requirePermission('financial')` ou criar novo

**Optado**: relaxar. O endpoint `/api/financial/scan-receipt` é stateless (não escreve em DB, só faz a parse) e tem zero lateral effect. Permitir a qualquer consultor não enche os books, e duplicar o endpoint é manutenção dupla do prompt.

**Trade-off**: hoje o broker vê esse endpoint como exclusivo da intake de despesas da empresa. Após relaxar, qualquer um pode chamar. Risco: factura privada de um consultor passar pela API → log da OpenAI? Já está coberto pela política de privacidade do OpenAI Enterprise (data residency UE, no training). Não é regressão.

Adicionar telemetria simples (linha em `log_audit` com `entity_type='ocr_scan'`, `action='scan_receipt'`) para ter pista de uso por consultor.

### 5. Não somar despesas pessoais ao `liquido_mes`

A Visão geral existente tem o KPI `liquido_mes = comissoes_mes − loja_mes + ajustes`. Adicionar despesas pessoais seria mudar a definição contratual desse KPI (que hoje reflecte os books da empresa).

**Optado**: deixar `liquido_mes` intocado e mostrar um KPI **separado** na nova tab — "Líquido após despesas pessoais (mês)" = `liquido_mes − total_despesas_pessoais_mes`. Hint: "Cálculo apenas para a tua visão pessoal — não faz parte da contabilidade da empresa."

### 6. RLS — self-only e gestão não vê

Política única: `USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid())`. Sem excepção para Broker/CEO ou Office Manager. Se gestão precisar de auditar (ex.: investigação de fraude), o caminho é via `service_role` em consulta SQL ad-hoc, não via UI.

Justificação: o produto promete ao consultor que isto é dele. Se o broker conseguir abrir a app dele e ver as suas despesas, perdemos confiança. O gate de privacidade é **a feature**.

### 7. Quota / rate-limit do OCR

OpenAI vision com `gpt-4o-mini` custa ~$0.0015/imagem. 100 consultores × 30 dias × 2 recibos/dia = 6000 chamadas/mês = $9. Sem rate limit é aceitável.

Adicionar guard mínimo: se o mesmo `agent_id` chamar `/scan-receipt` >100 vezes nas últimas 24h, retornar 429. Reset automático. Implementação via `count(*) FROM log_audit WHERE entity_type='ocr_scan' AND user_id=auth.uid() AND created_at > now() - interval '24 hours'`.

### 8. Apagar — regras de retenção (DL 28/2019 art. 19.º)

**Decisão revista** (após pedido do stakeholder de transformar isto em arquivo digital substitutivo):

- **Durante grace period (30 dias após `archived_at`)**: hard delete permitido. Apaga linha + ficheiro R2.
- **Após grace period**: DELETE bloqueado por trigger SQL com mensagem clara. Consultor só pode marcar `archive_status='invalidated'` após 10 anos da data do arquivo.

**Justificação**: o art. 19.º obriga retenção de 10 anos para validade fiscal. O grace period preserva a UX (corrigir erros de OCR, talão duplicado) sem comprometer integridade legal. Após esse período, o arquivo é "selado" e o consultor passa a confiar na ferramenta como substituto do papel.

Trade-off: se o consultor apagar uma despesa por engano dentro do grace period, perde-a. Mitigação: `<AlertDialog>` na UI + log de audit + opção "Confirmar arquivo" antes do tempo (`archive_status='archived'`) para quem quer selar mais cedo.

### 9. Estrutura de UI: tab vs. página própria

**Optado**: nova tab "Despesas pessoais" dentro de `<ConsultorResumo>`.

**Alternativa rejeitada**: rota dedicada `/dashboard/financeiro/despesas-pessoais`. Vantagens: deep-link, mais espaço; desvantagens: mais um clique, fragmenta o P&L pessoal.

Trade-off mitigado: deep-link via `?tab=despesas-pessoais` na rota `/dashboard/financeiro` (já há suporte para `?tab=` no `<Tabs>` do consultor — ver `consultor-resumo.tsx` actual).

### 10. Mobile-first: captura por câmera

A maioria dos consultores tira foto do recibo logo após o evento (almoço, bomba). UI deve favorecer mobile:
- Botão CTA "📷 Tirar foto" usa `<input type="file" accept="image/*" capture="environment">` — abre câmera no telemóvel.
- Após o snap, preview com botão "Refazer" antes do upload.
- Compressão client-side (já temos `browser-image-compression`) — max 1.5MB, longest side 2048px (suficiente para OCR).
- Loading state explícito durante OCR (~3-6s) com mensagem "A ler o recibo..." porque a UX silenciosa parece travada.

### 11. Hash chain — pseudo-blockchain para detecção de tamper

**Optado**: cada linha guarda `archive_chain_hash = SHA-256(prev_chain_hash || row_digest)`. `row_digest = SHA-256(receipt_hash || expense_date || amount_gross || vendor_nif || archived_at_iso)`.

**Garantia**: se um adversário (incluindo `service_role` mal-usado) modificar uma linha antiga, todas as linhas posteriores ficam com chain inválido. Verificação por walk linear é O(n) em ~5ms para 1000 linhas.

**Não-blockchain**: NÃO há nó descentralizado, NÃO há prova de trabalho, NÃO há merkle tree. É um chain hash linear simples — suficiente para detecção, e barato. Se um dia for preciso prova externa (TSA RFC 3161), os timestamps + hashes integram-se trivialmente.

**Recovery**: se a verificação falhar, a linha quebrada é assinalada na UI com badge "⚠ Integridade comprometida" e o consultor é informado. Não bloqueia o uso da app — apenas avisa que aquela linha pode não ser defensável fiscalmente. Em prática, isto só acontece se houver intervenção via SQL directo (service_role) ou bug grave.

### 12. Object lock no R2 — segunda camada além do trigger SQL

**Decisão**: aplicar **R2 Object Lock em modo COMPLIANCE** com retention de 10 anos no prefixo `personal-expenses-archive/`. O trigger SQL é a primeira barreira (visível ao código aplicacional); o Object Lock é a defesa absoluta — nem `service_role` da nossa role consegue apagar até passar o retention.

**Implicações operacionais**:
- Bucket precisa de Object Lock activado à partida (`ObjectLockEnabledForBucket=true`); não pode ser ativado retroactivamente em buckets existentes.
- Sugestão: criar **bucket separado** `infinity-personal-expenses` (ou prefixo num bucket novo) só para isto. Não misturar com o bucket actual `public/imoveis-imagens`.
- Lifecycle rule: zero expiration. Auto-delete OFF.
- Permissões da role API: `s3:PutObject`, `s3:GetObject`, `s3:GetObjectRetention` mas **não** `s3:DeleteObject` no prefix `personal-expenses-archive/*`. O grace-period DELETE escreve só no prefix `personal-expenses-pending/*` (sem lock).

Custo extra: zero — Object Lock é grátis no R2.

### 13. Validação de legibilidade no upload

**Optado**: validar dimensões mínimas no servidor (`width >= 1000 OR height >= 1000`). Se imagem é menor, rejeitar com mensagem "Imagem demasiado pequena para arquivo legal — tira foto mais perto ou com mais resolução."

**Alternativa rejeitada**: validar OCR confidence (rejeitar se IA não conseguir ler). Não viável: é fácil para o consultor ter uma foto perfeita de algo que a IA não interpreta bem (talão antigo, papel térmico desgastado). A legibilidade legal é "para um humano competente", não "para uma IA".

PDFs ficam isentos de validação dimensional (assumem-se renderizáveis em qualquer escala).

## Migration plan

Migrations:
1. **`20260607_agent_personal_expenses_table.sql`** — tabela + RLS + index.
2. **`20260607_agent_personal_expenses_immutability.sql`** — triggers BEFORE UPDATE (`agent_personal_expenses_immutable_archive`) + BEFORE DELETE (`agent_personal_expenses_retention_lock`).

Aplicar em ambiente local primeiro, depois prod. Sem backfill (silo novo, vazio à partida).

**Operação separada de R2** (não SQL):
- Criar bucket `infinity-personal-expenses` com `ObjectLockEnabledForBucket=true`.
- Configurar role API com permissões certas (sem DeleteObject no prefix archive).
- Variáveis novas em `.env.local`:
  ```
  R2_ARCHIVE_BUCKET=infinity-personal-expenses
  R2_ARCHIVE_RETENTION_YEARS=10
  ```

## Sequência de implementação

1. Setup R2 archive bucket + Object Lock (manual, antes do dev).
2. Migrations: tabela + RLS + triggers.
3. Endpoint upload de recibo (R2 + hash + dim validation + return URL).
4. Endpoints CRUD de `agent_personal_expenses` com chain hash.
5. Endpoint `/integrity-check`.
6. Endpoint `/export-archive` (ZIP AT-ready).
7. Endpoint `/[id]/confirm-archive`.
8. Relaxar `/scan-receipt` para `requireAuth()` + telemetria + rate-limit.
9. Componentes UI: `<PersonalExpensesTab>` + `<ReceiptCaptureDialog>` + `<PersonalExpenseDetailSheet>` + `<ArchiveIntegrityBadge>` + `<LegalArchiveDisclaimerBanner>`.
10. Wire na quarta tab de `<ConsultorResumo>`.
11. Smoke test mobile (foto → OCR → review → save → list → integrity check → export).
12. Validação com 5-10 talões reais para fixar threshold de resolução.
