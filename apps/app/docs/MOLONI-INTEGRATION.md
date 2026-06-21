# Moloni — Integração de Faturação

Ligação do ERP ao Moloni (v1 REST API) para emitir as **faturas de comissão da
agência** como documentos fiscais reais (reportados à AT). Portado da integração
de produção do MUBE CRM — ver [`moloni-integration-portable-spec.md`](../../../moloni-integration-portable-spec.md)
na raiz do repo para o detalhe de todos os _gotchas_ da API.

## Âmbito (conjunto completo)

- ✅ **Faturas de comissão da agência** por `deal_payment` (CPCV / Escritura / Contrato).
- ✅ Fluxo **manual, rascunho primeiro**: emitir rascunho (status 0, eliminável)
  → finalizar (status 1, reportada à AT, irreversível).
- ✅ Destinatário **configurável por pagamento** (`agency_invoice_recipient` + NIF).
- ✅ Sincronização idempotente de cliente (por NIF) + criação automática de produto.
- ✅ **Arquivo do PDF no sistema** (R2): no finalize, o PDF é guardado de forma
  durável em R2 (`moloni_pdf_r2_url`); a rota de PDF prefere essa cópia.
- ✅ **Enviar por email**: anexa o PDF e envia pela conta SMTP do utilizador
  (`consultant_email_accounts`); regista `moloni_email_sent_at/to`.
- ✅ **Nota de crédito** (reverte a fatura na AT, com o mapeamento correcto de
  `document_product_id`) **+ anular** (`documentCancel`). Põe `moloni_status=2`.
- ✅ **Recibo** (marcar como paga): cria o Recibo fiscal associado à fatura.
- ✅ Download / visualização do PDF.
- ❌ Fora de âmbito (futuro): faturas de despesa a fornecedores, emissão
  automática/cron, retenção na fonte parametrizável.

## Variáveis de ambiente

Definir no Coolify (não commitar). Conta + app developer já existem
(https://www.moloni.pt/ac/developers/):

```env
MOLONI_DEVELOPER_ID=     # client_id numérico da app developer
MOLONI_CLIENT_SECRET=    # client secret
MOLONI_USERNAME=         # email de login Moloni (password grant) — também usado para escolher a empresa
MOLONI_PASSWORD=         # password Moloni
# NIF_PT_API_KEY já existe — usado para enriquecer dados do cliente por NIF
```

Sem estas variáveis, a UI mostra "Moloni não configurado" e nenhuma chamada é feita.

## Como funciona

1. **Token** — `lib/moloni/client.ts` faz _password grant_ na primeira chamada,
   escolhe a empresa real (ignora a demo ID 5), guarda em `moloni_tokens` e
   auto-renova com buffer de 5 min. Aquisição de token serializada (evita corrida
   de refresh, já que o Moloni rota o refresh_token).
2. **Emitir rascunho** — botão na sheet de gestão (tab _Gestão_ → secção _Moloni_).
   Sincroniza cliente (por NIF), garante o produto "Comissão de intermediação
   imobiliária", cria fatura com `status: 0`, guarda `moloni_document_id`,
   `moloni_status=0`, número e valores em `deal_payments`.
3. **Finalizar** — segundo passo, com confirmação. Emite o documento fechado
   (`status: 1`, reportado à AT), remove o rascunho antigo (best-effort) e busca
   o PDF. **Irreversível** — só reversível por nota de crédito (fase futura).
4. **Eliminar rascunho** — remove o rascunho no Moloni e limpa o estado local
   (só permitido enquanto `status=0`).

Todas as operações fiscais passam por `lib/moloni/idempotency.ts`
(`moloni_idempotency_keys`) — um duplo-clique ou retry nunca emite duas vezes.

## Permissões

Endpoints e server actions exigem `requirePermission('financial')`. Consultores
sem o módulo `financial` não emitem faturas.

## Ficheiros

| Camada | Ficheiro |
|---|---|
| Cliente HTTP + tokens | [`lib/moloni/client.ts`](../lib/moloni/client.ts) |
| Idempotência | [`lib/moloni/idempotency.ts`](../lib/moloni/idempotency.ts) |
| Clientes | [`lib/moloni/customers.ts`](../lib/moloni/customers.ts) |
| Catálogos (taxas/séries/produtos/métodos pagamento) | [`lib/moloni/catalog.ts`](../lib/moloni/catalog.ts) |
| Faturas (insert/delete/cancel/getOne/PDF) | [`lib/moloni/invoices.ts`](../lib/moloni/invoices.ts) |
| Notas de crédito | [`lib/moloni/credit-notes.ts`](../lib/moloni/credit-notes.ts) |
| Recibos | [`lib/moloni/receipts.ts`](../lib/moloni/receipts.ts) |
| Arquivo PDF em R2 | [`lib/moloni/archive-pdf.ts`](../lib/moloni/archive-pdf.ts) |
| Envio por email | [`lib/moloni/send-invoice-email.ts`](../lib/moloni/send-invoice-email.ts) |
| Glue de domínio | [`lib/moloni/issue-agency-invoice.ts`](../lib/moloni/issue-agency-invoice.ts) |
| Server actions | [`app/dashboard/financeiro/deals/moloni-actions.ts`](../app/dashboard/financeiro/deals/moloni-actions.ts) |
| Health check | `GET /api/financial/moloni/status` |
| PDF (prefere R2, fallback Moloni) | `GET /api/financial/moloni/deal-payments/[id]/pdf` |
| UI | secção _Moloni_ em [`components/financial/sheets/mapa-row-sheet.tsx`](../components/financial/sheets/mapa-row-sheet.tsx) |
| Migrations | [`20260629_moloni_integration.sql`](../supabase/migrations/20260629_moloni_integration.sql) + [`20260630_moloni_extensions.sql`](../supabase/migrations/20260630_moloni_extensions.sql) |

## Testar com segurança

Testar **sempre** com `status: 0` (rascunho) primeiro — eliminável livremente.
Documentos `status: 1` são reportados à AT e tornam-se permanentes. Manter um
cliente "Dev/Test" no Moloni para emissões de teste.

## Limitações conhecidas

- **Finalizar = emitir fechado + apagar rascunho.** Evita o _trap_ de
  `invoices/update` com `document_product_id`. Se a limpeza do rascunho falhar,
  fica um rascunho órfão no Moloni (inofensivo, eliminável manualmente) — o
  documento legal já foi criado corretamente.
- Refresh token expira ao fim de 14 dias; o cliente faz fallback para password
  grant automaticamente.
- A escolha da série de documentos usa a primeira (`documentSets[0]`). Se a
  conta tiver várias séries, parametrizar no futuro.
