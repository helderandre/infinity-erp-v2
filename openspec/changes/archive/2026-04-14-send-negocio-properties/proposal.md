## Why

Os consultores precisam de partilhar rapidamente, a partir do dossier do negócio, um conjunto curado de imóveis (adicionados ao dossier ou sugeridos pelo matching) com o lead — hoje têm de sair da página, copiar links/imagens e enviar manualmente por email ou WhatsApp. Isto duplica trabalho, leva a erros de formatação e não reaproveita a conta SMTP nem a instância de WhatsApp já configuradas por consultor.

## What Changes

- Adicionar, nas tabs **Imóveis** e **Matching** em `app/dashboard/leads/[id]/negocios/[negocioId]/page.tsx`, selecção múltipla (checkbox por card + "Seleccionar todos") e um botão **Enviar selecionados** que abre um diálogo análogo ao de `SendDocumentsDialog`.
- Novo diálogo `SendPropertiesDialog` com dois canais independentes (Email / WhatsApp), cada um com toggle, seleção de conta/instância, preenchimento de destinatários ad-hoc e pré-visualização; destinatários pré-preenchidos a partir do lead (`email`, `telemovel_primario`, `telemovel_secundario`).
- Novo builder de **card de imóvel para email**: componente renderizável em HTML tabular (compatível Outlook/Gmail) que recebe uma lista de propriedades e produz uma grelha responsiva — 3 colunas no desktop, 2 em tablet, 1 no mobile — com imagem de capa (ou placeholder), título, referência, localização, tipologia/área, preço e CTA "Ver imóvel". Disponível como bloco reutilizável no editor Craft.js (`EmailPropertyGrid`) e como helper standalone invocável pelo endpoint de envio.
- Endpoint `POST /api/negocios/[id]/properties/send` que, dado um conjunto de `negocio_property_id` + canais + mensagens, resolve cada item (system vs. external_url), monta o HTML/texto e despacha via SMTP (`consultant_email_accounts`) e/ou UAZ WhatsApp, reutilizando `resolveEmailAccount`, `pLimit` e a edge function `whatsapp-messaging` já usados pelo fluxo de documentos.
- Resolução de link por item: se `property_id` estiver definido, usar `https://infinitygroup.pt/property/{slug}`; caso contrário usar `external_url`. Imagem de capa: `dev_property_media.is_cover = true` com fallback para o primeiro por `order_index`; para items externos sem imagem, omitir imagem e mostrar placeholder.
- Formato da mensagem WhatsApp: texto com lista enumerada (título · preço · link) — um envio por destinatário, sem anexos binários (mantém o padrão atual de mensagem de texto + link público, já indexável pelo WhatsApp).
- Registo do envio em `negocio_properties.sent_at` (timestamp do último envio bem-sucedido por canal) e log em `log_audit` com `entity_type='negocio_properties_send'`.

## Capabilities

### New Capabilities
- `negocio-properties-send`: Selecção múltipla de imóveis do dossier/matching e envio coordenado por Email (com card grid renderizado) e WhatsApp (lista de links), via SMTP do consultor e instância WhatsApp UAZ.
- `email-property-grid`: Bloco de email reutilizável que renderiza uma lista de imóveis como grelha responsiva de cards em HTML tabular, usável no editor Craft.js e em envios programáticos.

### Modified Capabilities
<!-- Nenhum: o fluxo de `document-send` permanece intacto; este change reusa helpers (`resolveEmailAccount`, `pLimit`, `callWhatsappEdge`) mas não altera os seus requisitos. -->

## Impact

- **UI**: `app/dashboard/leads/[id]/negocios/[negocioId]/page.tsx`, `components/negocios/negocio-matches.tsx`, e (a criar) `components/negocios/negocio-properties-list.tsx` — adicionar selecção, barra de acção flutuante e abertura do diálogo.
- **Novos componentes**: `components/negocios/send-properties-dialog.tsx`, `components/email-editor/components/email-property-grid.tsx`, `lib/email/property-card-html.ts`.
- **Novo endpoint**: `app/api/negocios/[id]/properties/send/route.ts`. Potencialmente `app/api/negocios/[id]/properties/send/recipients/route.ts` (para carregar email/telefone do lead + consultor atribuído).
- **DB**: sem migrações obrigatórias — `negocio_properties.sent_at` já existe; adicionar apenas índice em `(negocio_id, id)` se necessário para o lookup do envio.
- **Reuso**: `lib/email/resolve-account.ts`, `lib/documents/email-validate.ts`, `lib/documents/phone.ts`, `lib/concurrency.ts`, `app/api/whatsapp/instances/route.ts`, edge function `whatsapp-messaging`.
- **Dependências**: nenhuma nova — o editor Craft.js e `lib/email-renderer.ts` já suportam tabelas e estilos inline; o novo bloco reutiliza a mesma convenção.
- **Auditoria**: registar por destinatário/canal em `log_audit` (mesmo padrão do `document-send`).
