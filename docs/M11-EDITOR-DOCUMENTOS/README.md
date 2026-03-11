# 📚 Documentação do Editor de Documentos — Índice

Bem-vindo à documentação completa do **Editor de Documentos** para a plataforma ERP Infinity.

Este folder contém documentação estruturada em 3 arquivos principais:

---

## 📄 Arquivos de Documentação

### 1. **EDITOR-DOCUMENTOS-GUIDE.md** — Guia Completo
**Comece aqui!** 

Visão geral abrangente do módulo, incluindo:
- ✅ Visão geral e stack tecnológico
- ✅ Arquitetura e fluxo de dados
- ✅ Descrição de cada componente (high-level)
- ✅ Documentação de hooks (conceitual)
- ✅ Types & Interfaces (overview)
- ✅ Configuração (Google Fonts, TipTap, Tippy)
- ✅ Integração com API
- ✅ Guia de uso (4 cenários comuns)
- ✅ Exemplos práticos em código
- ✅ Troubleshooting comum
- ✅ Schema do banco de dados
- ✅ Performance tips
- ✅ Roadmap futuro

**Tempo de leitura:** ~30-40 min  
**Propósito:** Entender o módulo, começar a usar, resolver problemas comuns

---

### 2. **COMPONENTS-REFERENCE.md** — API Referência de Componentes
**Consulta técnica detalhada de componentes**

Documentação linha-por-linha de cada componente:

| Componente | Linhas | Conteúdo |
|------------|--------|----------|
| **DocumentEditor** | 80 | Props, Ref API (7 métodos), State, TipTap config, Lifecycle |
| **DocumentToolbar** | 120 | Props, 8 grupos de controlos, eventos, implementação |
| **DocumentBubbleMenu** | 100 | Props, 6 tipos de botões, renderização, Tippy config |
| **DocumentSlashCommand** | 140 | Estrutura, 12 comandos disponíveis, menu visuals |
| **DocumentSettingsPanel** | 80 | 3 abas (variáveis, settings, metadata), sub-componentes |
| **DocumentImportDialog** | 90 | Props, fluxo DOCX import, limpeza HTML, validação |
| **Custom Extensions** | 100 | VariableNode, PageBreak, estrutura extensível |

**Tempo de leitura:** Por componente (5-10 min cada)  
**Propósito:** Implementar novos componentes, estender funcionalidade, debugar issues

---

### 3. **HOOKS-TYPES-REFERENCE.md** — API Referência de Hooks & Types
**Documentação técnica de hooks e type definitions**

Cobre:
- **Hooks** (5 total):
  - `useEditor()` ← TipTap core
  - `useTemplateVariables()` ← Fetch variáveis
  - `useEmailTemplate()` ← Fetch template individual
  - `useEmailTemplates()` ← Fetch listagem
  - `useImperativeHandle()` ← Ref pattern

- **Types** (15+ interfaces):
  - `Template` variants (Base, WithContent, Input)
  - `TemplateVariable`
  - `EditorMode` e `DocumentEditorProps`
  - `DocumentEditorRef`
  - Custom extension types

- **Constantes**:
  - `EDITOR_FONTS` (12 fontes Google)
  - Page formats, font sizes, line heights
  - Color presets

- **Utilitários** (funções helper):
  - `cleanDocxHtml()`
  - `renderTemplate()`
  - `validateTemplateHTML()`

**Tempo de leitura:** Por hook/type (3-5 min cada)  
**Propósito:** Integrar hooks em componentes, entender tipos, usar utilitários

---

## 🗺️ Mapa de Navegação

### Se você quer...

**📖 Aprender o módulo do zero**
1. Ler [EDITOR-DOCUMENTOS-GUIDE.md](#1-editor-documentos-guidmd-–-guia-completo) seção 1-3 (Visão Geral + Arquitetura)
2. Ler exemplos práticos na seção "Guia de Uso"
3. Ir para [COMPONENTS-REFERENCE.md](#2-components-referenccemd-–-api-referência-de-componentes) para detalhe específico

**🔧 Implementar nova funcionalidade**
1. Procurar componente relacionado em [COMPONENTS-REFERENCE.md](#2-components-referenccemd-–-api-referência-de-componentes)
2. Copiar código de exemplo
3. Consultar [HOOKS-TYPES-REFERENCE.md](#3-hooks-types-referencmd-–-api-referência-de-hooks--types) se precise de tipos

**🐛 Debugar um problema**
1. Ir a [EDITOR-DOCUMENTOS-GUIDE.md](#1-editor-documentos-guidmd-–-guia-completo) seção "Troubleshooting"
2. Se não encontrar, procurar componente em [COMPONENTS-REFERENCE.md](#2-components-referenccemd-–-api-referência-de-componentes)
3. Verificar tipos em [HOOKS-TYPES-REFERENCE.md](#3-hooks-types-referencmd-–-api-referência-de-hooks--types)

**🚀 Estender o editor**
1. Ler [EDITOR-DOCUMENTOS-GUIDE.md](#1-editor-documentos-guidmd-–-guia-completo) "Arquitetura" + "Custom Extensions"
2. Estudar extensão existente em [COMPONENTS-REFERENCE.md](#2-components-referenccemd-–-api-referência-de-componentes)
3. Criar nova extension seguindo padrão

**📡 Integrar com API/Backend**
1. Ler [EDITOR-DOCUMENTOS-GUIDE.md](#1-editor-documentos-guidmd-–-guia-completo) "API Integration"
2. Usar hooks em [HOOKS-TYPES-REFERENCE.md](#3-hooks-types-referencmd-–-api-referência-de-hooks--types)
3. Consultar types de response

---

## 📊 Estatísticas da Documentação

| Métrica | Valor |
|---------|-------|
| **Total de páginas** | 3 arquivos .md |
| **Total de linhas** | ~2,500+ linhas |
| **Componentes documentados** | 6 principais + extensões |
| **Hooks documentados** | 5 hooks |
| **Types/Interfaces** | 15+ interfaces |
| **Constantes definidas** | 5 conjuntos |
| **Exemplos de código** | 30+ snippets |
| **Seções troubleshooting** | 4 problemas comuns |

---

## 🎯 Quick Reference — Localização de Ficheiros

### Componentes (fysicamente no código)

```
components/document-editor/
├── document-editor.tsx              → Consulte COMPONENTS-REFERENCE.md L100-180
├── document-toolbar.tsx             → Consulte COMPONENTS-REFERENCE.md L300-420
├── document-bubble-menu.tsx         → Consulte COMPONENTS-REFERENCE.md L450-550
├── document-slash-command.tsx       → Consulte COMPONENTS-REFERENCE.md L600-740
├── document-settings-panel.tsx      → Consulte COMPONENTS-REFERENCE.md L770-850
├── document-import-dialog.tsx       → Consulte COMPONENTS-REFERENCE.md L880-960
├── extensions/
│   ├── variable-node.ts             → Consulte COMPONENTS-REFERENCE.md L1000-1050
│   ├── slash-command.ts             → Consulte COMPONENTS-REFERENCE.md L1050-1080
│   ├── page-break.ts                → Consulte COMPONENTS-REFERENCE.md L1080-1100
│   └── ...
└── types.ts                         → Consulte HOOKS-TYPES-REFERENCE.md L200-500
```

### Hooks (fysicamente no código)

```
hooks/
├── use-template-variables.ts        → Consulte HOOKS-TYPES-REFERENCE.md L50-150
├── use-email-template.ts            → Consulte HOOKS-TYPES-REFERENCE.md L200-350
├── use-email-templates.ts           → Consulte HOOKS-TYPES-REFERENCE.md L400-500
└── ...
```

### Tipos Centralizados

```
types/
├── template.ts                      → Consulte HOOKS-TYPES-REFERENCE.md L550-800
└── ...
```

### Páginas

```
app/dashboard/templates-documentos/
├── page.tsx                         → Exemplos em EDITOR-DOCUMENTOS-GUIDE.md L450-500
├── novo/page.tsx                    → Exemplos em EDITOR-DOCUMENTOS-GUIDE.md L520-550
└── [id]/page.tsx                    → Exemplos em EDITOR-DOCUMENTOS-GUIDE.md L570-610
```

---

## 📋 Checklist Verde — O Que Está Documentado

### Componentes
- [x] DocumentEditor (core)
- [x] DocumentToolbar (top bar)
- [x] DocumentBubbleMenu (inline menu)
- [x] DocumentSlashCommand (/ menu)
- [x] DocumentSettingsPanel (sidebar)
- [x] DocumentImportDialog (DOCX import)

### Custom Extensions
- [x] VariableNode ({{variable}})
- [x] SlashCommand (framework)
- [x] PageBreak (word-break)
- [x] Indent (indentação)

### Hooks
- [x] useEditor() [TipTap built-in]
- [x] useTemplateVariables()
- [x] useEmailTemplate()
- [x] useEmailTemplates()
- [x] useImperativeHandle() [React built-in]

### Types & Interfaces
- [x] Template variants (Base, WithContent, Input)
- [x] TemplateVariable
- [x] EditorMode
- [x] DocumentEditorProps
- [x] DocumentEditorRef
- [x] Custom extension types
- [x] API response types

### Configuração
- [x] Google Fonts integration
- [x] TipTap extensions setup
- [x] Tippy theming
- [x] Environment variables

### API Integration
- [x] GET /api/libraries/docs/:id
- [x] POST /api/libraries/docs
- [x] PUT /api/libraries/docs/:id
- [x] DELETE /api/libraries/docs/:id
- [x] GET /api/libraries/docs (list)
- [x] GET /api/libraries/template-variables

### Database
- [x] tpl_doc_library schema
- [x] tpl_template_variables schema (reference)

### Padrões & Exemplos
- [x] Create new template flow
- [x] Edit existing template flow
- [x] Use in modal dialog
- [x] Render template with data
- [x] DOCX import
- [x] Variable insertion
- [x] Save with validation

### Troubleshooting (4 problemas)
- [x] BubbleMenu not appearing
- [x] Variables not rendering
- [x] DOCX import fails
- [x] Dropdown text wrapping

---

## 🔄 Manutenção & Atualizações

Esta documentação foi criada em **25 de Fevereiro de 2026**.

**Quando atualizar esta documentação:**

1. ✏️ **Novo componente adicionado**
   - Adicionar entrada em COMPONENTS-REFERENCE.md
   - Actualizar seção "Arquitetura" em EDITOR-DOCUMENTOS-GUIDE.md

2. ✏️ **Novo hook customizado**
   - Adicionar em HOOKS-TYPES-REFERENCE.md
   - Adicionar exemplo em EDITOR-DOCUMENTOS-GUIDE.md

3. ✏️ **Novo type/interface**
   - Adicionar em HOOKS-TYPES-REFERENCE.md secção "Types"
   - Atualizar exemplo de uso se relevante

4. ✏️ **Bug fix ou melhoria**
   - Actualizar seção relevante (Troubleshooting / Performance Tips / etc.)

5. ✏️ **Mudança na API**
   - Actualizar "API Integration" em EDITOR-DOCUMENTOS-GUIDE.md
   - Atualizar types em HOOKS-TYPES-REFERENCE.md

---

## 🤝 Contribuições & Feedback

Esta documentação é **viva** e deve evoluir com o código.

**Format permitido:**
- Markdown (.md)
- GitHub Flavored Markdown (GFM)
- Code fences com syntax highlight (typescript, javascript, sql, etc.)

**Manter:**
- Português de Portugal (PT-PT)
- Nomes técnicos em inglês quando aplicável
- Exemplos em código real + typescript types
- Links internos entre os 3 ficheiros

---

## 📞 Referências Externas

- [TipTap Documentation](https://tiptap.dev)
- [React Hooks Documentation](https://react.dev/reference/react)
- [Tippy.js Positioning](https://popper.js.org)
- [Mammoth.js (DOCX Parser)](https://github.com/mwilkinson/mammoth.js)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Supabase PostgreSQL](https://supabase.com/docs/guides/database)
- [Next.js App Router](https://nextjs.org/docs)

---

## 🎓 Learning Path — Recomendado

### 👨‍🎓 Iniciante (0-2h)
1. EDITOR-DOCUMENTOS-GUIDE.md — Visão Geral (15 min)
2. EDITOR-DOCUMENTOS-GUIDE.md — Arquitetura (15 min)
3. EDITOR-DOCUMENTOS-GUIDE.md — Exemplo 1 (Create) + Exemplo 3 (DOCX) (20 min)
4. Tentar reproduzir uma das páginas

### 📚 Intermediário (2-6h)
1. COMPONENTS-REFERENCE.md — DocumentEditor + DocumentToolbar (30 min)
2. HOOKS-TYPES-REFERENCE.md — useEditor() + useTemplateVariables() (20 min)
3. Fazer pequena customização (novo botão na toolbar, etc.)
4. EDITOR-DOCUMENTOS-GUIDE.md — API Integration section (20 min)

### 🚀 Avançado (6h+)
1. COMPONENTS-REFERENCE.md — Todas as extensões + menu components (1h)
2. HOOKS-TYPES-REFERENCE.md — Todos os types (30 min)
3. Criar nova extension (PageBreak variant, custom mark, etc.)
4. Integrar com backend (nova API route para template)
5. EDITOR-DOCUMENTOS-GUIDE.md — Roadmap Futuro (20 min)

---

## 📌 Notas Importantes

1. **Tippy Theme**:require CSS import em globals.css (já feito)

2. **Google Fonts**: 12 fontes instaladas, @import no topo de globals.css

3. **Variable Decoration**: Renderizadas com background amarelo (CSS customizável)

4. **Modo Read-only**: editor.isEditable = false previne edições

5. **Performance**:
   - Lazy load extensions pesadas se necessário
   - Debounce onChange events para auto-save
   - Limitar a 100k caracteres

6. **Database**: Tabela `tpl_doc_library` com campos `letterhead_*` para timbrado

7. **Segurança**: Sanitizar templates antes de render (usar DOMPurify se renderizar user HTML)

---

**Documentação criada com ❤️ para facilitar desenvolvimento e manutenção do Editor de Documentos**

Última actualização: **25 de Fevereiro de 2026**  
Versão: **1.0**  
Maintainer: Claude Code Assistant
