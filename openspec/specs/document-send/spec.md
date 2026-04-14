# Document Send


### Requirement: Âmbito do envio

O sistema SHALL permitir enviar pastas/ficheiros seleccionados a partir da biblioteca partilhada de documentos apenas nos domínios **Imóvel** (`properties`) e **Processo** (`processes`). Outros domínios (leads, negócios, etc.) MUST continuar a não expor a acção de envio.

#### Scenario: Envio disponível em Imóveis

- **WHEN** o utilizador está na aba de Documentos de um imóvel e tem `selectedIds.size > 0` com pelo menos 1 ficheiro
- **THEN** o botão "Enviar" da `BatchActionBar` fica habilitado
- **AND** ao clicar abre o `SendDocumentsDialog` com `domain = 'properties'` e `entityId = propertyId`

#### Scenario: Envio disponível em Processos

- **WHEN** o utilizador está na vista de Documentos de um processo com pelo menos 1 ficheiro seleccionado
- **THEN** o botão "Enviar" fica habilitado
- **AND** o diálogo abre com `domain = 'processes'` e `entityId = processId`

#### Scenario: Envio bloqueado noutros domínios

- **WHEN** o utilizador está em `leads` ou `negocios`
- **THEN** o botão "Enviar" permanece inexistente ou oculto na `BatchActionBar`

---

### Requirement: Selecção de canais

O diálogo SHALL oferecer ao utilizador a escolha entre os canais **Email**, **WhatsApp** ou ambos simultaneamente. Cada canal MUST ter o seu bloco de destinatários e configuração. Submeter SHALL ser permitido apenas se pelo menos 1 canal estiver activo E com pelo menos 1 destinatário válido.

#### Scenario: Activar ambos os canais

- **WHEN** o utilizador marca os toggles de Email e WhatsApp
- **THEN** ambos os blocos ficam visíveis e editáveis
- **AND** o botão "Enviar" fica habilitado apenas quando cada canal activo tem ≥1 destinatário

#### Scenario: Submeter só Email

- **WHEN** apenas o canal Email está activo com 2 destinatários
- **THEN** o envio executa apenas a rotina de Email, sem tocar em WhatsApp

---

### Requirement: Selecção de destinatários por canal

Para cada canal activo, o sistema SHALL pré-popular uma lista de destinatários candidatos com:
1. **Consultor** do imóvel/processo (com email de `consultant_email_accounts` e telefone de `dev_consultant_profiles.phone_commercial`).
2. **Proprietário(s)** do imóvel (contacto principal primeiro) via `property_owners → owners`.
3. **Ad-hoc** — o utilizador MUST poder adicionar emails ou telefones manualmente com validação de formato.

Cada candidato MUST ser marcável/desmarcável individualmente. No caso de um candidato não ter dados para o canal (ex: consultor sem telefone), o candidato MUST aparecer mas desactivado para esse canal com tooltip explicativo PT-PT.

#### Scenario: Consultor pré-carregado

- **WHEN** o diálogo abre para um imóvel cujo consultor tem `email = 'ana@infinity.pt'` e `phone_commercial = '+351912345678'`
- **THEN** o candidato "Consultor — Ana (ana@infinity.pt / 912 345 678)" aparece marcado por omissão em ambos os canais

#### Scenario: Proprietário sem telefone no canal WhatsApp

- **WHEN** o proprietário principal tem email mas não tem telefone
- **THEN** o candidato aparece marcável no bloco Email
- **AND** no bloco WhatsApp aparece desactivado com tooltip `"Sem telefone registado"`

#### Scenario: Adicionar contacto ad-hoc

- **WHEN** o utilizador introduz `joao@exemplo.com` no campo ad-hoc do Email e pressiona Enter
- **THEN** o email é validado (regex), adicionado como chip e incluído na lista de destinatários
- **WHEN** o utilizador introduz `+351 912 000 000` no campo ad-hoc do WhatsApp
- **THEN** o telefone é normalizado para E.164 e validado antes de ser adicionado

#### Scenario: Contacto ad-hoc inválido

- **WHEN** o utilizador introduz `email-invalido` no campo ad-hoc do Email
- **THEN** o sistema mostra `toast.error("Email inválido")` e NÃO adiciona o chip

---

### Requirement: Selecção de remetente (Email)

Quando o canal Email está activo, o sistema SHALL resolver a(s) conta(s) SMTP activa(s) do utilizador autenticado via `consultant_email_accounts`. O comportamento MUST ser:
- **Zero contas activas**: o canal Email MUST ficar inactivo com CTA PT-PT `"Configurar email"` que aponta para as definições de conta.
- **Uma conta activa**: usar essa conta automaticamente e mostrar o remetente em read-only (`{display_name} <{email_address}>`).
- **Duas ou mais contas activas**: apresentar um `Select` com todas as contas e obrigar o utilizador a escolher uma antes de submeter; não assumir default.

O remetente escolhido MUST ser enviado ao backend como `account_id` e utilizado pelo `/api/email/send` existente.

#### Scenario: Utilizador com uma conta

- **WHEN** o utilizador autenticado tem 1 conta SMTP activa (`alice@infinity.pt`)
- **THEN** o bloco Email mostra `"Enviar de: Alice <alice@infinity.pt>"` em read-only

#### Scenario: Utilizador com múltiplas contas

- **WHEN** o utilizador tem 2 contas activas (`alice@infinity.pt`, `alice.pessoal@gmail.com`)
- **THEN** o bloco Email mostra um `Select` com ambas as contas
- **AND** o botão "Enviar" fica desabilitado até o utilizador seleccionar uma conta

#### Scenario: Utilizador sem contas

- **WHEN** o utilizador não tem contas SMTP activas
- **THEN** o toggle Email está desactivado com tooltip `"Precisas de configurar um email primeiro"`
- **AND** é mostrada uma ligação `"Configurar email"` para `/dashboard/definicoes/email`

---

### Requirement: Selecção de remetente (WhatsApp)

Quando o canal WhatsApp está activo, o sistema SHALL resolver a(s) instância(s) UaZapi activa(s) do utilizador via `auto_wpp_instances` filtrando por `user_id` e `status = 'active'`. O comportamento MUST ser:
- **Zero instâncias**: canal inactivo com CTA `"Configurar WhatsApp"`.
- **Uma instância**: usar automaticamente e mostrar o número/label em read-only.
- **Duas ou mais**: apresentar `Select` e obrigar escolha antes de submeter.

#### Scenario: Uma instância activa

- **WHEN** o utilizador tem 1 instância activa (`+351 911 000 000 — Infinity Comercial`)
- **THEN** o bloco WhatsApp mostra o label em read-only

#### Scenario: Múltiplas instâncias

- **WHEN** o utilizador tem 2 instâncias activas
- **THEN** o bloco WhatsApp mostra `Select` e o "Enviar" só fica habilitado após a escolha

#### Scenario: Sem instâncias

- **WHEN** o utilizador não tem instâncias activas
- **THEN** o toggle WhatsApp está desactivado com CTA para as definições

---

### Requirement: Composição da mensagem de Email

O diálogo SHALL apresentar, no bloco Email, campos editáveis:
- **Assunto** (obrigatório) pré-preenchido com `"Documentos — {ref_imóvel|ref_processo}"`.
- **Corpo** (obrigatório) editável com template PT-PT por omissão que inclui os nomes das pastas seleccionadas.
- **Anexos**: os ficheiros seleccionados MUST ser anexados como attachments reais no envio SMTP (fetch server-side do R2 público). O diálogo MUST mostrar o total de ficheiros e tamanho agregado, com aviso `toast.warning` se >25 MB.

#### Scenario: Subject e corpo pré-preenchidos

- **WHEN** o diálogo abre para o imóvel `IMO-2026-00123`
- **THEN** o assunto é `"Documentos — IMO-2026-00123"`
- **AND** o corpo lista as pastas seleccionadas (ex: `- Caderneta Predial`, `- Certificado Energético`)

#### Scenario: Aviso de tamanho excessivo

- **WHEN** a soma de `file.size` ultrapassa 25 MB
- **THEN** é mostrado `toast.warning("Anexos excedem 25 MB — envio pode falhar no servidor SMTP")` mas o envio continua permitido

---

### Requirement: Composição da mensagem de WhatsApp

O diálogo SHALL apresentar, no bloco WhatsApp, um campo de mensagem opcional (PT-PT default com a mesma lista de pastas). A submissão MUST, para cada destinatário:
1. Resolver `phone → chat_id, instance_id` via `/api/whatsapp/resolve-chat`.
2. Enviar a mensagem de texto (se preenchida).
3. Enviar cada ficheiro como media/document via UaZapi, um por um.

#### Scenario: Envio com mensagem e anexos

- **WHEN** a mensagem é `"Segue a documentação solicitada"` e há 3 ficheiros
- **THEN** o servidor resolve o chat e faz 1 `send-text` + 3 `send-media`, pela ordem

#### Scenario: Envio só de ficheiros

- **WHEN** a mensagem está vazia e há 2 ficheiros
- **THEN** o servidor faz apenas 2 `send-media` sem texto introdutório

---

### Requirement: Envio multi-destinatário com progresso e retry

O `POST /api/documents/send` SHALL processar todos os destinatários de todos os canais e devolver um relatório estruturado. O diálogo SHALL apresentar uma tabela de progresso por destinatário/canal com estados `pending → sending → success | failed`. Erros por destinatário NÃO MUST abortar os restantes. O diálogo MUST oferecer um botão `"Tentar novamente"` que reenvia apenas os destinatários com estado `failed`.

#### Scenario: Um destinatário falha, outros enviam

- **WHEN** o envio é disparado para 3 emails e o segundo falha (SMTP rejeita)
- **THEN** o relatório devolve `[{to: 'a@x', channel: 'email', status: 'success'}, {to: 'b@x', channel: 'email', status: 'failed', error: '...'}, {to: 'c@x', channel: 'email', status: 'success'}]`
- **AND** o diálogo mostra 2 sucessos + 1 falha com o botão `"Tentar novamente"` activo

#### Scenario: Retry de falhas apenas

- **WHEN** o utilizador clica `"Tentar novamente"` após uma falha
- **THEN** a nova chamada envia apenas os destinatários com estado `failed`
- **AND** os sucessos anteriores permanecem marcados como success e não são reenviados

---

### Requirement: Auditoria de envios

Cada chamada a `POST /api/documents/send` SHALL registar uma entrada em `log_audit` por cada destinatário/canal (ou uma entrada agregada com `new_data` contendo o array completo), com:
- `entity_type = 'property' | 'process'`
- `entity_id = <id>`
- `action = 'documents.send'`
- `new_data` contendo `{ channels, account_id?, instance_id?, recipients: [{channel, to, status, error?}], files: [{id, name, url, size}] }`

#### Scenario: Auditoria gravada

- **WHEN** o envio de 2 ficheiros para 1 email e 1 WhatsApp conclui com sucesso
- **THEN** existe 1 registo em `log_audit` com `action = 'documents.send'` e `new_data.recipients.length === 2`

---

### Requirement: Endpoint de envio server-side

O sistema SHALL expor `POST /api/documents/send` que aceita:
```
{
  domain: 'properties' | 'processes',
  entityId: string,
  files: Array<{ id: string; name: string; url: string; mimeType: string; size: number }>,
  email?: { account_id: string; subject: string; body_html: string; recipients: string[] },
  whatsapp?: { instance_id: string; message?: string; recipients: string[] }  // E.164 phones
}
```
A rota MUST autenticar via Supabase server client, validar que `account_id`/`instance_id` pertencem ao utilizador autenticado (ou o utilizador é admin) e rejeitar com `403` caso contrário.

#### Scenario: Tentativa de uso de conta alheia

- **WHEN** o utilizador `alice` submete com `account_id` pertencente a `bruno` e `alice` não é admin
- **THEN** o endpoint devolve `403 { error: 'Forbidden' }`

#### Scenario: Payload sem canais

- **WHEN** o payload não inclui `email` nem `whatsapp`
- **THEN** o endpoint devolve `400 { error: 'Nenhum canal seleccionado' }`

#### Scenario: Resposta estruturada

- **WHEN** o envio completa (com ou sem falhas parciais)
- **THEN** o endpoint devolve `200 { results: [{channel, to, status, error?}], attempted: N, succeeded: M }`
