## ADDED Requirements

### Requirement: Consultor pode criar evento comemorativo personalizado
O sistema SHALL permitir que um consultor crie um evento comemorativo com nome livre, data (dia/mês), hora de envio, flag de recorrência (anual ou única vez), e canais de envio (email, whatsapp, ou ambos).

#### Scenario: Criação de evento recorrente com sucesso
- **WHEN** o consultor preenche nome="Páscoa", data=2026-04-05, hora=9, recorrência=anual, canais=[email, whatsapp] e submete
- **THEN** o sistema cria o evento com `status='active'` e `is_recurring=true`

#### Scenario: Criação de evento único (não recorrente)
- **WHEN** o consultor cria evento com recorrência="única vez"
- **THEN** o sistema cria o evento com `is_recurring=false` e após o primeiro disparo o evento passa a `status='archived'`

#### Scenario: Validação de campos obrigatórios
- **WHEN** o consultor submete sem nome ou sem data
- **THEN** o sistema MUST rejeitar com erro de validação e não criar o evento

---

### Requirement: Consultor pode associar contactos ao evento
O sistema SHALL permitir que o consultor seleccione contactos (leads) destinatários do evento, com opção de seleccionar todos ou um subconjunto.

#### Scenario: Seleccionar contactos individuais
- **WHEN** o consultor pesquisa e selecciona 5 contactos da sua lista
- **THEN** o sistema cria 5 registos em `custom_event_leads` associados ao evento

#### Scenario: Seleccionar todos os contactos
- **WHEN** o consultor clica "Seleccionar todos"
- **THEN** o sistema associa todos os leads atribuídos ao consultor (`assigned_agent_id`) ao evento

#### Scenario: Contactos filtrados por estado
- **WHEN** o consultor filtra por estado "Qualificado" e selecciona todos os resultados
- **THEN** apenas os leads com `status='qualified'` são associados

---

### Requirement: Consultor pode associar templates ao evento
O sistema SHALL permitir associar um template de email e/ou WhatsApp ao evento. O consultor pode escolher um template existente ou criar um novo inline.

#### Scenario: Associar template de email existente
- **WHEN** o consultor selecciona um template de email da biblioteca com `scope='consultant'`
- **THEN** o evento é criado com `email_template_id` preenchido

#### Scenario: Criar template inline durante wizard
- **WHEN** o consultor clica "Criar novo template" e preenche assunto e corpo
- **THEN** o sistema cria o template em `tpl_email_library` com `scope='consultant'` e associa-o ao evento

#### Scenario: Evento apenas com WhatsApp
- **WHEN** o consultor selecciona apenas o canal WhatsApp e associa um template WPP
- **THEN** o evento é criado com `channels=['whatsapp']` e `wpp_template_id` preenchido, `email_template_id = NULL`

---

### Requirement: Auto-enrollment de novos leads nos eventos do consultor
O sistema SHALL adicionar automaticamente um lead a todos os eventos personalizados do consultor que ainda estejam por disparar, quando o lead é criado ou atribuído (`assigned_agent_id`) a esse consultor.

#### Scenario: Novo lead criado e atribuído a consultor com eventos activos recorrentes
- **WHEN** um lead é criado com `assigned_agent_id = consultor_X` e o consultor_X tem 2 eventos recorrentes activos e 1 evento único activo (ainda não disparado)
- **THEN** o sistema cria 3 registos em `custom_event_leads` associando o lead aos 3 eventos

#### Scenario: Evento único já disparado — lead NÃO é adicionado
- **WHEN** um lead é criado com `assigned_agent_id = consultor_X` e o consultor_X tem 1 evento único com `status = 'archived'` (já disparou)
- **THEN** o sistema NÃO adiciona o lead a esse evento

#### Scenario: Lead reatribuído a outro consultor
- **WHEN** o `assigned_agent_id` de um lead é alterado de consultor_X para consultor_Y
- **THEN** o sistema adiciona o lead aos eventos elegíveis de consultor_Y (sem remover dos de consultor_X — os existentes mantêm-se)

#### Scenario: Inserção idempotente
- **WHEN** o lead já está associado a um evento do consultor e o trigger executa novamente
- **THEN** o sistema não cria duplicados (`ON CONFLICT DO NOTHING`)

---

### Requirement: Spawner gera runs para eventos personalizados
O sistema SHALL gerar `contact_automation_runs` para cada par evento×contacto quando a data do evento (mês/dia) está dentro da janela de spawn, respeitando mutes e evitando duplicação.

#### Scenario: Spawn de evento recorrente no dia correcto
- **WHEN** o cron `spawn-runs` executa e existe um evento activo com `event_date` mês/dia = hoje
- **THEN** o sistema cria um run por cada lead associado ao evento, com `kind='custom_event'` e `scheduled_for` = hoje à hora definida

#### Scenario: Evento não-recorrente já disparado
- **WHEN** o spawner encontra um evento com `is_recurring=false` e `last_triggered_year = ano_actual`
- **THEN** o sistema NÃO cria novos runs e marca o evento como `status='archived'`

#### Scenario: Contacto mutado
- **WHEN** o contacto tem um mute activo para o canal do evento
- **THEN** o sistema NÃO cria run para esse contacto e regista skip

#### Scenario: Prevenção de duplicação
- **WHEN** o spawner já gerou runs para o evento no ano corrente (`last_triggered_year = ano_actual`)
- **THEN** o sistema NÃO gera runs duplicados

---

### Requirement: UI de automatismos em cards visuais
O sistema SHALL apresentar todos os eventos (fixos e personalizados) como cards visuais na tab "Automatismos". Cada card mostra nome, data, canais, nº de contactos e estado. Clicar num card abre o detalhe com lista de contactos e acções.

#### Scenario: Visualizar cards de todos os eventos
- **WHEN** o consultor acede à tab "Automatismos" no hub CRM
- **THEN** o sistema mostra cards para os 3 eventos fixos (Aniversário, Natal, Ano Novo) e todos os eventos personalizados do consultor

#### Scenario: Abrir detalhe de um evento via card
- **WHEN** o consultor clica num card de evento
- **THEN** o sistema abre o painel de detalhe com lista de contactos destinatários, opção de desactivar/editar template, e link para histórico de execuções

---

### Requirement: Consultor pode gerir eventos personalizados
O sistema SHALL permitir listar, editar, pausar/reactivar e eliminar eventos personalizados criados pelo consultor.

#### Scenario: Listar eventos do consultor
- **WHEN** o consultor acede à secção de eventos personalizados
- **THEN** o sistema mostra todos os eventos do consultor com nome, data, estado, número de contactos e último envio

#### Scenario: Editar evento existente
- **WHEN** o consultor edita o nome, data ou contactos de um evento com `status='active'`
- **THEN** as alterações são guardadas e o próximo spawn usa os dados actualizados

#### Scenario: Pausar evento
- **WHEN** o consultor pausa um evento activo
- **THEN** o evento passa a `status='paused'` e o spawner ignora-o

#### Scenario: Eliminar evento
- **WHEN** o consultor elimina um evento
- **THEN** o evento e todas as associações `custom_event_leads` são eliminados (CASCADE)

---

### Requirement: Histórico de envios do evento
O sistema SHALL apresentar o histórico de runs gerados por cada evento personalizado, com estado de entrega por contacto.

#### Scenario: Visualizar histórico com detalhes de instância
- **WHEN** o consultor abre o detalhe de um evento
- **THEN** o sistema mostra lista de runs com: nome do contacto, canal, estado (enviado/falhado/agendado), data de envio, conta de email ou instância WhatsApp usada para o envio

#### Scenario: Retry de run falhado
- **WHEN** o consultor clica "Reenviar" num run falhado
- **THEN** o sistema usa a lógica existente de `spawn-retry` para reagendar o run
