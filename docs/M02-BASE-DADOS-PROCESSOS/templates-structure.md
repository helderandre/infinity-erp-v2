# Estrutura de Criação de Templates de Processo

## Visão Geral

O sistema de templates permite definir processos reutilizáveis compostos por **fases** e **tarefas**. Quando um template é instanciado para um imóvel, uma trigger no banco de dados copia automaticamente todas as tarefas do template para a instância.

## Modelo de Dados

```
tpl_processes (Template de Processo)
├── id (UUID, PK)
├── name (text, obrigatório)
├── description (text, opcional)
├── is_active (boolean, default true)
└── created_at (timestamp)

tpl_stages (Fases do Template)
├── id (UUID, PK)
├── tpl_process_id (UUID, FK → tpl_processes.id)
├── name (text, obrigatório)
├── order_index (integer, ordem da fase)
└── created_at (timestamp)

tpl_tasks (Tarefas do Template)
├── id (UUID, PK)
├── tpl_stage_id (UUID, FK → tpl_stages.id)
├── title (text, obrigatório)
├── description (text, opcional)
├── action_type (text: UPLOAD | EMAIL | GENERATE_DOC | MANUAL)
├── is_mandatory (boolean, default true)
├── dependency_task_id (UUID, FK → tpl_tasks.id, opcional)
├── sla_days (integer, opcional)
├── config (JSONB, configuração por tipo)
└── order_index (integer, ordem da tarefa)
```

### Hierarquia

```
Processo (tpl_processes)
└── Fase 1 (tpl_stages, order_index: 0)
│   ├── Tarefa 1.1 (tpl_tasks, order_index: 0)
│   ├── Tarefa 1.2 (tpl_tasks, order_index: 1)
│   └── Tarefa 1.3 (tpl_tasks, order_index: 2)
└── Fase 2 (tpl_stages, order_index: 1)
    ├── Tarefa 2.1 (tpl_tasks, order_index: 0)
    └── Tarefa 2.2 (tpl_tasks, order_index: 1)
```

## Tipos de Tarefa (action_type)

Cada tarefa tem um `action_type` que define o seu comportamento e a estrutura do campo `config` (JSONB):

| action_type    | Descrição                          | config                          |
|----------------|------------------------------------|---------------------------------|
| `UPLOAD`       | Solicitar upload de documento      | `{ doc_type_id: string }`       |
| `EMAIL`        | Enviar email a partir de template  | `{ email_library_id: string }`  |
| `GENERATE_DOC` | Gerar documento a partir de modelo | `{ doc_library_id: string }`    |
| `MANUAL`       | Tarefa manual (livre)              | `{}` (vazio)                    |

### Tabelas Auxiliares (Bibliotecas)

As bibliotecas fornecem os modelos utilizados nas configurações das tarefas:

- **`doc_types`** — Tipos de documento para tarefas UPLOAD (ex: "Caderneta Predial", "Escritura")
- **`tpl_email_library`** — Templates de email para tarefas EMAIL (contém subject, nome)
- **`tpl_doc_library`** — Templates de documento para tarefas GENERATE_DOC (contém doc_type_id)

## Fluxo de Criação

```
POST /api/templates
```

### Payload

```json
{
  "name": "Angariação Padrão",
  "description": "Processo completo de angariação",
  "stages": [
    {
      "name": "Documentação Inicial",
      "order_index": 0,
      "tasks": [
        {
          "title": "Upload Caderneta Predial",
          "action_type": "UPLOAD",
          "is_mandatory": true,
          "sla_days": 5,
          "config": { "doc_type_id": "uuid-do-tipo" },
          "order_index": 0
        },
        {
          "title": "Enviar email de boas-vindas",
          "action_type": "EMAIL",
          "is_mandatory": false,
          "config": { "email_library_id": "uuid-do-template" },
          "order_index": 1
        }
      ]
    }
  ]
}
```

### Sequência de Inserção

1. **Validação** — nome obrigatório, pelo menos 1 fase, cada fase com pelo menos 1 tarefa
2. **Insert `tpl_processes`** — cria o processo, retorna `process.id`
3. **Loop por cada fase** — insert em `tpl_stages` com `tpl_process_id`, retorna `stage.id`
4. **Acumular tarefas** — prepara array com todas as tarefas de todas as fases, cada uma com o `tpl_stage_id` respectivo
5. **Insert batch `tpl_tasks`** — insere todas as tarefas numa única operação

### Resposta

```json
{
  "success": true,
  "process_id": "uuid-do-processo"
}
```

## Fluxo de Listagem

```
GET /api/templates
```

Retorna todos os templates activos (`is_active = true`), ordenados por data de criação (mais recente primeiro).

## Fluxo de Instanciação

```
POST /api/processes/instantiate
```

### Payload

```json
{
  "tpl_process_id": "uuid-do-template",
  "property_id": "uuid-do-imovel"
}
```

### Sequência

1. **Validação** — verifica que o imóvel e o template existem
2. **Buscar primeira fase** — obtém a fase com menor `order_index` para definir `current_stage_id`
3. **Insert `proc_instances`** — cria a instância do processo
4. **Trigger `trg_populate_tasks`** — trigger do PostgreSQL que copia automaticamente todas as tarefas do template para `proc_tasks`
5. **Trigger `trg_generate_proc_ref`** — gera referência automática no formato `PROC-YYYY-XXXX`
6. **Buscar tarefas geradas** — retorna as `proc_tasks` criadas pela trigger

### Resposta

```json
{
  "instance": {
    "id": "uuid",
    "property_id": "uuid",
    "tpl_process_id": "uuid",
    "current_status": "active",
    "current_stage_id": "uuid",
    "percent_complete": 0,
    "external_ref": "PROC-2026-0001"
  },
  "tasks": [...]
}
```

## Modelo de Execução

```
proc_instances (Instância de Processo)
├── id (UUID, PK)
├── property_id (UUID, FK → dev_properties.id)
├── tpl_process_id (UUID, FK → tpl_processes.id)
├── current_status (text: active | completed | cancelled)
├── current_stage_id (UUID, FK → tpl_stages.id)
├── percent_complete (numeric, 0-100)
└── external_ref (text, gerado por trigger: PROC-YYYY-XXXX)

proc_tasks (Tarefas Instanciadas)
├── id (UUID, PK)
├── proc_instance_id (UUID, FK → proc_instances.id)
├── tpl_task_id (UUID, FK → tpl_tasks.id)
├── title (text, copiado do template)
├── action_type (text, copiado do template)
├── status (text: pending | in_progress | completed | skipped)
├── stage_order_index (integer, para ordenação)
└── config (JSONB, copiado do template)
```

## Endpoints

| Método | Rota                        | Descrição                              |
|--------|-----------------------------|----------------------------------------|
| GET    | `/api/templates`            | Listar templates activos               |
| POST   | `/api/templates`            | Criar novo template                    |
| POST   | `/api/processes/instantiate`| Instanciar template para um imóvel     |
| GET    | `/api/libraries/doc-types`  | Listar tipos de documento (para UPLOAD)|
| GET    | `/api/libraries/emails`     | Listar templates de email (para EMAIL) |
| GET    | `/api/libraries/docs`       | Listar templates de documento (para GENERATE_DOC) |
