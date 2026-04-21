## ADDED Requirements

### Requirement: Scoping — não-admin só vê a sua própria instância

Todas as superfícies que leiam `auto_wpp_instances` para um utilizador autenticado SHALL filtrar por `user_id = auth.user.id` quando o utilizador não tem nenhum dos roles em `WHATSAPP_ADMIN_ROLES`. Admins vêem todas as instâncias. A validação de ownership é aplicacional (o código corre com `createAdminClient`), pelo que cada rota MUST aplicar o filtro explicitamente.

#### Scenario: Não-admin abre a listagem de instâncias
- **WHEN** um consultor sem role admin abre `/dashboard/automacao/instancias`
- **THEN** a resposta de `GET /api/automacao/instancias` contém apenas instâncias onde `user_id` iguala o id do consultor

#### Scenario: Não-admin abre a página de chats WhatsApp
- **WHEN** um consultor sem role admin abre `/dashboard/whatsapp`
- **THEN** o selector de instância mostra apenas a(s) instância(s) onde `user_id` iguala o id do consultor

#### Scenario: Não-admin abre a página de contactos WhatsApp
- **WHEN** um consultor sem role admin abre `/dashboard/whatsapp/contactos`
- **THEN** o selector de instância mostra apenas a(s) instância(s) onde `user_id` iguala o id do consultor e nenhuma instância de outro consultor aparece

#### Scenario: Não-admin tenta ler contactos de instância alheia via API
- **WHEN** um consultor faz `GET /api/whatsapp/instances/<id>/contacts` com um `id` cujo `user_id` é outro consultor
- **THEN** a API responde HTTP 403 com mensagem "Sem permissão para esta instância"

#### Scenario: Admin continua a ver tudo
- **WHEN** um utilizador com role em `WHATSAPP_ADMIN_ROLES` abre qualquer das superfícies acima
- **THEN** vê todas as instâncias independentemente de `user_id`, incluindo instâncias sem utilizador atribuído

### Requirement: Desconectar preserva o histórico

A acção "Desconectar" uma instância SHALL apenas parar a sessão Uazapi e marcar `connection_status = 'disconnected'`, limpando dados voláteis de sessão (`phone`, `profile_name`, `profile_pic_url`). Dados derivados (chats, mensagens, contactos, media, labels, agendados) NÃO SHALL ser tocados e DEVEM continuar visíveis ao reconectar.

#### Scenario: Utilizador desconecta uma instância com histórico
- **WHEN** o utilizador clica "Desconectar" numa instância que tem 5 chats e 200 mensagens
- **THEN** a instância fica `connection_status = 'disconnected'` e `phone/profile_name/profile_pic_url` são null
- **AND** `wpp_chats`, `wpp_messages`, `wpp_contacts` da instância permanecem iguais

#### Scenario: Utilizador reconecta depois de desconectar
- **WHEN** o utilizador clica "Conectar" na mesma instância e completa o QR/paircode
- **THEN** a instância volta a `connection_status = 'connected'` e os 5 chats + 200 mensagens continuam visíveis na UI

### Requirement: Eliminar remove todo o histórico em cascata

A acção "Eliminar" uma instância SHALL remover atomicamente, numa única transacção do Postgres:
- a linha em `auto_wpp_instances`
- todas as linhas em `wpp_chats`, `wpp_messages`, `wpp_contacts`, `wpp_message_media`, `wpp_labels`, `wpp_scheduled_messages`, `wpp_activity_sessions`, `wpp_debug_log` onde `instance_id` iguala o id da instância

Isto SHALL ser implementado via `ON DELETE CASCADE` nas foreign keys, não via lógica aplicacional. O handler `handleDelete` MUST continuar a chamar `DELETE /instance` na Uazapi antes do `DELETE` em banco, e a desvincular `auto_flows` (`wpp_instance_id = null`) antes.

#### Scenario: Eliminar instância com histórico
- **WHEN** um admin clica "Eliminar" numa instância com 5 chats, 200 mensagens, 10 contactos, 3 media e 1 mensagem agendada
- **THEN** após sucesso todas as linhas `wpp_*` com `instance_id` dessa instância desaparecem
- **AND** `SELECT COUNT(*) FROM wpp_messages WHERE instance_id = <id>` devolve 0

#### Scenario: Eliminar instância sem histórico
- **WHEN** um admin clica "Eliminar" numa instância recém-criada sem chats
- **THEN** a operação termina com sucesso e não é criado nenhum erro

#### Scenario: Fluxos em `auto_flows` são desvinculados antes
- **WHEN** uma instância a ser eliminada tem 3 fluxos em `auto_flows` com `wpp_instance_id` a apontar para ela
- **THEN** esses 3 fluxos ficam com `wpp_instance_id = null` e continuam a existir
- **AND** o response inclui `unboundFlowsCount: 3`

### Requirement: Eliminar limpa ficheiros R2 associados

Antes do `DELETE` em banco, o handler SHALL enumerar todas as `wpp_message_media.r2_key` e `wpp_message_media.thumbnail_r2_key` da instância e chamar o delete object correspondente no Cloudflare R2. Falhas individuais SHALL ser engolidas (log + continuar) — uma falha de R2 NÃO SHALL bloquear a eliminação em banco.

#### Scenario: Instância com media em R2
- **WHEN** uma instância com 50 media (cada um com `r2_key` e `thumbnail_r2_key`) é eliminada
- **THEN** são emitidos até 100 deletes para R2 em paralelo antes do `DELETE` da instância
- **AND** a cascata do Postgres remove as linhas em `wpp_message_media`

#### Scenario: R2 devolve erro num objecto
- **WHEN** o delete R2 falha para um objecto individual
- **THEN** o erro é logado mas o `DELETE` da instância prossegue com sucesso
- **AND** a resposta ao cliente é 200 com `success: true`

### Requirement: Endpoint devolve contagens do que foi apagado

`POST /api/automacao/instancias` com `action: "delete"` SHALL devolver, além de `success: true` e `unboundFlowsCount`, um objecto `deletedCounts` com as contagens de chats, mensagens, contactos e media calculadas imediatamente antes da cascata.

#### Scenario: Response após eliminação bem-sucedida
- **WHEN** um admin elimina uma instância com 5 chats, 200 mensagens, 10 contactos e 3 media
- **THEN** a resposta HTTP 200 contém `{ success: true, unboundFlowsCount: 0, deletedCounts: { chats: 5, messages: 200, contacts: 10, media: 3 } }`

### Requirement: UI diferencia Desconectar de Eliminar

O `AlertDialog` de confirmação de eliminação SHALL enumerar o que vai ser apagado (instância Uazapi, conversas, mensagens, contactos, media) e SHALL sugerir "Desconectar" como alternativa reversível. O toast de sucesso SHALL usar as `deletedCounts` devolvidas pelo endpoint para mostrar quantos registos foram removidos.

#### Scenario: Dialog de eliminação aberto
- **WHEN** o utilizador clica "Eliminar" no card de uma instância
- **THEN** o `AlertDialog` mostra o nome da instância, a lista de categorias que serão apagadas, e o aviso "irreversível"
- **AND** mostra um link/sugestão para usar "Desconectar" em vez disso

#### Scenario: Toast após eliminação com histórico
- **WHEN** o endpoint devolve `deletedCounts: { chats: 5, messages: 200, contacts: 10, media: 3 }`
- **THEN** aparece um toast de sucesso com texto que menciona pelo menos "5 conversas, 200 mensagens, 10 contactos removidos"

#### Scenario: Toast após eliminação de instância vazia
- **WHEN** o endpoint devolve `deletedCounts: { chats: 0, messages: 0, contacts: 0, media: 0 }`
- **THEN** aparece um toast de sucesso simples ("Instância eliminada com sucesso") sem contagens
