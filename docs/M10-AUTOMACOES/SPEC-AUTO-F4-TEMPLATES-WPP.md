# SPEC-AUTO-F4-TEMPLATES-WPP — Fase 4: Templates de Mensagens WhatsApp

**Data:** 2026-03-05
**Prioridade:** 🟠 Alta
**Estimativa:** 2 sessões de Claude Code
**Pré-requisitos:** F1 (tabela `auto_wpp_templates`), F2 (tipos + template engine), F3 (instâncias)

---

## 📋 Objectivo

Criar o editor visual de templates de mensagens WhatsApp com preview ao vivo estilo telemóvel, suporte a sequências de mensagens (texto, imagem, vídeo, áudio, documento), drag-and-drop para reordenar, seletor de variáveis com pills, e biblioteca de templates reutilizáveis. Inspirado nas screenshots de referência enviadas (editor com live preview lateral).

---

## 📁 Ficheiros a Criar

| Ficheiro | Responsabilidade |
|----------|-----------------|
| `app/api/automacao/templates-wpp/route.ts` | GET lista, POST criar |
| `app/api/automacao/templates-wpp/[id]/route.ts` | GET, PUT, DELETE template |
| `app/(dashboard)/automacao/templates-wpp/page.tsx` | Biblioteca (listagem) |
| `app/(dashboard)/automacao/templates-wpp/editor/page.tsx` | Editor de template |
| `components/automations/wpp-template-builder.tsx` | Builder principal (container) |
| `components/automations/wpp-message-editor.tsx` | Editor de mensagem individual (Sheet) |
| `components/automations/wpp-message-card.tsx` | Card de mensagem na lista (draggable) |
| `components/automations/wpp-preview.tsx` | Preview estilo telemóvel WhatsApp |
| `components/automations/wpp-template-card.tsx` | Card na listagem da biblioteca |
| `hooks/use-wpp-templates.ts` | Hook CRUD templates |

---

## 🎨 Layout do Editor (Inspirado nas Referências)

O layout segue o padrão split-screen visto nas screenshots: editor à esquerda, preview ao vivo à direita.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Voltar    [Nome do Template]    [Tags: Boas-vindas +]    [Guardar]  │
├───────────────────────────────────┬──────────────────────────────────────┤
│                                   │                                      │
│  EDITOR                           │  PREVIEW AO VIVO                     │
│                                   │                                      │
│  Sequência de Mensagens           │  ┌──────────────────────────┐        │
│                                   │  │ 📱 WhatsApp              │        │
│  ┌─────────────────────────────┐  │  │ ┌────────────────────┐   │        │
│  │ ≡ 1. 💬 Texto              │  │  │ │ Olá João Silva!    │   │        │
│  │   "Olá [Lead > Nome]!..."  │  │  │ │ Bem-vindo à...     │   │        │
│  │   ⏱️ 2s delay    [✎] [✕]  │  │  │ └────────────────────┘   │        │
│  └─────────────────────────────┘  │  │                          │        │
│                                   │  │ ┌────────────────────┐   │        │
│  ┌─────────────────────────────┐  │  │ │ 🖼️ [imagem]        │   │        │
│  │ ≡ 2. 🖼️ Imagem             │  │  │ │ A sua nova casa... │   │        │
│  │   boas-vindas.jpg          │  │  │ └────────────────────┘   │        │
│  │   ⏱️ 3s delay    [✎] [✕]  │  │  │                          │        │
│  └─────────────────────────────┘  │  │ ┌────────────────────┐   │        │
│                                   │  │ │ 📄 Brochura.pdf    │   │        │
│  ┌─────────────────────────────┐  │  │ └────────────────────┘   │        │
│  │ ≡ 3. 📄 Documento          │  │  │                          │        │
│  │   Brochura_Infinity.pdf    │  │  │ ✓✓ 14:32              │        │
│  │   ⏱️ 1s delay    [✎] [✕]  │  │  └──────────────────────────┘        │
│  └─────────────────────────────┘  │                                      │
│                                   │  Pré-visualizar com:                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │  [João Silva (Lead) ▼]             │
│  │   + Adicionar Mensagem      │  │                                      │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │                                      │
│                                   │                                      │
├───────────────────────────────────┴──────────────────────────────────────┤
│  Descrição: [Template de boas-vindas para novos leads]                   │
│  Categoria: [Boas-vindas ▼]                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 Preview WhatsApp: `wpp-preview.tsx`

Preview estilo telemóvel com:
- Frame de smartphone com header WhatsApp (foto perfil, nome, status online)
- Bolhas de mensagem verdes (enviadas) com timestamp e double-check azul
- Tipos visuais: texto renderizado, thumbnail de imagem, ícone de vídeo com play, waveform de áudio, ícone de documento com nome
- Variáveis resolvidas com dados reais do lead/proprietário seleccionado
- Scroll automático para a última mensagem

```typescript
interface WppPreviewProps {
  messages: WhatsAppMessage[]
  variables: Record<string, string>  // Variáveis resolvidas para preview
  contactName?: string               // Nome no header
  contactPhoto?: string              // Foto no header
}
```

### Renderização por tipo de mensagem

| Tipo | Visual na bolha |
|------|----------------|
| `text` | Texto renderizado com formatação WhatsApp (*bold*, _italic_) |
| `image` | Thumbnail da imagem + legenda por baixo |
| `video` | Thumbnail com ícone ▶️ + legenda |
| `audio` | Barra de waveform com duração (estilo WhatsApp) |
| `ptt` | Igual a áudio mas com ícone de microfone |
| `document` | Ícone 📄 + nome do ficheiro + tamanho |

---

## ✏️ Editor de Mensagem Individual: `wpp-message-editor.tsx`

Abre numa **Sheet lateral** (como os nodes do LeveMãe). Contém:

### Secção 1: Tipo de Mensagem

Cards clicáveis como nas screenshots de referência:

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  💬      │  │  🖼️      │  │  🎬      │  │  🎵      │  │  📄      │
│  Texto   │  │  Imagem  │  │  Vídeo   │  │  Áudio   │  │ Documento│
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### Secção 2: Conteúdo (dinâmico conforme tipo)

**Para Texto:**
```
┌─────────────────────────────────────────┐
│ Mensagem                    [{ } Inserir variável]
│ ┌─────────────────────────────────────┐ │
│ │ Olá [Lead > Nome]!                  │ │  ← pills coloridas
│ │ Bem-vindo à Infinity Group.         │ │
│ │                                     │ │
│ │ O consultor [Consultor > Nome] vai  │ │
│ │ acompanhá-lo no seu projecto.       │ │
│ └─────────────────────────────────────┘ │
│ Formatação: *negrito*  _itálico_  ~riscado~ │
│ 📏 0 / 4096 caracteres                 │
└─────────────────────────────────────────┘
```

**Para Imagem/Vídeo:**
```
┌─────────────────────────────────────────┐
│ Ficheiro                                │
│ ┌─────────────────────────────────────┐ │
│ │  📁 Arrastar ficheiro ou clicar     │ │
│ │     para fazer upload               │ │
│ └─────────────────────────────────────┘ │
│ Ou URL: [https://...]                   │
│                                         │
│ Legenda (opcional):        [{ } Variável] │
│ ┌─────────────────────────────────────┐ │
│ │ A sua nova casa espera por si!      │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Para Documento:**
```
┌─────────────────────────────────────────┐
│ Ficheiro                                │
│ [📁 Upload ou URL]                      │
│                                         │
│ Nome do ficheiro:                       │
│ [Brochura_Infinity_Group.pdf]           │
│                                         │
│ Legenda (opcional): [{ } Variável]      │
│ [Segue o documento solicitado]          │
└─────────────────────────────────────────┘
```

**Para Áudio:**
```
┌─────────────────────────────────────────┐
│ Ficheiro de Áudio                       │
│ [📁 Upload (MP3, OGG)]                 │
│ Ou URL: [https://...]                   │
│                                         │
│ Tipo: ( ) Áudio normal  (•) Mensagem voz│
└─────────────────────────────────────────┘
```

### Secção 3: Configuração de Envio

```
┌─────────────────────────────────────────┐
│ Atraso antes de enviar                  │
│ [2] segundos                            │
│ ℹ️ Mostra "digitando..." antes de enviar │
└─────────────────────────────────────────┘
```

---

## 📚 Biblioteca: `app/(dashboard)/automacao/templates-wpp/page.tsx`

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Templates WhatsApp                        [+ Novo]      │
│  [🔍 Pesquisar...]  [Categoria ▼]  [Ordenar ▼]          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────────────────┐  ┌───────────────────┐            │
│  │ 💬 Boas-vindas    │  │ 💬 Follow-up 3d   │            │
│  │ Lead              │  │                    │            │
│  │ 3 mensagens       │  │ 2 mensagens        │            │
│  │ 📝 🖼️ 📄          │  │ 📝 📝              │            │
│  │                    │  │                    │            │
│  │ Criado há 3 dias  │  │ Criado há 1 semana │            │
│  │ [Editar] [···]    │  │ [Editar] [···]     │            │
│  └───────────────────┘  └───────────────────┘            │
│                                                          │
│  ┌───────────────────┐  ┌───────────────────┐            │
│  │ 💬 Proposta       │  │ 💬 Contrato       │            │
│  │ Enviada           │  │ Assinado           │            │
│  │ 2 mensagens       │  │ 1 mensagem         │            │
│  │ 📝 📄             │  │ 📝                 │            │
│  └───────────────────┘  └───────────────────┘            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Card do template (`wpp-template-card.tsx`)

- Nome + categoria (badge)
- Contagem de mensagens
- Ícones dos tipos de mensagem usados (📝 🖼️ 🎬 🎵 📄)
- Data de criação/última edição
- Menu: Editar, Duplicar, Desactivar, Eliminar

---

## 🔌 API Routes

### `GET /api/automacao/templates-wpp`

```typescript
// Query params: ?search=texto&category=boas-vindas&active=true
// Response: { templates: AutoWppTemplate[] }
```

### `POST /api/automacao/templates-wpp`

```typescript
// Body: { name, description?, messages: [], category?, tags? }
// Response: { template: AutoWppTemplate }
```

### `GET /api/automacao/templates-wpp/[id]`

```typescript
// Response: { template: AutoWppTemplate }
```

### `PUT /api/automacao/templates-wpp/[id]`

```typescript
// Body: { name?, description?, messages?, category?, tags?, is_active? }
// Response: { template: AutoWppTemplate }
```

### `DELETE /api/automacao/templates-wpp/[id]`

```typescript
// Soft delete: UPDATE is_active = false
// Response: { ok: true }
```

---

## 🔄 Drag & Drop para Reordenar Mensagens

Usar `@dnd-kit/core` + `@dnd-kit/sortable` (já instalados no projecto):

| Acção | Comportamento |
|-------|--------------|
| Arrastar card de mensagem | Reordena na lista (índice muda) |
| Grip handle (≡) à esquerda | Zona de arrasto |
| Soltar | Array `messages` reordena e preview actualiza |

### Padrão a seguir

O WhatsApp Node do LeveMãe (`whatsapp-node.tsx`) já tem drag-and-drop implementado com `onDragStart`, `onDragEnd`, `onDragOver`, `onDrop` nativos do HTML5. Reutilizar o mesmo padrão ou migrar para `@dnd-kit` para consistência.

---

## 📦 Upload de Média

### Destino: Supabase Storage

```
Bucket: auto-media
Paths:
  wpp-templates/{templateId}/imagem.jpg
  wpp-templates/{templateId}/brochura.pdf
  wpp-templates/{templateId}/audio.mp3
```

### Validações

| Tipo | Extensões | Tamanho máx |
|------|-----------|-------------|
| image | jpg, jpeg, png, webp | 5 MB |
| video | mp4 | 16 MB |
| audio | mp3, ogg | 5 MB |
| document | pdf, docx, xlsx, pptx | 10 MB |

### Fluxo de upload

1. Utilizador seleciona ficheiro ou arrasta para a zona de drop
2. Validação client-side (tipo + tamanho)
3. Upload para Supabase Storage via `supabase.storage.from("auto-media").upload(...)`
4. Obter URL pública: `supabase.storage.from("auto-media").getPublicUrl(...)`
5. Guardar URL em `messages[i].mediaUrl`

---

## 🏷️ Integração com Variable Picker

O campo de texto das mensagens integra o `variable-picker.tsx` da F2:

1. Utilizador clica no botão `{ }` "Inserir variável"
2. Popover com seletor de variáveis (Lead, Imóvel, Consultor, etc.)
3. Ao selecionar, insere pill no campo de texto
4. Internamente: `"Olá {{lead_nome}}"` — mas o utilizador vê: `"Olá [Lead > Nome]"`

### Para o preview

O preview resolve as variáveis usando `renderTemplate()` da F2 com dados reais. O dropdown "Pré-visualizar com" permite selecionar um lead/proprietário da base de dados como dados de amostra.

```typescript
// Buscar dados de amostra para preview
const { data: lead } = await supabase
  .from("leads")
  .select("nome, email, telefone, telemovel, origem, estado, temperatura")
  .eq("id", selectedLeadId)
  .single()

// Resolver variáveis
const variables = { lead_nome: lead.nome, lead_email: lead.email, ... }
const resolvedContent = renderTemplate(message.content, variables)
```

---

## ✅ Critérios de Aceitação

- [ ] Criar template com 3+ mensagens de tipos diferentes
- [ ] Reordenar mensagens via drag-and-drop e preview actualiza
- [ ] Upload de imagem/documento para Supabase Storage funciona
- [ ] Inserir variável como pill no texto da mensagem
- [ ] Preview ao vivo mostra mensagens estilo WhatsApp com variáveis resolvidas
- [ ] Mudar lead no dropdown do preview actualiza os valores
- [ ] Guardar template persiste `messages` JSON correctamente
- [ ] Editar template existente carrega mensagens e permite modificar
- [ ] Biblioteca lista templates com filtro por categoria e pesquisa
- [ ] Duplicar template cria cópia com nome "Cópia de [nome]"
- [ ] Eliminar template faz soft delete (is_active = false)

## 📝 Notas para o Claude Code

1. **Criar bucket** `auto-media` no Supabase Storage se não existir
2. **Reutilizar** o padrão do `whatsapp-message-editor.tsx` do LeveMãe para o editor de mensagem individual
3. **O preview é o componente mais importante** para o utilizador leigo — investir tempo na fidelidade visual
4. **Tags** usam o componente Input com badges (similar ao header das screenshots de referência)
5. **O editor e a biblioteca são páginas separadas** — a biblioteca lista, o editor edita um template específico
6. **Query param:** `?id=uuid` no editor para editar existente, sem param para criar novo
