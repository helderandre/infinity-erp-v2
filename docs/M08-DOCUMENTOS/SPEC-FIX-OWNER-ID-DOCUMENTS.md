# SPEC — Correcção: owner_id em Documentos de Proprietário

**Data:** 2026-02-23
**Tipo:** Bug Fix / Melhoria
**Prioridade:** Alta
**Dependências:** M08 (Documentos), Trigger `auto_complete_tasks_on_doc_insert`

---

## 1. Problema Identificado

Quando um documento de proprietário (ex: Cartão de Cidadão, Ficha de Branqueamento) é carregado via formulário de angariação ou via tarefa de processo, o registo em `doc_registry` fica com:

- `property_id` = UUID do imóvel ✅
- `owner_id` = **NULL** ❌

Isto acontece porque o frontend envia apenas `property_id` no FormData, mesmo quando o tipo de documento pertence à categoria "Proprietário" ou "Proprietário Empresa".

### Impacto

1. **Trigger `auto_complete_tasks_on_doc_insert` não activa o Caso 2** — documentos de proprietário sem `owner_id` não são detectados como reutilizáveis para outros processos do mesmo proprietário
2. **Documentos não são reutilizáveis** — se o proprietário tiver outro imóvel, o CC não aparece como "Já existe (válido)"
3. **`autoCompleteTasks()` na aprovação falha parcialmente** — a query que busca `doc_registry` por `owner_id` não encontra nada porque `owner_id` é NULL

### Dados Afectados

Qualquer registo em `doc_registry` onde `doc_type.category` começa com "Proprietário" e `owner_id` IS NULL.

---

## 2. Solução — Duas Camadas de Protecção

### Camada 1: Frontend (origem do problema)

No loop de upload pós-criação de angariação e no upload em tarefas de processo, enviar `owner_id` quando o tipo de documento é de proprietário.

### Camada 2: API de Upload (fallback defensivo)

Na `POST /api/documents/upload`, inferir automaticamente o `owner_id` quando não vem no FormData mas o `doc_type.category` indica que é um documento de proprietário.

### Camada 3: Trigger de BD (última defesa)

Trigger `BEFORE INSERT` em `doc_registry` que preenche `owner_id` automaticamente quando está NULL e o `doc_type` é de proprietário.

---

## 3. Ficheiros a Modificar

| # | Ficheiro | Modificação |
|---|----------|-------------|
| 1 | `app/api/documents/upload/route.ts` | Adicionar lógica de inferência de `owner_id` |
| 2 | `components/acquisitions/acquisition-form.tsx` | Enviar `owner_id` no loop de upload de docs pendentes |
| 3 | `components/documents/documents-section.tsx` | Guardar `owner_id` no estado de cada documento pendente |
| 4 | `components/processes/task-upload-action.tsx` | Enviar `owner_id` quando tarefa é de doc de proprietário |

| # | Migrations |
|---|------------|
| 1 | `auto_resolve_owner_id_on_doc_insert` — trigger BEFORE INSERT em `doc_registry` |

---

## 4. Migration: Trigger de Auto-Resolução de owner_id

**Nome:** `auto_resolve_owner_id_on_doc_insert`

Esta trigger actua como última defesa. Se um INSERT em `doc_registry` tem `property_id` preenchido, `owner_id` NULL, e o `doc_type.category` começa com "Proprietário", a trigger resolve automaticamente o `owner_id` buscando o proprietário principal do imóvel.

```sql
CREATE OR REPLACE FUNCTION auto_resolve_owner_id_on_doc_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_category text;
  v_resolved_owner_id uuid;
BEGIN
  -- Só actuar se owner_id é NULL e property_id existe
  IF NEW.owner_id IS NOT NULL OR NEW.property_id IS NULL OR NEW.doc_type_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar categoria do doc_type
  SELECT category INTO v_category
  FROM doc_types
  WHERE id = NEW.doc_type_id;

  -- Só para documentos de proprietário
  IF v_category IS NULL OR NOT (v_category LIKE 'Proprietário%') THEN
    RETURN NEW;
  END IF;

  -- Buscar proprietário principal do imóvel
  SELECT owner_id INTO v_resolved_owner_id
  FROM property_owners
  WHERE property_id = NEW.property_id
    AND is_main_contact = true
  LIMIT 1;

  -- Fallback: se não há main_contact, usar o primeiro
  IF v_resolved_owner_id IS NULL THEN
    SELECT owner_id INTO v_resolved_owner_id
    FROM property_owners
    WHERE property_id = NEW.property_id
    ORDER BY owner_id
    LIMIT 1;
  END IF;

  -- Preencher owner_id
  IF v_resolved_owner_id IS NOT NULL THEN
    NEW.owner_id := v_resolved_owner_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_resolve_owner_id_on_doc_insert() IS
  'Preenche owner_id automaticamente quando doc de proprietário é inserido sem owner_id mas com property_id.';

CREATE TRIGGER trg_auto_resolve_owner_id
  BEFORE INSERT ON doc_registry
  FOR EACH ROW
  EXECUTE FUNCTION auto_resolve_owner_id_on_doc_insert();
```

**Nota:** Esta trigger dispara BEFORE INSERT, portanto o `owner_id` já estará preenchido quando a trigger `auto_complete_tasks_on_doc_insert` (AFTER INSERT) executar.

### Ordem de execução das triggers em doc_registry

```
INSERT doc_registry
  │
  ├─ BEFORE INSERT: trg_auto_resolve_owner_id
  │   → Preenche owner_id se NULL + doc de proprietário
  │
  ├─ INSERT executa (com owner_id já corrigido)
  │
  ├─ AFTER INSERT: trg_auto_complete_tasks_on_doc_insert
  │   → Auto-completa tarefas (já vê owner_id correcto)
  │
  └─ BEFORE UPDATE: trg_doc_registry_updated_at
      → (só em updates futuros)
```

---

## 5. Modificação #1 — `app/api/documents/upload/route.ts`

**Localização:** Após extrair os campos do FormData e validar o `doc_type`, antes do upload ao R2.

**Lógica a adicionar:**

```typescript
// Após obter o docType da BD (que já tens):
// const docType = ... (query a doc_types por docTypeId)

let resolvedOwnerId = ownerId // valor do FormData (pode ser null)

// Se é doc de proprietário, veio property_id mas sem owner_id → inferir
if (
  !resolvedOwnerId &&
  propertyId &&
  docType.category?.startsWith('Proprietário')
) {
  // Buscar proprietário principal do imóvel
  const { data: mainOwner } = await supabase
    .from('property_owners')
    .select('owner_id')
    .eq('property_id', propertyId)
    .eq('is_main_contact', true)
    .maybeSingle()

  if (mainOwner) {
    resolvedOwnerId = mainOwner.owner_id
  } else {
    // Fallback: primeiro proprietário
    const { data: firstOwner } = await supabase
      .from('property_owners')
      .select('owner_id')
      .eq('property_id', propertyId)
      .limit(1)
      .maybeSingle()

    if (firstOwner) {
      resolvedOwnerId = firstOwner.owner_id
    }
  }
}

// Usar resolvedOwnerId no INSERT de doc_registry
// .insert({
//   ...
//   owner_id: resolvedOwnerId || null,
//   ...
// })
```

**Nota:** A query a `doc_types` para obter a `category` pode já existir na validação de extensões. Se sim, reutilizar. Se não, adicionar `category` ao SELECT existente.

---

## 6. Modificação #2 — Frontend: Loop de Upload em Angariações

### 6.1 `components/documents/documents-section.tsx` (ou componente equivalente do Step 5)

**Problema:** Cada documento pendente de upload guarda `doc_type_id` e `file`, mas **não guarda `owner_id`**.

**Solução:** Quando o utilizador selecciona um documento de tipo "Proprietário", o componente deve associar o `owner_id` ao ficheiro pendente. No Step 5 do formulário de angariação, o utilizador já seleccionou os proprietários (Step 3), portanto os dados estão disponíveis no estado do formulário.

**Interface do documento pendente (types/document.ts):**

```typescript
// Já existe parcialmente — confirmar que owner_id está presente
export interface PendingDocument {
  doc_type_id: string
  doc_type_name: string
  doc_type_category: string  // ← necessário para saber se é "Proprietário"
  file?: File
  file_url?: string
  file_name?: string
  owner_id?: string          // ← CRÍTICO: associar quando cat = "Proprietário*"
  owner_index?: number       // ← índice do owner no array de owners do form
  is_uploaded: boolean
}
```

**UX sugerida para o Step 5:**

Quando o doc_type pertence a "Proprietário" ou "Proprietário Empresa" e existem múltiplos proprietários:

```
┌─────────────────────────────────────────────────────┐
│ Cartão de Cidadão                    [Proprietário]  │
│                                                      │
│ Proprietário: [ Thaylane do Santos  ▾ ]              │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │  📄 Arraste ficheiros ou clique para seleccionar │ │
│ └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

Se existe apenas 1 proprietário, o select não aparece — o `owner_id` é associado automaticamente.

### 6.2 `components/acquisitions/acquisition-form.tsx` (loop de upload pós-criação)

**Problema actual (Step 4 do fluxo):**

```typescript
// ACTUAL — só envia property_id
const formData = new FormData()
formData.append('file', pending.file)
formData.append('doc_type_id', pending.doc_type_id)
formData.append('property_id', result.property_id)
```

**Correcção:**

```typescript
const formData = new FormData()
formData.append('file', pending.file)
formData.append('doc_type_id', pending.doc_type_id)
formData.append('property_id', result.property_id)

// Resolver owner_id real a partir do índice
if (pending.owner_id) {
  formData.append('owner_id', pending.owner_id)
} else if (pending.owner_index !== undefined && result.owner_ids?.[pending.owner_index]) {
  // owner_index refere o índice do owner no formulário
  // result.owner_ids é o array retornado pela API de angariação
  formData.append('owner_id', result.owner_ids[pending.owner_index])
}
```

**Nota:** A API `POST /api/acquisitions` já retorna `owner_ids` no resultado. Se não retorna, deve ser adicionado.

---

## 7. Modificação #3 — Upload em Tarefas de Processo

### `components/processes/task-upload-action.tsx`

**Problema:** Quando o utilizador faz upload de um documento numa tarefa UPLOAD de processo, o componente envia `property_id` e `doc_type_id` mas **não envia `owner_id`**.

**Solução:** Se a tarefa é de um tipo de documento de proprietário, o componente deve:

1. Verificar a `category` do `doc_type` (disponível via config ou fetch)
2. Se for "Proprietário*", buscar os proprietários do imóvel
3. Se houver apenas 1, usar automaticamente
4. Se houver múltiplos, mostrar select para o utilizador escolher

**Lógica simplificada (proprietário principal por defeito):**

```typescript
// No componente TaskUploadAction, ao construir o FormData:
const formData = new FormData()
formData.append('file', file)
formData.append('doc_type_id', docTypeId)
formData.append('property_id', propertyId)

// Se temos info de que é doc de proprietário, enviar owner_id
if (ownerId) {
  formData.append('owner_id', ownerId)
}
```

**Nota:** Neste contexto, a API de upload (Camada 2) e a trigger de BD (Camada 3) servem como fallback — mesmo que o frontend não envie `owner_id`, o backend resolve.

---

## 8. Verificação do Resultado Esperado

### Cenário A: Upload de CC no formulário de angariação

```
1. Consultor preenche Step 3 (proprietário: João Silva)
2. No Step 5, selecciona tipo "Cartão de Cidadão" e arrasta ficheiro
3. Clica "Criar Angariação"
4. POST /api/acquisitions → retorna { property_id, owner_ids: ["uuid-joao"] }
5. Loop de upload:
   FormData = { file, doc_type_id, property_id, owner_id: "uuid-joao" }
6. POST /api/documents/upload → INSERT doc_registry com owner_id preenchido
7. Trigger AFTER INSERT → auto-completa tarefa "Doc Identificação (CC)"
8. Progresso recalculado
```

### Cenário B: Upload de CC numa tarefa de processo

```
1. Gestora abre processo activo
2. Na tarefa "Doc Identificação (CC)", clica upload
3. Arrasta ficheiro
4. POST /api/documents/upload com { file, doc_type_id, property_id }
   → API infere owner_id (Camada 2) OU trigger preenche (Camada 3)
5. INSERT doc_registry com owner_id preenchido
6. Trigger AFTER INSERT → completa esta tarefa + qualquer outra do mesmo proprietário
7. Progresso recalculado em todos os processos afectados
```

### Cenário C: Proprietário com 2 imóveis

```
1. João Silva é proprietário do Imóvel A (processo activo) e Imóvel B (processo activo)
2. CC do João é carregado no contexto do Imóvel A
3. doc_registry: { property_id: A, owner_id: "uuid-joao", doc_type_id: CC }
4. Trigger AFTER INSERT detecta:
   - Caso 1: processos do Imóvel A → completa tarefa CC
   - Caso 2: busca property_owners por owner_id "uuid-joao"
     → encontra Imóvel A e Imóvel B
     → completa tarefa CC no processo do Imóvel B também
5. Ambos os processos recalculam progresso
```

---

## 9. Critérios de Sucesso

- [ ] Novo upload de doc "Proprietário" via angariação → `doc_registry.owner_id` preenchido
- [ ] Novo upload de doc "Proprietário" via tarefa de processo → `doc_registry.owner_id` preenchido
- [ ] Fallback API funciona: upload sem `owner_id` no FormData mas com `property_id` + doc de proprietário → `owner_id` inferido
- [ ] Fallback trigger funciona: INSERT directo em `doc_registry` sem `owner_id` → preenchido automaticamente
- [ ] Trigger `auto_complete_tasks_on_doc_insert` (AFTER INSERT) recebe `owner_id` correcto e completa tarefas em todos os processos do proprietário
- [ ] Labels em PT-PT: "Proprietário", "Seleccionar proprietário", "Documento associado a"
- [ ] `npm run build` sem erros

---

## 10. Categorias de doc_types Afectadas

Para referência, estas são as categorias cujos documentos devem ter `owner_id`:

| Categoria | Tipos de Documento |
|-----------|-------------------|
| `Proprietário` | Cartão de Cidadão, Comprovativo de Estado Civil, Ficha de Branqueamento de Capitais |
| `Proprietário Empresa` | Certidão Permanente da Empresa, Pacto Social / Estatutos, Ata de Poderes para Venda, RCBE, Ficha de Branqueamento (Empresa) |

**Categorias que NÃO devem ter `owner_id`:**

| Categoria | Exemplos |
|-----------|----------|
| `Imóvel` | Caderneta Predial, Certificado Energético, Planta do Imóvel |
| `Contratual` | Contrato de Mediação (CMI) |
| `Jurídico` | Certidão Permanente (CRP), Licença de Utilização, Escritura |
| `Jurídico Especial` | Habilitação de Herdeiros, Certidão de Óbito |

---

## 11. Resumo de Alterações

| Camada | Ficheiro | Tipo | Complexidade |
|--------|----------|------|-------------|
| BD | Migration: `auto_resolve_owner_id_on_doc_insert` | CRIAR | Simples |
| API | `app/api/documents/upload/route.ts` | MODIFICAR | Simples |
| Frontend | `components/acquisitions/acquisition-form.tsx` | MODIFICAR | Médio |
| Frontend | `components/documents/documents-section.tsx` (Step 5) | MODIFICAR | Médio |
| Frontend | `components/processes/task-upload-action.tsx` | MODIFICAR | Simples |
| Types | `types/document.ts` (PendingDocument) | MODIFICAR | Simples |

**Total:** 1 migration + 5 ficheiros modificados
