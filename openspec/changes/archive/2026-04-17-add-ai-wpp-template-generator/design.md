## Context

O editor de templates WhatsApp usa `WppTemplateBuilder` com mensagens sequenciais do tipo `WhatsAppTemplateMessage[]`. Cada mensagem tem: `id`, `type` (text|image|video|audio|ptt|document), `content` (texto com formatação WhatsApp: *bold*, _italic_, ~strike~), `mediaUrl?`, `docName?`, `delay?` (segundos). O texto suporta variáveis `{{key}}`.

O projecto já tem um padrão de IA para email templates que funciona bem: endpoint streaming + input inline com BorderBeam + sugestões + voz + contexto do consultor. Este design replica esse padrão adaptado ao formato WhatsApp.

## Goals / Non-Goals

**Goals:**
- Input inline IA no builder WhatsApp idêntico ao do email (mesmo UX)
- Geração de sequência de mensagens WhatsApp com texto formatado, variáveis e delays
- Contexto do consultor (1ª pessoa) e categoria (aniversário, Natal, etc.)
- Sugestões rápidas por categoria
- Ditado por voz (Web Speech API)
- Preenchimento automático de nome, descrição e categoria

**Non-Goals:**
- Geração de media (imagens, vídeos, áudios) — v1 gera apenas mensagens de texto
- Edição iterativa conversacional
- Geração de botões ou listas interactivas WhatsApp

## Decisions

### 1. Output da IA: Array de WhatsAppTemplateMessage

**Decisão:** A IA devolve um JSON com metadados + array de mensagens WhatsApp.

**Formato:**
```json
:::WPP_META_START:::
{
  "name": "Feliz Aniversário",
  "description": "Template de aniversário pessoal",
  "category": "aniversario_contacto"
}
:::WPP_META_END:::
:::WPP_MESSAGES_START:::
[
  {
    "type": "text",
    "content": "Olá {{lead_nome}}! 🎂",
    "delay": 0
  },
  {
    "type": "text",
    "content": "Quero desejar-lhe um *Feliz Aniversário*! 🎉\n\nEspero que este dia seja repleto de alegria e boas energias.",
    "delay": 3
  },
  {
    "type": "text",
    "content": "Se precisar de algo, não hesite em contactar-me.\n\nUm abraço,\n{{consultor_nome}}\n📱 {{consultor_telefone}}",
    "delay": 2
  }
]
:::WPP_MESSAGES_END:::
```

**Racional:** O formato é simples (array JSON) vs o Craft.js que precisa de nós com parent/children. Cada mensagem é independente. Delays entre mensagens criam naturalidade (simula "a escrever...").

### 2. Formatação WhatsApp no texto

**Decisão:** A IA usa formatação nativa do WhatsApp no campo `content`:
- `*bold*` para negrito
- `_italic_` para itálico
- `~strikethrough~` para rasurado
- `\n` para quebras de linha
- Emojis nativos (🎂, 🎉, 📱, etc.)

**Racional:** O `WppRichEditor` (TipTap) converte de/para esta sintaxe. O conteúdo gerado pela IA é directamente compatível.

### 3. Múltiplas mensagens com delays

**Decisão:** A IA gera 2-4 mensagens por template, com delays de 2-5 segundos entre elas.

**Racional:** Mensagens múltiplas com delay criam uma experiência mais natural e humana no WhatsApp. Uma mensagem única muito longa parece automatizada.

### 4. Reutilização do componente de input

**Decisão:** Criar um componente genérico `AiGenerateInput` reutilizável ou duplicar o padrão do email com adaptações mínimas.

**Racional:** O input inline (sugestões + textarea + voz + BorderBeam) é idêntico. A diferença está no endpoint chamado e no que se faz com o resultado.

### 5. Integração no WppTemplateBuilder

**Decisão:** Adicionar botão "Gerar com IA" (Sparkles) na topbar do builder. O input inline aparece no fundo da área de mensagens. Ao gerar, substitui a lista de mensagens actual (com confirmação se já tem mensagens).

## Risks / Trade-offs

- **[Só texto na v1]** → A IA não gera media (imagens, vídeos). O utilizador pode adicionar media manualmente após a geração.
- **[Formatação WhatsApp]** → A IA pode gerar formatação incorrecta. Mitigação: system prompt com exemplos claros.
- **[Número de mensagens]** → A IA pode gerar demasiadas mensagens. Mitigação: limitar a 5 mensagens no system prompt.
