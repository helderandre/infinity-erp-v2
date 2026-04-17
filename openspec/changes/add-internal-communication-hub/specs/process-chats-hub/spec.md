## ADDED Requirements

### Requirement: Listagem centralizada de chats de processo
O sistema SHALL apresentar uma lista de todos os processos em que o utilizador participa (como consultor atribuído ou com tarefas atribuídas), ordenados pela data da última mensagem, com preview e contagem de não lidas.

#### Scenario: Utilizador abre secção de Processos no hub
- **WHEN** o utilizador selecciona a secção "Processos" na página de comunicação
- **THEN** o sistema MUST exibir lista de processos com: referência (`external_ref`), título do imóvel, preview da última mensagem (truncada a 80 caracteres), nome do remetente, timestamp relativo, e badge de contagem de mensagens não lidas

#### Scenario: Processo sem mensagens
- **WHEN** um processo do utilizador não tem mensagens no chat
- **THEN** o sistema MUST exibir o processo na lista com indicação "Sem mensagens" e sem badge de não lidas

#### Scenario: Ordenação por última actividade
- **WHEN** a lista de processos é carregada
- **THEN** os processos MUST estar ordenados por `last_message_at` descendente (mais recente primeiro), com processos sem mensagens no final

### Requirement: Chat de processo inline
O sistema SHALL permitir abrir o chat de qualquer processo directamente no painel de chat da página de comunicação, sem navegar para a página do processo.

#### Scenario: Utilizador selecciona processo da lista
- **WHEN** o utilizador clica num processo na lista
- **THEN** o painel direito MUST exibir o chat completo do processo com todas as funcionalidades: envio de texto, ficheiros, áudio, menções (@utilizadores e /entidades), reacções, respostas, edição, eliminação, read receipts e presença

#### Scenario: Envio de mensagem no chat de processo inline
- **WHEN** o utilizador envia uma mensagem de qualquer tipo (texto, ficheiro, áudio) no chat inline
- **THEN** a mensagem MUST ser persistida nas tabelas `proc_chat_*` existentes e MUST aparecer em tempo real tanto aqui como no chat flutuante do processo (se aberto por outro utilizador)

#### Scenario: Menções de entidades do processo
- **WHEN** o utilizador digita `/` no chat inline de processo
- **THEN** o sistema MUST carregar e exibir autocomplete de entidades do processo (tarefas, subtarefas, documentos) via `/api/processes/{id}/chat/entities`, idêntico ao comportamento do chat flutuante

### Requirement: Atalho para página do processo
O sistema SHALL oferecer um atalho para navegar directamente à página do processo a partir do chat inline.

#### Scenario: Utilizador quer ver detalhes do processo
- **WHEN** o utilizador clica no botão/link "Ver processo" no cabeçalho do chat inline
- **THEN** o sistema MUST navegar para `/dashboard/processos/{id}`

### Requirement: Contagem de não lidas em tempo real
O sistema SHALL actualizar as contagens de mensagens não lidas na lista de processos em tempo real.

#### Scenario: Nova mensagem num processo enquanto utilizador vê outro
- **WHEN** o utilizador está no chat de um processo e chega uma mensagem noutro processo
- **THEN** o badge de não lidas do processo afectado na lista MUST incrementar em tempo real sem necessidade de refresh

#### Scenario: Utilizador lê mensagens e contador reseta
- **WHEN** o utilizador abre o chat de um processo e visualiza as mensagens
- **THEN** o badge de não lidas desse processo MUST desaparecer (contagem = 0) após marcar como lido

### Requirement: Pesquisa/filtro na lista de processos
O sistema SHALL permitir filtrar a lista de processos por referência ou título do imóvel.

#### Scenario: Utilizador pesquisa processo
- **WHEN** o utilizador digita texto no campo de pesquisa da secção de processos
- **THEN** a lista MUST filtrar em tempo real mostrando apenas processos cujo `external_ref` ou título de imóvel contém o texto (case-insensitive, debounce 300ms)
