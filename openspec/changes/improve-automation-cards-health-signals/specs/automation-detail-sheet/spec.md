## MODIFIED Requirements

### Requirement: Secção "Envios feitos" lista runs com retry em falhas

A tab "Envios feitos" SHALL listar as últimas 100 linhas de `contact_automation_runs` ordenadas por `COALESCE(sent_at, scheduled_for) DESC` (mais recentes primeiro), renderizadas como cards verticais em timeline. Cada card mostra: ícone do canal, nome do contacto (link para `/dashboard/leads/[id]`), estado (badge colorido: Enviado verde / Agendado azul / Falhado vermelho / Ignorado cinzento), timestamp relativo ("há 2 horas"), e para falhos/ignorados uma expansão com `error` e `skip_reason`.

Cards com `status='failed'` SHALL ter botão "Tentar novamente" que dispara `POST /api/automacao/runs/[id]/retry`. Em sucesso (201 com `{new_run_id}`), o novo run aparece no topo da timeline com `status='pending'` e o card antigo mantém-se com estado Falhado (histórico imutável).

Agrupamento visual por dia quando há múltiplos runs no mesmo dia (ex.: heading "Hoje", "Ontem", "25 de Dezembro").

O sheet SHALL aceitar prop opcional `initialRunsFilter?: 'all' | 'failed'`. Quando presente e igual a `'failed'`, a tab "Envios feitos" SHALL inicializar com o chip "Só falhados" pré-seleccionado. O default SHALL ser `'all'`. Esta prop SHALL ser lida apenas uma vez ao montar a tab — mudanças subsequentes do estado do chip são locais. Além disso, quando `initialRunsFilter='failed'` e o sheet abre, a tab inicial SHALL ser "Envios feitos" em vez de "Informação".

#### Scenario: Retry de run falhado

- **WHEN** o consultor clica "Tentar novamente" num run falhado
- **THEN** POST é feito
- **AND** um novo card aparece no topo com status "Agendado"
- **AND** toast "Envio reagendado"

#### Scenario: Filtro por estado

- **WHEN** o consultor clica num chip "Só falhados" acima da timeline
- **THEN** SHALL filtrar client-side para mostrar apenas `status='failed'`
- **AND** o contador no chip reflecte o total filtrado

#### Scenario: Sem envios ainda

- **WHEN** o evento nunca disparou (sem rows em `contact_automation_runs`)
- **THEN** empty state ilustrado com ícone + "Ainda não foram enviadas mensagens. O primeiro envio está agendado para <data>."

#### Scenario: Deep-link a partir do card do hub

- **GIVEN** o consultor clica num pill `⚠ N falhas` no card de um evento na tab Automatismos
- **WHEN** o sheet abre com `initialRunsFilter='failed'`
- **THEN** a tab inicial SHALL ser "Envios feitos" (não "Informação")
- **AND** o chip "Só falhados" SHALL estar activo
- **AND** a timeline SHALL mostrar apenas runs com `status='failed'`

#### Scenario: Prop apenas aplica à primeira montagem

- **GIVEN** o sheet está aberto com `initialRunsFilter='failed'` e o consultor clica no chip "Todos"
- **WHEN** o chip muda para "all"
- **THEN** SHALL reflectir a mudança local
- **AND** mudar `initialRunsFilter` depois (sem re-abrir o sheet) NÃO SHALL reverter a escolha do utilizador
