# SPEC — Links de Anúncios (listing_links)

> **Módulo:** M03 — Imóveis
> **Data:** 2026-03-12
> **Estado:** Implementado
> **Dependências:** M07 (Templates — subtarefas form/field)

---

## 1. Contexto e Motivação

Os imóveis são publicados em vários portais (Idealista, Imovirtual, Casa Sapo, etc.) e até agora não havia forma de registar esses links no ERP. A equipa precisava de:

- Saber **onde** cada imóvel está anunciado
- Ter acesso rápido ao **link directo** do anúncio
- Registar a **data de publicação** (opcional) para controlo temporal

### Solução

Adicionar um campo JSONB `listing_links` na tabela `dev_property_internal` e um novo tipo de campo `link_external` no sistema de formulários dinâmicos das subtarefas.

---

## 2. Base de Dados

### Migração aplicada

```sql
ALTER TABLE dev_property_internal
ADD COLUMN listing_links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN dev_property_internal.listing_links IS
  'Array de links de anúncios do imóvel. Estrutura: [{ "site_name": "Idealista", "url": "https://...", "published_at": "2026-03-10" }]';
```

### Estrutura do JSONB

```json
[
  {
    "site_name": "Idealista",
    "url": "https://idealista.pt/imovel/12345",
    "published_at": "2026-03-10"
  },
  {
    "site_name": "Imovirtual",
    "url": "https://imovirtual.com/anuncio/67890",
    "published_at": ""
  }
]
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `site_name` | `string` | Sim | Nome do portal/site (ex: Idealista, Imovirtual) |
| `url` | `string` (URL) | Sim | Link directo do anúncio |
| `published_at` | `string` (ISO date) | Não | Data de publicação (YYYY-MM-DD). Se vazio, não é enviado. |

---

## 3. Novo Tipo de Campo: `link_external`

### 3.1 Type — `FormFieldType`

Adicionado `'link_external'` ao union type em `types/subtask.ts`:

```typescript
export type FormFieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'percentage'
  | 'select' | 'multiselect' | 'checkbox' | 'date' | 'email' | 'phone'
  | 'rich_text' | 'address_map' | 'media_upload'
  | 'link_external'  // ← NOVO
```

### 3.2 Interface — `ListingLink`

Nova interface em `types/subtask.ts`:

```typescript
export interface ListingLink {
  site_name: string
  url: string
  published_at?: string  // ISO date YYYY-MM-DD (opcional)
}
```

### 3.3 Registry — Campo no catálogo

Adicionado ao `FIELD_REGISTRY` em `lib/form-field-registry.ts`:

```typescript
{
  field_name: 'listing_links',
  label: 'Links de Anúncios',
  field_type: 'link_external',
  target_entity: 'property_internal',
  category: 'Contrato / Dados Internos',
}
```

O campo aparece no picker de campos na categoria **Contrato / Dados Internos** e pode ser usado em subtarefas do tipo **Formulário** (multi-campo) ou **Campo** (inline).

---

## 4. Componente: `LinkExternalFieldRenderer`

**Ficheiro:** `components/processes/link-external-field-renderer.tsx`

### Funcionalidades

- **Adicionar grupo:** Botão "Adicionar Link" cria um novo objecto vazio no array
- **Remover grupo:** Botão lixo (Trash2) em cada card remove o objecto
- **Edição inline:** Cada grupo tem 3 campos dispostos em grid 3 colunas:
  - Nome do Site (obrigatório)
  - Link/URL (obrigatório, `type="url"`)
  - Data de Publicação (opcional, `type="date"`)
- **Link clicável:** Quando o URL está preenchido, aparece link "Abrir link" com ícone `ExternalLink`
- **Empty state:** Quando não há links, mostra mensagem com ícone e sugestão

### Integração com o sistema de formulários

O renderer usa `useFormContext()` do react-hook-form para ler e escrever o valor do array directamente via `watch()` e `setValue()`, mantendo compatibilidade com o `DynamicFormRenderer`.

### Validação Zod

No `buildZodSchema()` de `dynamic-form-renderer.tsx`:

```typescript
if (field.field_type === 'link_external') {
  shape[key] = z.array(
    z.object({
      site_name: z.string().min(1, 'Nome do site é obrigatório'),
      url: z.string().url('URL inválido').min(1, 'Link é obrigatório'),
      published_at: z.string().optional().default(''),
    })
  ).default([])
}
```

### Renderização

O campo é tratado como **composite** (sempre `col-span-12`, full width) no grid do formulário dinâmico, tal como `address_map` e `media_upload`.

---

## 5. Validação de Templates

Em `lib/validations/template.ts`, `link_external` foi adicionado aos enums de `field_type` nas secções de validação de config de subtarefas (form sections e field config).

---

## 6. API — Leitura e Escrita

Sem alterações necessárias. A API existente em `app/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]/form/route.ts` já suporta o novo campo porque:

- **GET:** O Supabase retorna campos JSONB como arrays/objectos JS nativamente
- **PUT:** O upsert ao `dev_property_internal` aceita `{ listing_links: [...] }` directamente

---

## 7. Ficheiros Criados/Modificados

### Ficheiro criado:

| Ficheiro | Descrição |
|----------|-----------|
| `components/processes/link-external-field-renderer.tsx` | Renderer do campo `link_external` — array dinâmico de links |

### Ficheiros modificados:

| Ficheiro | Alteração |
|----------|-----------|
| `types/subtask.ts` | +`link_external` no `FormFieldType`, +interface `ListingLink` |
| `lib/form-field-registry.ts` | +entrada `listing_links` no `FIELD_REGISTRY` |
| `components/processes/dynamic-form-renderer.tsx` | +import renderer, +registo em `FIELD_COMPONENTS`, +schema Zod, +full width |
| `lib/validations/template.ts` | +`link_external` nos 2 enums de `field_type` |

---

## 8. Armazenamento no DB

| Campo | Tabela | Coluna | Tipo DB | Valor armazenado |
|-------|--------|--------|---------|------------------|
| Links de Anúncios | `dev_property_internal` | `listing_links` | `jsonb` | `[{ "site_name": "...", "url": "...", "published_at": "..." }]` |

O array vazio `[]` é o valor por defeito. Não há limite máximo de links.
