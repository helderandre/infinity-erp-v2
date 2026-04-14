## Context

A biblioteca partilhada de documentos (`components/documents/`) já suporta selecção múltipla de pastas com `@viselect/react`, download em lote (single/ZIP) e upload. A `BatchActionBar` já expõe "Enviar" como botão visual desactivado — um placeholder colocado à altura do scaffolding. A infra para envio já existe mas está espalhada por domínios distintos:

- **Email**: `consultant_email_accounts` guarda contas SMTP per-utilizador com password encriptada. `/app/api/email/send/route.ts` aceita attachments e chama a Edge Function `smtp-send` (contorna a restrição de portas SMTP do serverless). `/lib/email/resolve-account.ts` decifra a password em runtime.
- **WhatsApp**: `auto_wpp_instances` (UaZapi) guarda instâncias per-utilizador. `/api/whatsapp/resolve-chat` resolve telefone → `chat_id` + `instance_id`. O envio real de texto/media passa hoje pelo `useWhatsAppMessages` do bubble flutuante.

Ambos os domínios Imóvel e Processo consomem a biblioteca partilhada. Imóveis já exibe o toggle Lista/Pastas. Processos usa a vista de pastas como default. Os payloads das pastas derivam via adapters em `lib/documents/adapters/*`.

O contexto da conversa tornou explícito: o envio é um atalho **apenas nos domínios "Imóvel" e "Processo"**; Leads e Negócios estão fora de scope.

## Goals / Non-Goals

**Goals:**
- Activar o botão "Enviar" da `BatchActionBar` em Imóveis e Processos sem alterar o comportamento nos outros domínios.
- Oferecer escolha de canais (Email, WhatsApp ou ambos) e lista de destinatários pré-populada com consultor e proprietário(s) + ad-hoc.
- Reutilizar a infraestrutura SMTP (Edge Function `smtp-send`) e UaZapi já existentes; não duplicar código de envio.
- Permitir ao utilizador escolher entre múltiplas contas/instâncias suas quando aplicável (sem nunca assumir default quando há ambiguidade).
- Mostrar progresso por destinatário e permitir retry granular.
- Registar auditoria de cada envio.

**Non-Goals:**
- Não ampliar o envio a Leads/Negócios (pode vir noutra change).
- Não introduzir um editor rich-text novo para o corpo do email — o corpo é HTML simples com textarea (consistente com o endpoint `/api/email/send` existente).
- Não criar novas tabelas nem novas colunas no DB.
- Não implementar templating avançado de mensagens com variáveis dinâmicas (pode aproveitar `tpl_email_library` em change futura).
- Não suportar agendamento de envio futuro — envio é imediato.
- Não implementar preview de email/WhatsApp renderizado antes de enviar (o utilizador edita directamente).

## Decisions

### D1 — Endpoint único server-side `POST /api/documents/send`

**Decisão**: criar um único endpoint que orquestra Email e WhatsApp, em vez de o cliente chamar `/api/email/send` + loops de UaZapi directamente.

**Porquê**:
- Centraliza validação de ownership de `account_id` / `instance_id`.
- Evita expor o UaZapi token ao browser.
- Permite resposta estruturada única para o diálogo mostrar progresso.
- Habilita auditoria consistente num só ponto.

**Alternativa descartada**: cliente chamar directamente `/api/email/send` por cada destinatário + um futuro `/api/whatsapp/send-media`. Rejeitada porque espalha validação/auditoria e força o cliente a conhecer detalhes da instância UaZapi.

### D2 — Download de attachments server-side a partir do R2 público

**Decisão**: o endpoint `/api/documents/send` faz `fetch(file.url)` server-side para obter bytes e passa-os como `attachments` para a Edge Function `smtp-send` (para Email) ou para UaZapi (para WhatsApp). O cliente envia apenas `{ id, name, url, mimeType, size }`.

**Porquê**:
- R2 é público mas o browser do utilizador pode ter ficheiros grandes (consome upload do lado do utilizador).
- Edge Function do Supabase já aceita base64 ou URL como attachment; usar URL minimiza o payload HTTP.
- UaZapi aceita URL público directo para `send-media`, o que simplifica ainda mais.

**Nota**: para Email, se a Edge Function preferir base64, faz-se o download server-side e codifica. A diferença fica encapsulada.

### D3 — Selecção de remetente: obrigatória quando há ambiguidade

**Decisão**: se o utilizador tem ≥2 contas SMTP ou ≥2 instâncias WhatsApp activas, o diálogo MUST mostrar um `Select` e exigir escolha antes de habilitar "Enviar". Com 1 conta/instância, usa-se automaticamente. Com 0, o canal fica inactivo com CTA para configurar.

**Porquê**:
- Enviar em nome de uma conta errada tem impacto reputacional (spam, identidade).
- O utilizador deve manter controlo explícito quando existe ambiguidade.

**Alternativa descartada**: assumir a conta mais recente ou marcada como default. Rejeitada por risco de erro silencioso.

### D4 — Destinatários como lista unificada com origem identificada

**Decisão**: o diálogo apresenta uma única lista de candidatos (Consultor + Proprietários + Ad-hoc) com label visível da origem. Internamente, cada candidato é `{ source: 'consultant'|'owner'|'adhoc', label, email?, phone? }` e o utilizador marca/desmarca independentemente por canal.

**Porquê**:
- UI mais simples do que "3 listas lado a lado".
- Permite marcar o mesmo contacto para Email e não para WhatsApp (ou vice-versa).
- Mantém rastreabilidade na auditoria (origem do contacto fica registada).

### D5 — Resolver consultor + proprietários no servidor ao abrir o diálogo

**Decisão**: criar `GET /api/documents/send/recipients?domain=&entityId=` que devolve a lista pré-populada. Assim:
- O cliente não precisa de fazer múltiplos fetches (consultant profile, property_owners, owners).
- Campos sensíveis como email do consultor já são controlados por RLS/admin client.

**Alternativa descartada**: reutilizar endpoints existentes de detalhe de imóvel/processo. Rejeitada porque obrigaria a alterar esses endpoints para expor campos ainda não retornados (phone_commercial, owner emails em batch).

### D6 — Envio paralelo com controlo de concorrência

**Decisão**: o servidor processa os destinatários em paralelo com limite `p-limit(3)` para Email e `p-limit(2)` para WhatsApp (a UaZapi pode cortar rate). Falhas individuais não abortam o batch.

**Porquê**:
- Envio sequencial ficaria lento para 5+ destinatários.
- Limite evita sobrecarga do Edge Function e rate-limit da UaZapi.

### D7 — Retry granular do cliente

**Decisão**: o cliente mantém o estado dos resultados e o botão "Tentar novamente" repete apenas os `failed`. O backend é stateless — o cliente reenvia o payload filtrado pelos destinatários que falharam.

**Porquê**:
- Não precisa de persistência server-side do estado.
- Simples e suficiente para o caso de uso.

### D8 — WhatsApp: um envio por ficheiro (não ZIP)

**Decisão**: para WhatsApp, cada ficheiro é enviado individualmente como `media`. Não há consolidação em ZIP. A mensagem introdutória (se preenchida) é enviada uma vez antes dos ficheiros.

**Porquê**:
- Consistente com UX WhatsApp — o destinatário vê os documentos individualmente.
- UaZapi não tem endpoint de "batch send multiple media in one message".
- ZIP dentro do WhatsApp obrigaria o destinatário a extrair, degradando a UX.

### D9 — Email: attachments reais, não links

**Decisão**: ficheiros vão anexados como attachments SMTP, não como links de download. Aviso (`toast.warning`) se total >25 MB mas envio permitido.

**Porquê**:
- Anexos reais funcionam offline e não expiram.
- 25 MB é o limite típico de servidores SMTP; acima disso o Edge Function pode falhar — o utilizador é avisado mas fica com a decisão.

**Alternativa descartada futura**: incluir links com tokens expiráveis quando exceder X MB. Pode ser seguimento.

### D10 — `onSend` como prop opcional da `BatchActionBar`

**Decisão**: `BatchActionBar` aceita prop opcional `onSend?: (folders: DocumentFolder[]) => void`. Se ausente, o botão "Enviar" não é renderizado (mantém compat com leads/negócios). Se presente, o botão renderiza e é desabilitado com tooltip quando a selecção tem 0 ficheiros.

**Porquê**:
- Aditivo e compatível com chamadas existentes — nenhuma chamada actual precisa de alterar.
- Mantém a regra "envio só em properties/processes" controlada no ponto de composição (o container).

## Risks / Trade-offs

- **[Risco] Attachments >25 MB causam falha SMTP** → Mitigação: aviso explícito no diálogo antes de submeter e resposta do endpoint com `413` clara. Utilizador pode desmarcar ficheiros e tentar de novo.
- **[Risco] UaZapi rate-limit bloqueia batch de WhatsApp** → Mitigação: `p-limit(2)` e retry granular no cliente. Falhas por rate-limit virão com mensagem específica.
- **[Risco] Consultor sem `phone_commercial` quebra expectativa de pré-selecção WhatsApp** → Mitigação: candidato aparece desactivado com tooltip PT-PT `"Sem telefone registado"`, não quebra o fluxo.
- **[Risco] Download server-side dos ficheiros do R2 aumenta tempo de envio em ficheiros grandes** → Mitigação: aceitar URL directo onde possível (UaZapi suporta); para SMTP, streamar para a Edge Function em vez de fazer buffer integral quando possível.
- **[Risco] Envio em nome de conta errada se o user-id for spoofable** → Mitigação: o endpoint valida `account.consultant_id === auth.user.id` (ou user é admin). `instance_id` idem contra `auto_wpp_instances.user_id`.
- **[Risco] Fuga de email de proprietário a utilizador não autorizado via endpoint de recipients** → Mitigação: `/api/documents/send/recipients` só devolve candidatos se o utilizador tem permissão de leitura na entidade (mesma verificação que já existe no GET do imóvel/processo). Aplicar RLS ou check explícito.
- **[Trade-off] Retry reenvia payload completo filtrado** → Aceitável: evita estado server-side e simplifica. Quando o utilizador fecha o diálogo, perde os resultados — é intencional para não exigir persistência.
- **[Trade-off] Template do corpo de Email é um texto fixo PT-PT** → Aceitável para MVP. Evoluir para `tpl_email_library` em change futura.

## Migration Plan

Nenhuma migração de DB. Rollout:

1. Backend: criar `/api/documents/send/recipients` e `/api/documents/send` em ramo separado.
2. Frontend: criar `SendDocumentsDialog` e sub-componentes; adicionar prop `onSend` na `BatchActionBar` e `DocumentsGrid`.
3. Integrar nos containers `property-documents-folders-view.tsx` e `process-documents-manager.tsx` (passar `onSend`).
4. Smoke test em staging: enviar 1 email, 1 whatsapp, combo, batch 3×3, falha simulada.
5. Deploy.

Rollback: remover a prop `onSend` dos containers (`property-documents-folders-view`, `process-documents-manager`). O botão some nos domínios afectados sem tocar na lib partilhada. O endpoint pode ficar no sítio sem impacto.

## Open Questions

- O endpoint `smtp-send` (Edge Function) aceita attachments via URL remoto ou exige base64? Confirmar na implementação; se exigir base64, adicionar passo de download + encode no `/api/documents/send`.
- A UaZapi expõe `send-media` com URL público directo, ou precisa de upload prévio? Confirmar no `uazapi_token` + endpoint correcto.
- Há um limite oficial da instância SMTP do Edge Function para tamanho de attachments? Se não, tratar 25 MB como cap operacional configurável.
- Queremos gravar uma entrada em `log_audit` por destinatário/canal, ou uma entrada agregada por submissão? (design propõe agregada — confirmar com stakeholder de compliance se necessário).
- Para o corpo de Email, queremos já suportar variáveis tipo `{{consultor_nome}}`, ou deixar para change dedicada a templates? (design deixa para change futura).
