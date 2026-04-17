## Why

Os consultores actualmente só podem enviar mensagens automáticas em 3 datas comemorativas fixas (Aniversário, Natal, Ano Novo) mais duas categorias manuais (`aniversario_fecho` e `festividade`). Muitos contactos têm contextos culturais ou religiosos diferentes — Ramadão, Hanucá, Páscoa, Carnaval, Dia da Mãe, etc. — e os consultores não conseguem criar essas datas livremente. Isto limita a personalização do relacionamento e a fidelização do contacto.

## What Changes

- **UI de automatismos redesenhada em cards** — a tab "Automatismos" no hub CRM passa a mostrar cards visuais por evento (Aniversário, Natal, Ano Novo + personalizados). Clicar no card abre o detalhe com lista de contactos, acções (desactivar, editar template, ver execuções) e detalhes de envio (conta de email/instância WPP usada).
- **Novo wizard de criação de datas comemorativas personalizadas** — o consultor define: nome do evento, data/hora, recorrência (única vez ou anual), e selecciona contactos destinatários (todos ou subconjunto).
- **Auto-enrollment de novos leads** — quando um lead é criado ou atribuído ao consultor, é automaticamente adicionado a todos os eventos personalizados activos desse consultor.
- **Selecção de contactos** — interface de selecção multi-contacto com pesquisa, filtros e opção "Seleccionar todos".
- **Criação de templates inline** — ao criar a data, o consultor pode criar ou escolher templates de Email e/ou WhatsApp para a mensagem.
- **Gestão de datas personalizadas** — listagem, edição, eliminação e visualização de histórico de envios com detalhes de instância de envio.
- **Integração com o spawner existente** — as datas personalizadas entram na mesma pipeline de `spawn-runs` que já gere os eventos fixos e manuais.

## Capabilities

### New Capabilities
- `custom-commemorative-events`: CRUD de datas comemorativas personalizadas com recorrência, selecção de contactos e templates por canal (Email/WhatsApp).

### Modified Capabilities
_(nenhuma — as datas personalizadas usam a infraestrutura existente de runs, mutes e template cascade sem alterar requisitos dos specs actuais)_

## Impact

- **DB**: nova tabela(s) para eventos personalizados e respectiva associação contacto↔evento.
- **API**: novos endpoints CRUD em `/api/automacao/custom-events/` + endpoint de listagem de contactos elegíveis.
- **Spawner**: fase adicional no cron `spawn-runs` para gerar runs a partir de eventos personalizados.
- **UI**: tab "Automatismos" redesenhada com cards visuais + wizard de criação + detalhe com execuções e instância de envio.
- **Auto-enrollment**: lógica (trigger DB ou hook API) para adicionar novos leads a todos os eventos activos do consultor.
- **Templates**: reutiliza `tpl_email_library` e `auto_wpp_templates` existentes (scope=consultant) + opção de criação inline.
