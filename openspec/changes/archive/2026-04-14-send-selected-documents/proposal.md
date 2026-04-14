## Why

Utilizadores seleccionam pastas de documentos na biblioteca partilhada (imóveis e processos) e o único atalho da selecção actualmente activo é "Descarregar". O botão "Enviar" existe mas está inactivo. É preciso partilhar documentos com consultor, proprietário ou contactos ad-hoc rapidamente, por Email e/ou WhatsApp, sem sair do ERP e sem descarregar para reenviar manualmente.

## What Changes

- Activar o botão "Enviar" no `BatchActionBar` quando a vista é de **Imóvel** ou **Processo** (outros domínios permanecem com o botão oculto — fora de scope).
- Abrir um diálogo de envio (`SendDocumentsDialog`) com selecção de canais: **Email**, **WhatsApp** ou ambos em simultâneo.
- **Selecção de destinatários** (multi-selecção, por canal):
  - Consultor do imóvel/processo (pré-preenchido com email e telefone quando disponíveis).
  - Proprietário(s) do imóvel (contacto principal primeiro, depois restantes).
  - Contacto(s) ad-hoc (campo livre para email / telefone com validação).
- **Remetente Email**: conta SMTP do utilizador autenticado (`consultant_email_accounts`). Se o utilizador tiver ≥2 contas activas, perguntar qual usar; com 1 conta, usa automaticamente; sem conta, bloqueia o canal com CTA para configurar.
- **Remetente WhatsApp**: instância UaZapi do utilizador (`auto_wpp_instances`). Se o utilizador tiver ≥2 instâncias activas, perguntar qual usar; com 1, usa automaticamente; sem instância, bloqueia o canal com CTA.
- **Payload Email**: assunto editável (default PT-PT com ref. do imóvel/processo), corpo editável, ficheiros anexados como attachments reais (download server-side do R2 e envio via Edge Function `smtp-send` existente).
- **Payload WhatsApp**: mensagem opcional editável, seguida de um envio por ficheiro (media/document) via UaZapi, para cada destinatário resolvido via `/api/whatsapp/resolve-chat`.
- **Envio em massa**: submit dispara todos os destinatários e canais em paralelo server-side; o diálogo mostra progresso por destinatário/canal (enviado / falhou) e permite "Tentar novamente" apenas nos que falharam.
- **Auditoria**: registar cada envio em `log_audit` com entidade de origem (property/process), lista de ficheiros, destinatários e canais.
- Novo endpoint `POST /api/documents/send` que orquestra o envio (sem expor contas SMTP/instâncias ao cliente).

## Capabilities

### New Capabilities
- `document-send`: envio multi-canal (Email + WhatsApp) de pastas/ficheiros seleccionados na biblioteca partilhada de documentos, com selecção de destinatários (consultor/proprietário/ad-hoc) e selecção de remetente (conta SMTP / instância WhatsApp) quando o utilizador tem múltiplos.

### Modified Capabilities
- `document-folders-ui`: o `BatchActionBar` passa a expor um callback `onSend` (actualmente inactivo) e o botão "Enviar" é activado apenas quando o domínio é `properties` ou `processes` e existe pelo menos 1 pasta seleccionada com ≥1 ficheiro.

## Impact

- **UI**: `components/documents/batch-action-bar.tsx`, `components/documents/documents-grid.tsx` (passar `onSend` por props), `components/properties/property-documents-folders-view.tsx`, `components/processes/process-documents-manager.tsx` (ligar handler); novo `components/documents/send-documents-dialog.tsx` + sub-componentes (selector de destinatários, selector de conta/instância, barra de progresso).
- **API**: novo `app/api/documents/send/route.ts` (orquestra Email + WhatsApp). Reutiliza:
  - `/lib/email/resolve-account.ts` e Edge Function `smtp-send` (já existe).
  - `auto_wpp_instances` + UaZapi (token e endpoint de envio de media).
  - `/api/whatsapp/resolve-chat` para resolver telefone → `chat_id` + `instance_id`.
- **DB**: nenhuma migração nova. Auditoria usa `log_audit` existente.
- **Infra**: downloads dos ficheiros para attachment fazem-se server-side via R2 público (já disponível), respeitando limites de tamanho do SMTP (avisar se >25MB combinado).
- **Permissões**: módulo existente — gated pela permissão já aplicada às páginas de Imóveis/Processos.
- **Dependências**: nenhuma nova. Reutiliza `nodemailer` (já via Edge Function) e UaZapi REST.
