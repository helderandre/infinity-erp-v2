# Email Editor - Documentacao Completa

## 1. Visao Geral

O Email Editor e um editor visual drag-and-drop para criar templates de email HTML. Construido sobre a biblioteca **Craft.js**, permite ao utilizador compor emails arrastando blocos (texto, imagens, botoes, contentores, grelhas, etc.) e configurar cada um via painel de propriedades. O resultado final e convertido em HTML compativel com clientes de email (Gmail, Outlook) usando layout baseado em `<table>` em vez de flexbox/grid.

### 1.1 Modos de edicao

O editor expoe tres modos via toggle na topbar:

- **Padrao (`standard`)** — editor Tiptap rico com toolbar fixa no topo (fonte, tamanho, B/I/U, cor, alinhamento, listas, citacao, divisor) e slash-menu (`/`) para inserir titulos, imagem, botao, anexo, etc. O envelope institucional (Cabecalho + Assinatura + Rodape) e renderizado em volta de forma imutavel. Use para a maioria dos emails — texto corrido com alguns blocos.
- **Avancado (`advanced`)** — canvas Craft.js com toolbox + camadas + propriedades. Use para layouts multi-coluna, grelha de imoveis, links de portais, e composicoes que o Padrao nao representa.
- **Pre-visualizar (`preview`)** — snapshot do estado actual renderizado com dados reais (via selecao de imovel/proprietario/consultor). Funciona identicamente a partir de qualquer modo de edicao.

### 1.2 Componentes suportados por modo

| Componente | Padrao | Avancado |
|---|---|---|
| Paragrafo / formatacao inline (B/I/U/strike/cor/alinhamento) | ✅ | ✅ |
| Titulos H1-H4 | ✅ | ✅ (`EmailHeading`) |
| Listas (ordenadas e nao-ordenadas) | ✅ | ✅ |
| Citacao | ✅ | ✅ |
| Link | ✅ | ✅ |
| Imagem (upload R2 ou URL) | ✅ | ✅ (`EmailImage`) |
| Botao | ✅ (`EmailButtonNode` Tiptap) | ✅ (`EmailButton`) |
| Divisor | ✅ (`<hr>`) | ✅ (`EmailDivider`) |
| Anexo | ✅ (`EmailAttachmentNode` Tiptap) | ✅ (`EmailAttachment`) |
| Variaveis `{{chave}}` via `@` | ✅ | ✅ |
| Espacador | — | ✅ (`EmailSpacer`) |
| Grelha multi-coluna | — | ✅ (`EmailGrid`) |
| Grelha de imoveis | — | ✅ (`EmailPropertyGrid`) |
| Links de portais | — | ✅ (`EmailPortalLinks`) |

So os componentes da seccao "—" geram o `AlertDialog` de perda quando o utilizador toggles `advanced → standard`.

### 1.3 Heuristica de auto-seleccao ao abrir um template

Em `/dashboard/templates-email/[id]`:

1. `editor_state === null` e `body_html !== ''` → abre em **Padrao**, Tiptap seeded com o `body_html`.
2. `isStandardCompatible(editor_state)` → abre em **Padrao**, com `extractStandardContent` a converter cada no representavel (text/heading/image/button/divider/attachment) em HTML Tiptap-compativel.
3. Caso contrario → abre em **Avancado**.

Helpers em [`lib/email/standard-state.ts`](../../lib/email/standard-state.ts):
- `buildStandardState({ html, signatureConsultantId? })` — constroi a shape canonica.
- `isStandardCompatible(editorState)` — todos os nos nao-envelope sao representaveis em Padrao.
- `extractStandardContent(editorState)` — serializa cada no advanced para HTML inline que o Tiptap do Padrao consegue re-parsear via `parseHTML` dos custom nodes.

### 1.4 Shape canonica do `editor_state` para modo Padrao

```
ROOT (EmailContainer, canvas, padding=0, gap=0)
  ├── EmailHeader
  ├── EmailContainer (canvas, padding=24, gap=8)
  │     └── EmailText { html: <tiptap HTML rico>, fontSize=15, color=#404040, ... }
  ├── EmailSignature { consultantId? }
  └── EmailFooter
```

O `EmailText.html` pode conter qualquer marcacao Tiptap — `<h1>..<h4>`, `<img>`, `<a data-email-button>`, `<hr>`, `<div data-email-attachment>`, listas, etc. O `renderEmailToHtml` em `lib/email-renderer.ts` trata blocos inline atraves de `renderText` (que ja detecta `ul/ol/table/blockquote/hr`).

### 1.5 Standard mode — arquitectura

```
components/email-editor/standard/
├── email-standard-canvas.tsx      — orquestra toolbar + Tiptap + dialogs + envelope estatico
├── use-standard-tiptap.ts         — hook com StarterKit (H1-H4, hr, blockquote), Image,
│                                     VariableMention (@), SlashCommand (/), custom nodes
├── standard-toolbar.tsx           — toolbar fixa (Undo/Redo, fonte, tamanho, B/I/U/S, cor,
│                                     alinhamento, listas, citacao, blocos, limpar formatacao)
├── slash-menu.tsx                 — Extension+Suggestion+tippy, items H1/H2/H3, Imagem,
│                                     Botao, Anexo, Divisor, Citacao, Lista/Lista numerada
├── insert-dialogs.tsx             — Dialogs modais para Botao, Imagem, Anexo, Link
├── static-email-header.tsx        — versao sem useNode, visualmente identica ao Craft.js
├── static-email-signature.tsx     — idem, usa hooks/use-resolved-signature.ts
├── static-email-footer.tsx        — idem
└── nodes/
    ├── button-node.ts             — Tiptap Node atom, parseHTML/renderHTML com data-attrs
    └── attachment-node.ts         — idem, armazena fileUrl/fileName/fileSize/required
```

Uploads reusam os endpoints existentes: `/api/libraries/emails/upload` (imagem) e `/api/libraries/emails/upload-attachment` (anexo).

### 1.6 Toggle entre modos

- `Padrao → Avancado`: sempre lossless. O HTML do Tiptap e sincronizado para o `EmailText` central. Via fast path (Craft.js state ja na shape canonica): `actions.setProp` preserva props custom. Via fallback: `buildStandardState` + `actions.deserialize`.
- `Avancado → Padrao`: lossless se todos os nos nao-envelope forem representaveis em Padrao (heading/image/button/divider/attachment/text) — cada um serializa para HTML inline equivalente. Lossy se existir qualquer `EmailSpacer`, `EmailGrid`, `EmailPropertyGrid`, `EmailPortalLinks`, ou `EmailContainer` aninhado — `AlertDialog` lista a contagem, so muda apos confirmacao.
- Qualquer modo `→ Preview`: em Padrao sincroniza Tiptap para Craft.js primeiro, depois `query.serialize()` alimenta o `EmailPreviewPanel`.

### Localizacao no Projecto

```
components/email-editor/
  email-editor.tsx             -- Componente principal (orquestrador)
  email-topbar.tsx             -- Barra superior (nome, assunto, undo/redo, guardar, modo)
  email-toolbox.tsx            -- Painel esquerdo (drag de componentes)
  email-settings-panel.tsx     -- Painel direito: propriedades do nodo seleccionado
  email-layer.tsx              -- Painel direito: arvore de camadas
  email-render-node.tsx        -- Overlay de seleccao/hover + duplicacao
  email-preview-panel.tsx      -- Modo pre-visualizacao com dados reais
  email-variables-context.tsx  -- Context React para variaveis resolvidas
  color-picker-field.tsx       -- Campo reutilizavel de seleccao de cor
  settings/
    index.ts                   -- Re-exports
    unit-input.tsx             -- Input numerico com unidade (px, %, em)
    radius-input.tsx           -- Input de border-radius (4 cantos, link/unlink)
    spacing-input.tsx          -- Input de padding/margin (4 lados, link/unlink)
  user/
    email-container.tsx        -- Bloco contentor (flex column/row)
    email-text.tsx             -- Bloco de texto (contentEditable + variaveis)
    email-heading.tsx          -- Bloco de titulo (h1-h4)
    email-image.tsx            -- Bloco de imagem (upload R2 ou URL)
    email-button.tsx           -- Bloco de botao CTA
    email-divider.tsx          -- Linha divisoria (hr)
    email-spacer.tsx           -- Espacador vertical
    email-attachment.tsx       -- Bloco de anexo (ficheiro carregado)
    email-grid.tsx             -- Grelha CSS grid (renderizada como <table>)
```

### Ficheiros Relacionados

```
lib/email-renderer.ts                          -- Renderizacao Craft.js state -> HTML email-safe
lib/validations/email-template.ts              -- Schema Zod para validacao
hooks/use-template-variables.ts                -- Hook para carregar variaveis de template
app/api/libraries/emails/route.ts              -- GET (listar) + POST (criar) templates
app/api/libraries/emails/[id]/route.ts         -- GET + PUT + DELETE template
app/api/libraries/emails/upload/route.ts       -- Upload de imagens para R2
app/api/libraries/emails/upload-attachment/route.ts -- Upload de anexos para R2
app/api/libraries/emails/preview-data/route.ts -- Resolucao dinamica de variaveis
app/dashboard/templates-email/page.tsx         -- Listagem de templates
app/dashboard/templates-email/novo/page.tsx    -- Criacao (editor vazio)
app/dashboard/templates-email/[id]/page.tsx    -- Edicao (editor com dados carregados)
```

---

## 2. Bibliotecas e Dependencias

### Craft.js (biblioteca core do editor)

| Pacote | Uso |
|--------|-----|
| `@craftjs/core` | Editor, Frame, Element, useNode, useEditor, NodeTree |
| `@craftjs/utils` | ROOT_NODE, getRandomId |
| `@craftjs/layers` | Layers (painel de camadas visual) |

O Craft.js e um framework de page builder para React. Cada bloco do email e um componente React registado como "User Component" com uma propriedade estatica `.craft` que define:
- `displayName` - nome visivel no editor
- `props` - valores por defeito
- `related.settings` - componente React que renderiza o painel de configuracao
- `rules.canDrag`, `rules.canMoveIn` - permissoes de drag/drop

### UI Components (shadcn/ui)

Usados extensivamente nos paineis de configuracao:
- `Button`, `Input`, `Label`, `Switch`, `Badge`
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
- `ToggleGroup`, `ToggleGroupItem`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Popover`, `PopoverContent`, `PopoverTrigger`
- `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList`
- `ScrollArea`, `Separator`
- `ColorPicker` (componente completo com area, hue, alpha, eyedropper)

### Outras Dependencias

| Dependencia | Uso |
|------------|-----|
| `sonner` | Toasts de feedback (sucesso/erro) |
| `lucide-react` | Icones em toda a UI |
| `react-dom` (createPortal) | Toolbar flutuante sobre os nodos seleccionados |
| `@aws-sdk/client-s3` | Upload de imagens/anexos para Cloudflare R2 |
| `browser-image-compression` (via `useImageCompress`) | Compressao de imagens antes do upload |

---

## 3. Arquitectura do Editor

### 3.1 Componente Principal: `EmailEditorComponent`

**Ficheiro:** `components/email-editor/email-editor.tsx`

```
Props:
  initialData: string | null     -- Estado Craft.js serializado (JSON string) ou null para novo
  templateId: string | null      -- UUID do template (null para novo)
  initialName: string            -- Nome do template
  initialSubject: string         -- Assunto do email
  initialDescription: string     -- Descricao
```

**Fluxo:**
1. Recebe `initialData` (JSON string do Craft.js ou null)
2. Sanitiza o estado com `sanitizeEditorState()` para corrigir IDs duplicados
3. Renderiza o `<Editor>` do Craft.js com o `resolver` de componentes
4. Dois modos: `edit` (editor visual) e `preview` (HTML renderizado)

### 3.2 Resolver de Componentes

O resolver mapeia nomes de componentes para as classes React:

```typescript
const resolver = {
  EmailContainer,
  EmailText,
  EmailHeading,
  EmailImage,
  EmailButton,
  EmailDivider,
  EmailSpacer,
  EmailAttachment,
  EmailGrid,
}
```

Estes nomes sao usados na serializacao JSON (`type.resolvedName`) e devem corresponder exactamente.

### 3.3 Layout do Editor (modo `edit`)

```
+------------------------------------------------------------------+
|  EmailTopbar (nome, assunto, modo, undo/redo, guardar)           |
+------------------------------------------------------------------+
| EmailToolbox | Canvas (Frame)              | RightSidebar        |
| (w-72)       | (flex-1, bg-muted/30)       | (w-72)              |
|              |                              |                     |
| Conteudo     | +------------------------+  | Tabs:               |
|  - Texto     | | EmailContainer (root)  |  | - Propriedades      |
|  - Titulo    | | +--------------------+ |  |   (EmailSettings)   |
|  - Botao     | | | [componentes]      | |  | - Camadas           |
|  - Anexo     | | +--------------------+ |  |   (Layers)          |
|              | +------------------------+  |                     |
| Media        |   maxWidth: 620px           |                     |
|  - Imagem    |                              |                     |
|              |                              |                     |
| Estrutura    |                              |                     |
|  - Contentor |                              |                     |
|  - Grelha    |                              |                     |
|  - Divisor   |                              |                     |
|  - Espacador |                              |                     |
+--------------+------------------------------+---------------------+
```

### 3.4 Serializacao e Persistencia

O estado do editor e um objecto JSON (Craft.js `query.serialize()`). Cada nodo tem:

```typescript
{
  "ROOT": {
    "type": { "resolvedName": "EmailContainer" },
    "isCanvas": true,
    "props": { "padding": "24px", "background": "#ffffff", ... },
    "nodes": ["node-1", "node-2"],
    "linkedNodes": {},
    "parent": null
  },
  "node-1": {
    "type": { "resolvedName": "EmailText" },
    "props": { "html": "Olá {{proprietario_nome}}", "fontSize": 16, ... },
    "nodes": [],
    "parent": "ROOT"
  }
}
```

Ao guardar, o componente:
1. Serializa o estado via `query.serialize()` -> JSON string
2. Renderiza para HTML via `renderEmailToHtml(editorState, {})` -> `body_html`
3. Envia para a API: `{ name, subject, description, body_html, editor_state }`
4. A API guarda na tabela `tpl_email_library`

---

## 4. Componentes de Bloco (User Components)

### 4.1 EmailContainer

**Ficheiro:** `user/email-container.tsx`

Contentor flexbox que pode ser vertical (coluna) ou horizontal (linha). Aceita filhos (canvas = true).

| Propriedade | Tipo | Default | Descricao |
|-------------|------|---------|-----------|
| direction | 'column' \| 'row' | 'column' | Direccao do flex |
| align | string | 'stretch' | align-items |
| justify | string | 'flex-start' | justify-content |
| gap | number | 8 | Espaco entre filhos (px) |
| padding | string \| number | '24px' | CSS padding (shorthand) |
| margin | string \| number | '0px' | CSS margin (shorthand) |
| width | string | '100%' | Largura (auto, 100%, 50%) |
| background | string | '#ffffff' | Cor de fundo |
| borderWidth | number | 0 | Largura da borda |
| borderColor | string | 'transparent' | Cor da borda |
| borderRadius | string | '0px' | Radius (shorthand 4 cantos) |
| boxShadow | string | 'none' | Sombra (presets) |
| minHeight | string \| number | 'auto' | Altura minima |

**Settings:** Direcao toggle, align/justify toggles, gap, padding (SpacingInput), margin (SpacingInput), largura, min-height, cor de fundo (ColorPicker), borda width/cor, radius (RadiusInput), sombra (Select presets).

### 4.2 EmailText

**Ficheiro:** `user/email-text.tsx`

Bloco de texto com edicao inline (contentEditable). Suporta **variaveis de template** (`{{proprietario_nome}}`) com highlight visual no editor.

| Propriedade | Tipo | Default | Descricao |
|-------------|------|---------|-----------|
| html | string | 'Texto de exemplo' | Conteudo HTML |
| fontSize | number | 16 | Tamanho da fonte (px) |
| color | string | '#000000' | Cor do texto |
| textAlign | string | 'left' | Alinhamento |
| lineHeight | number | 1.5 | Altura da linha |
| fontFamily | string | 'Arial, sans-serif' | Fonte |
| rows | number | undefined | Linhas minimas |

**Funcionalidades especiais:**
- **contentEditable** - o texto e editavel directamente no canvas
- **Variaveis**: `{{var}}` sao destacadas com um `<span>` estilizado (fundo muted, borda, monospace)
- **Insercao de variaveis**: no painel settings, clicar numa variavel insere-a na posicao do cursor
- **Formatacao inline**: Bold, Italic, Underline, Strikethrough via `document.execCommand()`
- **13 fontes** disponiveis (Arial, Helvetica, Verdana, Georgia, Times New Roman, etc.)

### 4.3 EmailHeading

**Ficheiro:** `user/email-heading.tsx`

Identico ao EmailText mas renderiza como `<h1>`-`<h4>`. Adiciona:

| Propriedade | Tipo | Default | Descricao |
|-------------|------|---------|-----------|
| level | 'h1'\|'h2'\|'h3'\|'h4' | 'h2' | Nivel do heading |
| fontWeight | string | '700' | Peso (400, 600, 700, 900) |
| padding | number | 0 | Padding interno |

### 4.4 EmailImage

**Ficheiro:** `user/email-image.tsx`

Bloco de imagem com upload para Cloudflare R2 ou URL directa.

| Propriedade | Tipo | Default | Descricao |
|-------------|------|---------|-----------|
| src | string | '' | URL da imagem |
| alt | string | '' | Texto alternativo |
| width | number | 100 | Largura em % (10-100) |
| height | number | 0 | Altura em px (0 = auto) |
| align | string | 'center' | Alinhamento |
| href | string | '' | Link ao clicar |
| borderRadius | string | '0px' | Radius |
| boxShadow | string | 'none' | Sombra |

**Upload:**
1. Utilizador selecciona ficheiro (JPEG, PNG, WebP - max 5MB)
2. Comprime via `useImageCompress` (browser-image-compression)
3. Envia para `POST /api/libraries/emails/upload`
4. API faz upload para R2 em `public/templates/email/{timestamp}-{filename}`
5. Retorna URL publica

### 4.5 EmailButton

**Ficheiro:** `user/email-button.tsx`

Botao CTA renderizado como `<a>` com estilos inline.

| Propriedade | Tipo | Default | Descricao |
|-------------|------|---------|-----------|
| text | string | 'Clique aqui' | Texto do botao |
| href | string | '#' | URL destino |
| backgroundColor | string | '#576c98' | Cor de fundo |
| color | string | '#fafafa' | Cor do texto |
| borderRadius | string | '65px' | Radius (pill por defeito) |
| fontSize | number | 16 | Tamanho |
| paddingX | number | 24 | Padding horizontal |
| paddingY | number | 12 | Padding vertical |
| align | string | 'center' | Alinhamento |
| fullWidth | boolean | false | Largura total |
| boxShadow | string | 'none' | Sombra |

### 4.6 EmailDivider

**Ficheiro:** `user/email-divider.tsx`

Linha divisoria (`<hr>`).

| Propriedade | Tipo | Default | Descricao |
|-------------|------|---------|-----------|
| color | string | '#e5e7eb' | Cor da linha |
| thickness | number | 1 | Espessura (px) |
| marginY | number | 16 | Margem vertical (px) |
| style | 'solid'\|'dashed'\|'dotted' | 'solid' | Estilo da linha |

### 4.7 EmailSpacer

**Ficheiro:** `user/email-spacer.tsx`

Espacador vertical simples.

| Propriedade | Tipo | Default | Descricao |
|-------------|------|---------|-----------|
| height | number | 20 | Altura em px (min 4) |

### 4.8 EmailAttachment

**Ficheiro:** `user/email-attachment.tsx`

Bloco de anexo com upload de ficheiro para R2.

| Propriedade | Tipo | Default | Descricao |
|-------------|------|---------|-----------|
| label | string | 'Documento anexo' | Titulo |
| description | string | '' | Descricao |
| docTypeId | string | '' | UUID do tipo de documento |
| required | boolean | true | Obrigatorio? |
| fileUrl | string | '' | URL do ficheiro |
| fileName | string | '' | Nome do ficheiro |
| fileSize | number | 0 | Tamanho em bytes |

**Upload:**
- Aceita: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, WebP
- Max: 10MB
- Endpoint: `POST /api/libraries/emails/upload-attachment`
- Armazena em R2: `public/templates/email/{timestamp}-{filename}`

**Renderizacao no email:** Card table-based com icone, titulo, badge (Obrigatorio/Opcional) e link de download.

### 4.9 EmailGrid

**Ficheiro:** `user/email-grid.tsx`

Grelha CSS grid que aceita filhos. Renderizada como `<table>` no email final.

| Propriedade | Tipo | Default | Descricao |
|-------------|------|---------|-----------|
| columns | number | 2 | Numero de colunas (1-6) |
| rows | number | 1 | Numero de linhas (1-6) |
| gap | number | 16 | Espaco entre celulas (px) |
| columnSizes | string | '' | Tamanhos personalizados (ex: '1fr 2fr') |
| rowSizes | string | '' | Tamanhos de linhas |
| padding | string \| number | '0px' | Padding |
| background | string | 'transparent' | Cor de fundo |
| borderRadius | string | '0px' | Radius |
| borderColor | string | 'transparent' | Cor da borda |
| borderWidth | number | 0 | Largura da borda |
| boxShadow | string | 'none' | Sombra |
| minHeight | number | 60 | Altura minima |

---

## 5. Componentes de UI do Editor

### 5.1 EmailTopbar

**Ficheiro:** `email-topbar.tsx`

Barra superior com:
- Botao voltar (para `/dashboard/templates-email`)
- Input do nome do template
- Input do assunto do email
- Toggle mode: Edicao / Pre-visualizacao
- Botoes Undo/Redo (desactivados em preview)
- Botao Guardar (com spinner durante save)

### 5.2 EmailToolbox

**Ficheiro:** `email-toolbox.tsx`

Painel esquerdo (w-72) com componentes arrastáveis organizados em 3 categorias:

| Categoria | Componentes |
|-----------|-------------|
| **Conteudo** | Texto, Titulo, Botao, Anexo |
| **Media** | Imagem |
| **Estrutura** | Contentor, Grelha, Divisor, Espacador |

Cada item usa `connectors.create(ref, element)` do Craft.js para permitir drag-and-drop no canvas.
Inclui pesquisa por nome.

### 5.3 EmailSettingsPanel

**Ficheiro:** `email-settings-panel.tsx`

Renderiza dinamicamente o componente `settings` do nodo seleccionado:
```typescript
state.nodes[currentNodeId].related.settings
```
Mostra tambem o botao "Remover componente" se o nodo for deletavel.

### 5.4 EmailLayer

**Ficheiro:** `email-layer.tsx`

Componente de camada customizado para o `<Layers>` do Craft.js. Cada camada mostra:
- Icone de visibilidade (Eye/EyeOff) - toggle `hidden`
- Nome editavel (`EditableLayerName`)
- Chevron de expand/collapse para nodos com filhos
- Indentacao por profundidade (`depth * 16 + 8`)

### 5.5 RenderNode

**Ficheiro:** `email-render-node.tsx`

Overlay que aparece quando um nodo esta hover ou seleccionado. Usa `ReactDOM.createPortal` para renderizar uma toolbar flutuante no `document.body`:
- Nome do componente
- Handle de drag (GripVertical)
- Seleccionar pai (ArrowUp)
- Duplicar (Copy) - tambem via Ctrl+D
- Eliminar (Trash2)

**Funcao `duplicateNode()`:** Clona a arvore inteira do nodo (incluindo filhos), gerando novos IDs unicos, e insere o clone apos o original.

### 5.6 EmailPreviewPanel

**Ficheiro:** `email-preview-panel.tsx`

Painel de pre-visualizacao com:

**Sidebar esquerda (w-80):**
- Selectores de entidades (Imovel, Proprietario, Consultor) via Combobox com pesquisa
- Valores manuais por variavel (override dos valores da entidade)
- Resumo das variaveis usadas no template (ponto verde = resolvida, amarelo = pendente)
- Botao "Actualizar dados"

**Area central:**
- Barra de assunto (com variaveis substituidas)
- Iframe/div com o HTML renderizado (maxWidth 620px)

**Fluxo de dados:**
1. Seleccionar entidade (ex: imovel) -> busca opcoes via API
2. Apos seleccao -> `POST /api/libraries/emails/preview-data` com IDs
3. API resolve variaveis a partir da tabela `tpl_variables` + entidades seleccionadas
4. Merge: variaveis da entidade + overrides manuais
5. `renderEmailToHtml(editorState, mergedVariables)` gera o HTML final

---

## 6. Sistema de Variaveis

### 6.1 Tabela `tpl_variables` (Supabase)

Define as variaveis disponiveis para templates. Cada variavel tem:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | PK |
| key | text | Chave unica (ex: `proprietario_nome`) |
| label | text | Label PT-PT (ex: 'Nome do Proprietario') |
| category | text | Categoria: proprietario, imovel, consultor, processo, sistema |
| source_entity | text | Entidade origem: property, owner, consultant, process, system |
| source_table | text | Tabela Supabase de onde buscar o valor |
| source_column | text | Coluna da tabela |
| format_type | text | Tipo de formato: text, currency, date, concat |
| format_config | jsonb | Configuracao do formato (ex: { currency: 'EUR' }) |
| static_value | text | Valor estatico (para variaveis de sistema) |
| is_system | boolean | Se e variavel de sistema |
| is_active | boolean | Se esta activa |
| order_index | int | Ordem de apresentacao |

### 6.2 Categorias de Variaveis

| Categoria | Entidade | Exemplos |
|-----------|----------|----------|
| proprietario | owner | proprietario_nome, proprietario_email, proprietario_nif |
| imovel | property | imovel_titulo, imovel_ref, imovel_preco, imovel_morada |
| consultor | consultant | consultor_nome, consultor_email, consultor_telefone |
| processo | process | processo_ref, processo_estado |
| sistema | system | data_atual (resolvida no servidor) |

### 6.3 Tipos de Formato

| format_type | Descricao | Exemplo |
|-------------|-----------|---------|
| `text` | Valor directo da coluna | "Joao Silva" |
| `currency` | Formatado como moeda | "250.000 EUR" |
| `date` | Formatado como data PT-PT | "06/03/2026" |
| `concat` | Concatena multiplas colunas | "Rua X, Lisboa" |

### 6.4 Hook `useTemplateVariables`

**Ficheiro:** `hooks/use-template-variables.ts`

- Carrega variaveis de `GET /api/libraries/variables`
- Cache em memoria (partilhada entre instancias)
- Metodos: `refetch()`, `invalidate()`
- Usado nos componentes EmailText e EmailHeading para listar variaveis clicaveis no painel settings

### 6.5 Context `EmailVariablesProvider`

**Ficheiro:** `email-variables-context.tsx`

Context React simples que fornece `variables: Record<string, string>` (chave -> valor resolvido). Usado pelos componentes de texto para mostrar valores reais quando disponíveis.

### 6.6 Highlight de Variaveis no Editor

Nos componentes EmailText e EmailHeading:
- `highlightVariables(html)` - envolve `{{var}}` em `<span class="email-variable" contenteditable="false" style="...">` com fundo muted, borda, monospace
- `cleanVariables(html)` - remove os spans ao guardar, mantendo apenas `{{var}}`
- No painel settings, as variaveis aparecem como botoes clicaveis que inserem na posicao do cursor

---

## 7. Renderizacao para HTML (Email-Safe)

### 7.1 Ficheiro: `lib/email-renderer.ts`

Converte o estado serializado do Craft.js para HTML compativel com clientes de email.

**Principios:**
- Gmail strip `<style>` blocks e ignora flexbox/grid
- Todos os estilos sao **inline**
- Layouts multi-coluna usam `<table>` em vez de flex/grid
- MSO conditional comments para Outlook

### 7.2 Funcoes Publicas

| Funcao | Descricao |
|--------|-----------|
| `renderEmailToHtml(state, variables)` | Renderiza estado Craft.js para HTML body fragment |
| `wrapEmailHtml(body)` | Envolve body em boilerplate HTML completo (DOCTYPE, meta, table wrapper) |
| `extractAttachmentsFromState(state)` | Extrai anexos com URL para array compativel com Resend |
| `extractVariablesFromState(state)` | Extrai todas as chaves de variaveis usadas no template |

### 7.3 Mapeamento de Componentes para HTML

| Componente | HTML Output |
|------------|-------------|
| EmailContainer (column) | `<div style="...">` com margin-bottom para simular gap |
| EmailContainer (row) | `<div><table><tr><td>...</td></tr></table></div>` |
| EmailGrid | `<table>` com `<tr>/<td>` para cada celula |
| EmailText | `<p style="...">` |
| EmailHeading | `<h1-h4 style="...">` |
| EmailImage | `<div style="text-align:..."><img style="..."/></div>` |
| EmailButton | `<div style="text-align:..."><a style="...">texto</a></div>` |
| EmailDivider | `<hr style="..."/>` |
| EmailSpacer | `<div style="height:Npx; font-size:0; line-height:0;">` |
| EmailAttachment | `<table>` card com icone, titulo, badge e link download |

### 7.4 Email Boilerplate (wrapEmailHtml)

```html
<!DOCTYPE html>
<html lang="pt" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--[if mso]>...<![endif]-->
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial,...">
  <table width="100%" style="background:#f4f4f4">
    <tr><td align="center" style="padding:20px 10px">
      <table width="600" style="max-width:600px; width:100%">
        <tr><td>{body}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

## 8. Armazenamento (Base de Dados + R2)

### 8.1 Tabela `tpl_email_library` (Supabase)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | PK |
| name | text | Nome do template (unique) |
| subject | text | Assunto do email |
| description | text | Descricao (opcional) |
| body_html | text | HTML renderizado (pronto para envio) |
| editor_state | jsonb | Estado Craft.js serializado (para recarregar no editor) |
| created_at | timestamptz | Data de criacao |
| updated_at | timestamptz | Data de actualizacao |

**Nota:** Tanto `body_html` como `editor_state` sao guardados. O `body_html` e usado para envio de emails (sem necessidade de re-renderizar). O `editor_state` e usado para recarregar o editor para edicao.

### 8.2 Cloudflare R2 - Storage de Assets

| Path | Uso | Limite |
|------|-----|--------|
| `public/templates/email/{timestamp}-{filename}` | Imagens de templates | 5MB, JPEG/PNG/WebP |
| `public/templates/email/{timestamp}-{filename}` | Anexos de templates | 10MB, PDF/DOC/XLS/JPG/PNG |

### 8.3 Tabela `tpl_variables` (Supabase)

Ver seccao 6.1 acima.

### 8.4 Validacao (Zod)

**Ficheiro:** `lib/validations/email-template.ts`

```typescript
emailTemplateSchema = z.object({
  name: z.string().min(2),
  subject: z.string().min(1),
  description: z.string().optional(),
  body_html: z.string().min(1),
  editor_state: z.any().optional(),
})

emailTemplateUpdateSchema = emailTemplateSchema.partial()
```

---

## 9. APIs

### 9.1 CRUD de Templates

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/libraries/emails` | Listar templates (com search) |
| POST | `/api/libraries/emails` | Criar template |
| GET | `/api/libraries/emails/[id]` | Obter template por ID |
| PUT | `/api/libraries/emails/[id]` | Actualizar template |
| DELETE | `/api/libraries/emails/[id]` | Eliminar template |

### 9.2 Upload de Assets

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/libraries/emails/upload` | Upload imagem (5MB, JPEG/PNG/WebP) -> R2 |
| POST | `/api/libraries/emails/upload-attachment` | Upload anexo (10MB, PDF/DOC/XLS/IMG) -> R2 |

### 9.3 Preview de Dados

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/libraries/emails/preview-data` | Resolve variaveis com base em entidades seleccionadas |

**Body:** `{ property_id?, owner_id?, consultant_id?, process_id? }`

**Fluxo interno:**
1. Carrega definicoes de `tpl_variables` (activas)
2. Agrupa por (source_entity, source_table) para batch queries
3. Executa SELECT de cada tabela com as colunas necessarias
4. Formata cada valor conforme `format_type` (text, currency, date, concat)
5. Retorna `{ variables: Record<string, string> }`

---

## 10. Funcionalidades Especiais

### 10.1 Sanitizacao de Estado (`sanitizeEditorState`)

Corrige IDs duplicados no estado serializado, causados por duplicacoes buggy anteriores. Quando um pai tem o mesmo ID de filho mais de uma vez, clona a sub-arvore inteira com novos IDs.

### 10.2 Atalhos de Teclado

| Atalho | Accao |
|--------|-------|
| `Ctrl+D` / `Cmd+D` | Duplicar nodo seleccionado |
| Undo/Redo | Via botoes na topbar (usa `actions.history.undo/redo()`) |

### 10.3 Duplicacao de Nodos

A funcao `duplicateNode()` em `email-render-node.tsx`:
1. Obtem a arvore do nodo (`query.node(id).toNodeTree()`)
2. Clona com `cloneTreeWithNewIds()` - gera novos IDs para todos os nodos
3. Preserva referencias de tipo (type, rules, related) - so clona dados serializaveis
4. Insere o clone apos o original (`actions.addNodeTree(cloned, parentId, index + 1)`)

### 10.4 Inputs Customizados de Settings

| Componente | Descricao |
|------------|-----------|
| `UnitInput` | Input numerico com selector de unidade (px, %, em, rem), botoes +/- |
| `RadiusInput` | 4 inputs para border-radius com toggle link/unlink (todos iguais vs individuais) |
| `SpacingInput` | 4 inputs para padding/margin (top, right, bottom, left) com toggle link/unlink |
| `ColorPickerField` | Campo completo com area, hue slider, alpha slider, eyedropper, input hex |

### 10.5 Integracao com Processos

O email editor integra-se com o sistema de processos documentais:
- Templates de email sao seleccionados em tarefas do tipo EMAIL nos processos
- A funcao `renderEmailToHtml()` e usada em `task-detail-actions.tsx` e `subtask-email-sheet.tsx` para preencher emails com dados reais do processo/imovel/proprietario
- A funcao `extractAttachmentsFromState()` extrai ficheiros para envio como anexos nativos via Resend

---

## 11. Fluxo Completo de Uso

### Criar um Template

1. Utilizador navega para `/dashboard/templates-email/novo`
2. Pagina carrega `EmailEditorComponent` com `initialData: null`
3. Editor abre com um contentor raiz e texto "Edite o seu template aqui"
4. Utilizador arrasta componentes do toolbox para o canvas
5. Selecciona componentes para editar propriedades no painel direito
6. Insere variaveis como `{{proprietario_nome}}` no texto
7. Alterna para modo "Pre-visualizacao" para ver resultado
8. Selecciona entidades reais para preencher variaveis
9. Clica "Guardar" -> POST para API -> guarda `body_html` + `editor_state`
10. Redireccionado para `/dashboard/templates-email/{id}`

### Editar um Template

1. Utilizador navega para `/dashboard/templates-email/{id}`
2. Pagina carrega dados via API (`GET /api/libraries/emails/{id}`)
3. `editor_state` (jsonb) e passado como `initialData` ao editor
4. Editor reconstroi o canvas a partir do estado serializado
5. Utilizador edita e guarda -> PUT para API

### Usar num Processo

1. Tarefa de processo do tipo EMAIL referencia um `tpl_email_library.id`
2. Sistema carrega `editor_state` do template
3. Resolve variaveis com dados reais do processo (imovel, proprietario, consultor)
4. `renderEmailToHtml(editor_state, variables)` gera o HTML
5. `wrapEmailHtml(body)` envolve em boilerplate
6. `extractAttachmentsFromState(editor_state)` extrai anexos
7. Envia via Resend com HTML + anexos
