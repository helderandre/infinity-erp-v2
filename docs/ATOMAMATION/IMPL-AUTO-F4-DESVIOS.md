# IMPL-AUTO-F4-DESVIOS — Desvios da Implementação da Fase 4

**Data:** 2026-03-05
**Fase:** F4 — Templates de Mensagens WhatsApp
**Status:** ✅ Implementada

---

## 🔵 Desvios em Relação à Spec

### 1. Paths de páginas: `app/dashboard/` (NÃO `app/(dashboard)/`)

Conforme desvio global documentado em `DESVIOS-ACUMULADOS-F1-F3.md`, todas as páginas foram criadas em `app/dashboard/`:

```
CORRECTO:  app/dashboard/automacao/templates-wpp/page.tsx
CORRECTO:  app/dashboard/automacao/templates-wpp/editor/page.tsx
ERRADO:    app/(dashboard)/automacao/templates-wpp/...
```

### 2. Upload de média NÃO implementado nesta fase

A spec prevê upload de ficheiros para Supabase Storage (bucket `auto-media`). Nesta implementação, **o upload não foi incluído** — os campos de média aceitam URLs directos. Razões:

- O bucket `auto-media` precisa de ser criado no Supabase Dashboard
- O projecto usa Cloudflare R2 para uploads (não Supabase Storage) — seria necessário decidir qual usar
- A funcionalidade de URL directa cobre o caso de uso imediato

**Para implementar upload no futuro:** Adicionar zona de drag-and-drop no `wpp-message-editor.tsx` que envia para `/api/automacao/templates-wpp/upload` ou reutilizar o padrão R2 existente.

### 3. Preview com dados de amostra hardcoded (não dropdown de leads)

A spec prevê um dropdown "Pré-visualizar com" que permite selecionar um lead real da base de dados. Nesta implementação, os **dados são hardcoded** no `SAMPLE_VALUES` do `wpp-template-builder.tsx`.

Razão: Manter a fase focada no editor — a integração com selecção de lead real pode ser adicionada incrementalmente (basta adicionar um `Select` que carrega leads e passa os dados ao `WppPreview`).

### 4. Variable Picker inserção como texto (não pills visuais)

A spec prevê pills coloridas inline no campo de texto. Nesta implementação, as variáveis são inseridas como **texto `{{variável}}`** no Textarea. O VariablePicker abre num Popover e ao clicar insere a variável no texto.

Para pills visuais reais seria necessário Tiptap ou similar (spec menciona `@tiptap/react` + `@tiptap/extension-mention`). Pode ser adicionado numa iteração futura sem mudar a estrutura.

### 5. Tipo `WhatsAppTemplate` expandido com campo `tags`

O tipo `WhatsAppTemplate` em `lib/types/whatsapp-template.ts` foi actualizado para incluir `tags: string[]`, que corresponde à coluna `tags` na tabela `auto_wpp_templates` (jsonb array). Este campo já existia no banco mas não estava no tipo TypeScript.

### 6. Componente `RadioGroup` instalado

Foi instalado o componente shadcn `radio-group` para o selector de tipo de áudio (normal vs mensagem de voz) no `wpp-message-editor.tsx`.

---

## 📦 Ficheiros Criados na F4

### API Routes
```
app/api/automacao/templates-wpp/route.ts          ✅ GET lista + POST criar
app/api/automacao/templates-wpp/[id]/route.ts      ✅ GET detalhe + PUT actualizar + DELETE soft delete
```

### Componentes
```
components/automations/wpp-preview.tsx              ✅ Preview estilo WhatsApp com phone frame
components/automations/wpp-message-card.tsx          ✅ Card draggable com @dnd-kit/sortable
components/automations/wpp-message-editor.tsx        ✅ Sheet lateral para editar mensagem individual
components/automations/wpp-template-builder.tsx      ✅ Container principal com editor + preview lado a lado
components/automations/wpp-template-card.tsx          ✅ Card para listagem na biblioteca
```

### Hook
```
hooks/use-wpp-templates.ts                          ✅ (reescrito) CRUD completo + duplicar
```

### Páginas
```
app/dashboard/automacao/templates-wpp/page.tsx       ✅ Biblioteca com pesquisa + filtro categoria
app/dashboard/automacao/templates-wpp/editor/page.tsx ✅ Editor com query param ?id= para editar
```

### Tipos actualizados
```
lib/types/whatsapp-template.ts                      ✅ Adicionado campo `tags: string[]` ao WhatsAppTemplate
```

### Sidebar
```
components/layout/app-sidebar.tsx                   ✅ Adicionado "Templates WhatsApp" ao automationItems
```

---

## ✅ Critérios de Aceitação — Checklist

- [x] Criar template com 3+ mensagens de tipos diferentes
- [x] Reordenar mensagens via drag-and-drop e preview actualiza
- [ ] Upload de imagem/documento para Supabase Storage funciona — **ADIADO** (aceita URL directa)
- [x] Inserir variável como pill no texto da mensagem — **PARCIAL** (inserido como `{{variável}}`, não pill visual)
- [x] Preview ao vivo mostra mensagens estilo WhatsApp com variáveis resolvidas
- [ ] Mudar lead no dropdown do preview actualiza os valores — **ADIADO** (usa dados hardcoded)
- [x] Guardar template persiste `messages` JSON correctamente
- [x] Editar template existente carrega mensagens e permite modificar
- [x] Biblioteca lista templates com filtro por categoria e pesquisa
- [x] Duplicar template cria cópia com nome "Cópia de [nome]"
- [x] Eliminar template faz soft delete (is_active = false)
