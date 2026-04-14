## Context

A página de detalhe do negócio (`app/dashboard/leads/[id]/negocios/[negocioId]/page.tsx`) mostra duas tabs relevantes para partilha com o lead: **Imóveis** (dossier curado em `negocio_properties`) e **Matching** (sugestões do algoritmo em `/api/negocios/[id]/matches`). Ambas expõem a mesma forma de objecto com `slug`, `title`, `listing_price`, `city`, `zone`, specs (`typology`, `bedrooms`, `area_util`) e cover image (`dev_property_media.is_cover=true`).

`negocio_properties` admite **dois tipos de item**:
- **System** (`property_id != null`): liga a `dev_properties`, usa `slug` para link público.
- **External** (`external_url != null`): adicionado via "Adicionar Link", sem cover image, com `external_title` / `external_price` fornecidos pelo utilizador.

O fluxo de envio de documentos (`SendDocumentsDialog` + `POST /api/documents/send`) já resolve o problema análogo para ficheiros: separa canais Email/WhatsApp com toggles independentes, carrega `consultant_email_accounts` e `auto_wpp_instances` via `/api/email/account` e `/api/whatsapp/instances`, paraleliza envios com `pLimit` (3 para email, 2 para WhatsApp), reporta progresso por linha em `SendProgressList` e credita auditoria em `log_audit`. SMTP corre via `/api/email/send` (nodemailer) após `resolveEmailAccount` decifrar credenciais; WhatsApp via edge function `whatsapp-messaging` (provider UAZ).

O editor de email em `components/email-editor/` é baseado em Craft.js com blocos custom que serializam para HTML tabular via `lib/email-renderer.ts`. Não existe hoje nenhum bloco que receba uma lista dinâmica de imóveis e a renderize como grelha.

## Goals / Non-Goals

**Goals:**
- Permitir, a partir das tabs Imóveis e Matching, seleccionar ≥1 imóvel e enviar uma mensagem única por destinatário com os cards renderizados (email) ou uma lista de links (WhatsApp).
- Reutilizar o padrão UX do `SendDocumentsDialog` de forma que um consultor já familiarizado o reconheça imediatamente.
- Reutilizar `consultant_email_accounts` / `auto_wpp_instances` / `resolveEmailAccount` / `pLimit` / edge function WhatsApp existentes — não duplicar infra de envio.
- Entregar um bloco `EmailPropertyGrid` utilizável tanto pelo endpoint de envio programático como manualmente no editor de email (para templates reutilizáveis).
- Garantir que cards renderizam com acuidade em Gmail, Outlook (Web + Desktop 2019+) e cliente mobile, em light mode.

**Non-Goals:**
- Criação/edição de `negocio_properties` (já existe). Este change é puramente de envio.
- Envio em massa cross-negócio ou broadcasts de marketing (continua reservado a um futuro módulo Marketing).
- Tracking de abertura / cliques (pixel de tracking, UTMs). Pode ser seguido num change separado.
- Permitir upload de imagens diferentes da capa na altura do envio — usa sempre a capa atual.
- Suporte a dark mode no HTML do email (Outlook e muitos clientes não suportam `prefers-color-scheme` de forma fiável; assumir light background).
- Fallback WhatsApp com imagens como anexo binário — provider suporta, mas dificulta rate-limit e UX; enviamos texto + link e deixamos o WhatsApp gerar o preview do link via OpenGraph do `infinitygroup.pt`.

## Decisions

### 1. Reusar `SendDocumentsDialog` via extração vs. criar `SendPropertiesDialog` dedicado
**Escolha:** criar `SendPropertiesDialog` novo, partilhando sub-componentes granulares (`ChannelToggle`, `RecipientsList`, `SendProgressList`) extraídos de `components/documents/`.

**Porquê:** o payload (properties) e os defaults de corpo (HTML com grid + lista WhatsApp) divergem o suficiente para que um diálogo genérico se torne um mar de `if (kind === 'documents') ...`. A extração dos sub-componentes de `send-documents-dialog.tsx` para `components/shared/send/` mantém DRY sem impor acoplamento semântico. Rejeitado alternativas: (a) parametrizar o dialog existente — vira switch hell; (b) copy-paste total — viola Regra de Desenvolvimento do CLAUDE.md.

### 2. Renderização do HTML do email
**Escolha:** módulo puro `lib/email/property-card-html.ts` exportando `renderPropertyGrid(properties, options): string`, usado tanto pelo endpoint (`/api/negocios/[id]/properties/send`) como pelo bloco Craft.js `EmailPropertyGrid` (o bloco chama a mesma função no seu serializer).

**Porquê:** garante paridade entre o card no editor e o card enviado programaticamente; evita dois geradores que drift'am. A função recebe `PropertyCardInput` (shape mínimo: `title`, `priceLabel`, `location`, `specs`, `imageUrl?`, `href`) — desacoplado de `dev_properties`/`negocio_properties`. Conversão ocorre no endpoint.

### 3. Responsividade do grid em HTML de email
**Escolha:** `<table>` com `width="100%"`, células com `max-width: 280px` e `width: 33.33%` (desktop). Para mobile, media query `@media (max-width: 480px) { td.property-card-cell { display: block !important; width: 100% !important; } }` inline via `<style>` no `<head>`. Gmail strips `<style>` em algumas condições → aceitar degradação para 1 coluna, que ainda é legível.

**Porquê:** soluções com CSS grid/flex não funcionam em Outlook Desktop. O padrão `table + inline styles + media query` é o que `lib/email-renderer.ts` já usa. Rejeitado: MJML (nova dependência + build step); hybrid (ghost tables) — over-engineering para 3 cols.

### 4. Link de CTA
**Escolha:** `href = property_id ? \`https://infinitygroup.pt/property/\${slug}\` : external_url`. Base URL em `lib/constants.ts` como `PUBLIC_WEBSITE_URL` (default `https://infinitygroup.pt`).

**Porquê:** o utilizador pediu explicitamente este formato. Constante permite override por env var se preciso.

### 5. Mensagem WhatsApp
**Escolha:** texto único por destinatário com template:
```
Olá {lead.name}, partilho os imóveis:

1. {title} — {priceLabel}
   {href}

2. ...
```
Um `callWhatsappEdge` por destinatário com `action=send_text` (sem anexos).

**Porquê:** WhatsApp gera preview OpenGraph automaticamente para `infinitygroup.pt`. Anexos binários multiplicam chamadas à edge function, arriscam rate-limit do UAZ e são desnecessários quando o link já é rico. Para properties externas, se `external_url` não tiver OG tags, o preview falha graciosamente — link continua clicável.

### 6. Persistência do envio
**Escolha:** actualizar `negocio_properties.sent_at = now()` apenas para linhas entregues com sucesso em ≥1 canal. Registar auditoria completa em `log_audit` (action `negocio_properties.send`, new_data = `{channel, recipient, property_ids, status, error?}`).

**Porquê:** `sent_at` já existe e é útil para UI futura ("enviado a X"). Auditoria completa em `log_audit` evita esquema novo. Rejeitado: criar `negocio_property_sends` table — YAGNI até termos requisito de dashboard de envios.

### 7. Selecção e "Seleccionar todos"
**Escolha:** estado local na página do negócio (`Set<string>` de `negocio_property_id`), partilhado entre as tabs Imóveis e Matching via lifted state no `page.tsx`. Matching items ainda não têm entrada em `negocio_properties` → ao seleccionar um match, criar silenciosamente (`POST /api/negocios/[id]/properties` com `property_id`) antes de abrir o diálogo, OU passar o shape "virtual" e resolver no backend.

**Decisão final:** **não** criar silenciosamente. Exigir que items do Matching sejam adicionados explicitamente ao dossier (via botão existente "Adicionar") antes de serem envia­dos. Alternativa: aceitar `{property_id}` directo no payload do endpoint e saltar `negocio_properties` — mas aí não registamos `sent_at` nem histórico. Optamos por consistência: a selecção na tab Matching mostra toast "Adicione primeiro ao dossier" se o match ainda não foi adicionado, OU o botão na tab Matching passa a ser "Adicionar e enviar" (adiciona + abre diálogo pré-seleccionado).

### 8. Concurrency e retry
**Escolha:** `pLimit(3)` para email e `pLimit(2)` para WhatsApp (iguais ao `document-send`). Sem retry automático — falhas reportam erro por linha no `SendProgressList` e o utilizador pode reenviar. Adicionar um "Reenviar falhados" no rodapé do progress, que filtra só as linhas com `status='failed'`.

**Porquê:** alinhamento com o comportamento conhecido do `document-send` evita surpresas. Retry automático mascara problemas de config (SMTP down, instance desconectada).

## Risks / Trade-offs

- **[Renderização inconsistente em Outlook Desktop]** → usar somente tables + inline styles; testar em Litmus ou email-on-acid antes de shipar (pelo menos via screenshot manual em Outlook 2021 + Gmail Web + iOS Mail).
- **[OpenGraph de `external_url` pode estar vazio]** → accept: preview pobre no WhatsApp é melhor do que falhar o envio. Documentar em PT-PT no hint do diálogo ("Links externos podem não mostrar preview").
- **[`sent_at` sobrescrito oculta histórico multi-envio]** → mitigação via `log_audit` (timeline completa). Se aparecer requisito de "quantas vezes foi enviado", criar tabela dedicada depois.
- **[Rate limit do UAZ com muitos destinatários]** → `pLimit(2)` + mensagem clara no progress. Limite operacional por envio: max 20 destinatários × 20 imóveis (defensivo, configurável em `lib/documents/send-defaults.ts`).
- **[Property com cover url expirada do R2]** → R2 é público (`R2_PUBLIC_DOMAIN`), URLs são estáveis; sem expiração. Se um media for eliminado depois do envio ser agendado, o email renderiza com placeholder (`<img>` quebrado), aceitável.
- **[Interacção com selecção na tab Matching sem dossier]** → adoptado "Adicionar e enviar" (decisão 7) para evitar conceito de seleção "volátil" que desaparece ao refrescar.
- **[Custo de testes visuais]** → mitigar com snapshot do HTML gerado por `renderPropertyGrid` (Jest snapshot) + screenshot manual no primeiro merge.

## Migration Plan

1. **Sem migração de dados.** `negocio_properties.sent_at` já existe.
2. **Feature gate:** expor botão "Enviar selecionados" apenas se o consultor autenticado tiver ≥1 conta email activa OU ≥1 instância WhatsApp conectada (reutilizar check do `document-send`). Caso contrário mostrar tooltip "Configure uma conta em Definições → Email/WhatsApp".
3. **Rollback:** remover botão da UI + endpoint — não há schema a reverter. `log_audit` entries ficam como histórico inócuo.

## Open Questions

- A base URL pública (`https://infinitygroup.pt/property/{slug}`) deve ser configurável via env `NEXT_PUBLIC_WEBSITE_URL` ou hardcoded em `lib/constants.ts`? **Sugestão:** env com fallback para a constante.
- Devemos permitir editar o corpo do email (subject + mensagem introdutória acima da grelha) ou fixar um template? **Sugestão:** permitir editar `subject` e `intro` (textarea simples) — grid é anexado automaticamente abaixo da intro.
- Na tab Matching, clicar "Enviar" em items não adicionados: fazemos o "add + send" automaticamente (decisão 7) ou pedimos confirmação? **Sugestão:** add automático + toast "3 imóveis adicionados ao dossier".
