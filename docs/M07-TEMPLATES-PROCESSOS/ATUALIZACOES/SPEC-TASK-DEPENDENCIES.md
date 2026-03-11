# SPEC — Sistema de Dependências / Bloqueio entre Tarefas e Subtarefas

**Data:** 2026-03-10
**Módulo:** M07 (Templates) + M06 (Processos)
**Dependências:** SPEC-SUBTASK-ENHANCEMENTS (prazo/responsável/prioridade)

---

## 1. Resumo

Permitir que tarefas e subtarefas sejam **bloqueadas** até que uma tarefa ou subtarefa anterior seja concluída. Isto cria um grafo de dependências no template que é replicado na instanciação.

**Exemplo concreto:** A subtarefa "Enviar CMI para assinatura" só desbloqueia quando a subtarefa "Upload CMI assinado" está concluída.

---

## 2. Modelo de Dados

### 2.1 Tabela `tpl_subtasks` — Novo campo

```sql
ALTER TABLE tpl_subtasks
  ADD COLUMN IF NOT EXISTS dependency_type text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dependency_subtask_id uuid REFERENCES tpl_subtasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dependency_task_id uuid REFERENCES tpl_tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN tpl_subtasks.dependency_type IS 
  'Tipo de dependência: none (sem bloqueio), subtask (depende de subtask), task (depende de tarefa)';
COMMENT ON COLUMN tpl_subtasks.dependency_subtask_id IS 
  'ID da subtarefa de que depende (quando dependency_type = subtask)';
COMMENT ON COLUMN tpl_subtasks.dependency_task_id IS 
  'ID da tarefa de que depende (quando dependency_type = task)';
```

### 2.2 Tabela `proc_subtasks` — Novo campo

```sql
ALTER TABLE proc_subtasks
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dependency_type text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dependency_proc_subtask_id uuid REFERENCES proc_subtasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dependency_proc_task_id uuid REFERENCES proc_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unblocked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_proc_subtasks_blocked 
  ON proc_subtasks(is_blocked) 
  WHERE is_blocked = true;

COMMENT ON COLUMN proc_subtasks.is_blocked IS 'true quando a dependência ainda não foi resolvida';
```

### 2.3 Tabela `tpl_tasks` — Campo existente `dependency_task_id`

A tabela `tpl_tasks` **já tem** `dependency_task_id` (FK self-ref para `tpl_tasks`). Este campo permite dependências entre tarefas ao nível do template.

### 2.4 Tabela `proc_tasks` — Novo campo

```sql
ALTER TABLE proc_tasks
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dependency_proc_task_id uuid REFERENCES proc_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unblocked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_proc_tasks_blocked 
  ON proc_tasks(is_blocked) 
  WHERE is_blocked = true;
```

---

## 3. Regras de Negócio

### 3.1 Tipos de dependência suportados

| Nível | Pode depender de | Campo template | Campo instância |
|-------|-------------------|----------------|-----------------|
| **Tarefa** | Outra tarefa (mesmo template) | `tpl_tasks.dependency_task_id` | `proc_tasks.dependency_proc_task_id` |
| **Subtarefa** | Outra subtarefa (mesma tarefa ou outra tarefa) | `tpl_subtasks.dependency_subtask_id` | `proc_subtasks.dependency_proc_subtask_id` |
| **Subtarefa** | Uma tarefa inteira | `tpl_subtasks.dependency_task_id` | `proc_subtasks.dependency_proc_task_id` |

### 3.2 Lógica de desbloqueio

Quando uma tarefa ou subtarefa é concluída (`status = 'completed'` ou `is_completed = true`):

1. Verificar se existem `proc_subtasks` ou `proc_tasks` que dependem dela
2. Se a dependência está satisfeita → `is_blocked = false`, `unblocked_at = now()`
3. Se a tarefa/subtarefa é reactivada (reset) → re-bloquear dependentes

### 3.3 Tarefa/subtarefa bloqueada na UI

- Mostrar visualmente como "bloqueada" (ícone de cadeado + opacidade reduzida)
- Checkbox/botões de acção desabilitados
- Tooltip: "Bloqueada até {nome da dependência} ser concluída"
- Não conta para o progresso enquanto bloqueada (opcional — decidir)

---

## 4. Trigger de Desbloqueio Automático

```sql
-- Trigger: quando uma proc_task é completada, desbloquear dependentes
CREATE OR REPLACE FUNCTION auto_unblock_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Desbloquear tarefas que dependem desta
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE proc_tasks 
    SET is_blocked = false, unblocked_at = now()
    WHERE dependency_proc_task_id = NEW.id AND is_blocked = true;
    
    -- Desbloquear subtarefas que dependem desta tarefa
    UPDATE proc_subtasks
    SET is_blocked = false, unblocked_at = now()
    WHERE dependency_proc_task_id = NEW.id AND is_blocked = true;
  END IF;
  
  -- Re-bloquear se tarefa foi reactivada (reset)
  IF NEW.status IN ('pending', 'in_progress') AND OLD.status = 'completed' THEN
    UPDATE proc_tasks 
    SET is_blocked = true, unblocked_at = null
    WHERE dependency_proc_task_id = NEW.id;
    
    UPDATE proc_subtasks
    SET is_blocked = true, unblocked_at = null
    WHERE dependency_proc_task_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_unblock_on_task_complete
AFTER UPDATE OF status ON proc_tasks
FOR EACH ROW EXECUTE FUNCTION auto_unblock_on_task_complete();

-- Trigger: quando uma proc_subtask é completada, desbloquear dependentes
CREATE OR REPLACE FUNCTION auto_unblock_on_subtask_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_completed = true AND (OLD.is_completed IS NULL OR OLD.is_completed = false) THEN
    UPDATE proc_subtasks
    SET is_blocked = false, unblocked_at = now()
    WHERE dependency_proc_subtask_id = NEW.id AND is_blocked = true;
  END IF;
  
  IF NEW.is_completed = false AND OLD.is_completed = true THEN
    UPDATE proc_subtasks
    SET is_blocked = true, unblocked_at = null
    WHERE dependency_proc_subtask_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_unblock_on_subtask_complete
AFTER UPDATE OF is_completed ON proc_subtasks
FOR EACH ROW EXECUTE FUNCTION auto_unblock_on_subtask_complete();
```

---

## 5. Impacto na Instanciação

A função `populate_process_tasks` precisa:

1. Copiar `dependency_task_id` de `tpl_tasks` → mapear para o novo `proc_tasks.id` correspondente
2. Copiar `dependency_subtask_id` e `dependency_task_id` de `tpl_subtasks` → mapear para os novos IDs
3. Definir `is_blocked = true` quando existir dependência e a dependência ainda não está concluída

**Complexidade:** A instanciação precisa de dois passes — primeiro criar todas as tarefas/subtarefas, depois resolver os mappings de IDs.

---

## 6. Impacto no Template Builder (UI)

### 6.1 `subtask-editor.tsx` — Select de dependência

Dentro das "Opções avançadas" (Collapsible) de cada subtarefa:

```
▸ Opções avançadas
  Prazo (dias): [5]
  Responsável:  [Gestora Processual ▾]
  Prioridade:   [Normal ▾]
  Bloqueada até: [Nenhuma ▾]
    ├ (Sem bloqueio)
    ├ ── Subtarefas desta tarefa ──
    │  └ Upload CMI assinado
    │  └ Validar NIF
    ├ ── Tarefas de outras fases ──
    │  └ [Fase 1] Upload Caderneta Predial
    │  └ [Fase 2] Enviar email de boas-vindas
```

O select mostra:
- Subtarefas da mesma tarefa (mais comum)
- Tarefas de outras fases (para dependências cross-stage)

### 6.2 `template-task-sheet.tsx` — Dependência ao nível da tarefa

Adicionar campo "Bloqueada até" na secção "Detalhes":

```
Bloqueada até: [Nenhuma ▾]
  ├ (Sem bloqueio)
  ├ [Fase 1] Upload Contrato CMI
  ├ [Fase 1] Completar dados proprietário
  └ [Fase 2] Verificar documentação
```

---

## 7. Impacto na UI de Processos

### 7.1 Card de tarefa bloqueada

```tsx
{task.is_blocked && (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <Lock className="h-3.5 w-3.5" />
    <span>Bloqueada — aguarda conclusão de "{dependencyTitle}"</span>
  </div>
)}
```

### 7.2 Subtarefa bloqueada no checklist

```tsx
<div className={cn("flex items-center gap-2", subtask.is_blocked && "opacity-50")}>
  {subtask.is_blocked ? (
    <Lock className="h-4 w-4 text-muted-foreground" />
  ) : subtask.config?.check_type === 'manual' ? (
    <Checkbox disabled={subtask.is_blocked} ... />
  ) : (
    subtask.is_completed ? <CheckCircle2 ... /> : <Circle ... />
  )}
  <span>{subtask.title}</span>
  {subtask.is_blocked && <Badge variant="outline" className="text-xs">Bloqueada</Badge>}
</div>
```

### 7.3 API de toggle — Rejeitar se bloqueada

No endpoint `PUT /api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]`:

```typescript
if (subtask.is_blocked) {
  return NextResponse.json(
    { error: 'Esta subtarefa está bloqueada. Aguarde a conclusão da dependência.' },
    { status: 400 }
  )
}
```

---

## 8. Validação Zod

```typescript
// Adicionar ao subtaskSchema:
dependency_type: z.enum(['none', 'subtask', 'task']).default('none'),
dependency_subtask_id: z.string().uuid().optional(),
dependency_task_id: z.string().uuid().optional(),
```

---

## 9. Ordem de Implementação

| # | Acção |
|---|-------|
| 1 | Migração SQL (ALTER TABLE + triggers) |
| 2 | Actualizar types TypeScript |
| 3 | Actualizar validação Zod |
| 4 | Actualizar template builder UI (selects de dependência) |
| 5 | Actualizar APIs de templates (gravar/ler dependências) |
| 6 | Actualizar trigger de instanciação (mapear IDs + set is_blocked) |
| 7 | Actualizar API do processo (incluir is_blocked no JOIN) |
| 8 | Actualizar UI de processos (visual de bloqueio) |
| 9 | Actualizar API de toggle (rejeitar se bloqueada) |

---

## 10. Riscos

| Risco | Mitigação |
|-------|-----------|
| Dependências circulares | Validar no frontend e backend antes de guardar — não permitir ciclos |
| Mapping de IDs na instanciação | Dois passes: 1º criar tudo, 2º resolver referências |
| Performance dos triggers | Queries simples por FK com índice — impacto mínimo |
| Tarefas multiplicadas por proprietário | A dependência é por template ID — na instanciação, mapear correctamente quando há multiplicação |
