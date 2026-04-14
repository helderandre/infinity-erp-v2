# Document Folders Ui


### Requirement: Grelha de pastas partilhada

O sistema SHALL fornecer um componente `<DocumentsGrid>` em `components/documents/` que renderiza pastas agrupadas por categoria (`Collapsible` shadcn) a partir de um array `DocumentFolder[]` passado por props. O componente MUST ser domain-agnostic (sem fetch interno a Supabase/R2) e MUST aceitar `getPublicUrl(file)` como prop.

#### Scenario: Renderizar pastas agrupadas por categoria

- **WHEN** o componente recebe `folders` com tipos de categorias diferentes (ex: Obrigatórios, Vistoria, Outros)
- **THEN** o sistema agrupa automaticamente as pastas sob `Collapsible` por `folder.category`
- **AND** cada secção mostra o label PT-PT da categoria e o total de pastas
- **AND** em desktop (`min-width: 768px`) todas as secções abrem por defeito

#### Scenario: Pasta vazia vs pasta preenchida

- **WHEN** uma `folder.files.length === 0`
- **THEN** o ícone 3D é renderizado no estado `empty` (gradiente mais claro, sem thumbnail)
- **WHEN** `folder.files.length > 0` e o primeiro ficheiro tem `mimeType` começado por `image/`
- **THEN** o ícone 3D mostra miniatura da imagem a "espreitar" da pasta
- **AND** é apresentado um badge com o contador `folder.files.length`

#### Scenario: Empty state global

- **WHEN** o array `folders` está vazio
- **THEN** o sistema apresenta o `emptyState` recebido por prop, ou um fallback PT-PT `"Ainda não existem documentos."` com CTA `"Enviar documento"`

---

### Requirement: Selecção múltipla com rectângulo de arrasto

O sistema SHALL permitir seleccionar múltiplas pastas por click e por arrasto rectangular usando `@viselect/react`. O estado de selecção MUST ser um `Set<string>` de IDs de pasta (`folder.id`). A selecção rectangular MUST estar desactivada em dispositivos touch (`pointer: coarse`).

#### Scenario: Toggle de selecção por click

- **WHEN** o utilizador clica numa pasta não seleccionada
- **THEN** o ID é adicionado ao set e a pasta mostra um indicador visual (check + border `ring`)
- **WHEN** o utilizador volta a clicar numa pasta seleccionada
- **THEN** o ID é removido do set e o indicador desaparece

#### Scenario: Selecção rectangular por arrasto

- **WHEN** o utilizador inicia um arrasto numa zona vazia da grelha em desktop
- **THEN** é desenhado um rectângulo com classe `.selection-area-rect`
- **AND** todas as pastas que intersectem o rectângulo são adicionadas ao set quando o arrasto termina
- **AND** movimentos menores que 5px são interpretados como click simples (não iniciam selecção rectangular)

#### Scenario: Desactivar drag em touch

- **WHEN** o utilizador acede numa tablet ou telemóvel (`pointer: coarse`)
- **THEN** a selecção rectangular está desactivada
- **AND** a selecção é feita apenas por tap nas pastas ou pelo menu de contexto `⋮`

---

### Requirement: Menu de contexto e double-click

O sistema SHALL apresentar um menu de contexto (right-click ou long-press) em cada pasta com as acções: **Seleccionar/Desseleccionar**, **Abrir**, **Enviar**, **Descarregar pasta**. O double-click numa pasta MUST abrir o visualizador (se tiver ficheiros) ou o diálogo de upload (se vazia).

#### Scenario: Menu de contexto com acções

- **WHEN** o utilizador faz right-click numa pasta
- **THEN** abre um `ContextMenu` com as 4 acções em PT-PT
- **AND** a opção "Descarregar pasta" fica desactivada se `folder.files.length === 0`

#### Scenario: Double-click abre viewer ou upload

- **WHEN** o utilizador faz double-click numa pasta com ficheiros
- **THEN** abre o `DocumentViewerModal` com o primeiro ficheiro como inicial
- **WHEN** o utilizador faz double-click numa pasta vazia
- **THEN** abre o `DocumentUploadDialog` pré-filtrado pelo `docTypeId` da pasta

---

### Requirement: Barra flutuante de acções em lote

O sistema SHALL apresentar uma `BatchActionBar` flutuante no rodapé quando `selectedIds.size > 0`. A barra MUST mostrar o contador, botões "Descarregar" (habilitado se houver pelo menos 1 ficheiro), "Enviar" e "Cancelar". O botão "Enviar" MUST estar habilitado apenas quando: (a) o domínio pai passa um handler `onSend` (o que hoje acontece apenas em `properties` e `processes`); (b) a selecção tem ≥1 ficheiro. Ao clicar, o handler `onSend` MUST ser invocado com a lista completa de pastas seleccionadas. A barra MUST aparecer com animação slide-up e desaparecer com slide-down.

#### Scenario: Mostrar/esconder ao mudar selecção

- **WHEN** `selectedIds.size` passa de `0` para `>0`
- **THEN** a barra aparece com `translate-y-0` e `opacity-100`
- **WHEN** `selectedIds.size` volta a `0`
- **THEN** a barra sai com `translate-y-full` e `opacity-0`

#### Scenario: Cancelar limpa a selecção

- **WHEN** o utilizador clica em "Cancelar" na barra
- **THEN** o set de seleccionados é esvaziado
- **AND** a barra desaparece

#### Scenario: Enviar habilitado apenas com handler e ficheiros

- **WHEN** a barra é renderizada sem prop `onSend` (domínios `leads`, `negocios`, etc.)
- **THEN** o botão "Enviar" não é renderizado ou permanece oculto
- **WHEN** é passada `onSend` mas a selecção tem 0 ficheiros (todas as pastas seleccionadas estão vazias)
- **THEN** o botão "Enviar" é renderizado mas desabilitado com tooltip `"Selecção sem ficheiros"`
- **WHEN** é passada `onSend` e a selecção tem ≥1 ficheiro
- **THEN** o botão "Enviar" está habilitado e ao clicar invoca `onSend(selectedFolders)`

---

### Requirement: Download em lote (ZIP)

O sistema SHALL expor um hook `useBatchDownload()` que aceita `folders`, `selectedIds` e `entityName`. Para 1 ficheiro total usa `saveAs` directo. Para múltiplos ficheiros, constrói um ZIP com `jszip` em que cada ficheiro vai para a pasta `{folder.name}/{file.name}`. O nome do ZIP MUST seguir o padrão `documentos-{entityName}-{YYYYMMDD}.zip`. Erros individuais de fetch MUST ser colocados num `_erros.txt` dentro do ZIP sem interromper os restantes.

#### Scenario: Download de um único ficheiro

- **WHEN** `selectedIds` aponta para pastas com 1 ficheiro total
- **THEN** o sistema chama `fetch(url)` + `saveAs(blob, file.name)` directamente
- **AND** não gera ZIP

#### Scenario: Download de múltiplos ficheiros em ZIP

- **WHEN** `selectedIds` aponta para 2+ pastas com ficheiros
- **THEN** o sistema constrói um ZIP com estrutura `{folder.name}/{file.name}`
- **AND** o ficheiro descarregado chama-se `documentos-{entityName}-{YYYYMMDD}.zip`
- **AND** é mostrado `toast.promise` com mensagens PT-PT `"A preparar ZIP..."` / `"Descarregado"` / `"Erro ao preparar ZIP"`

#### Scenario: Falha parcial não quebra o batch

- **WHEN** um dos `fetch(url)` dentro do batch falha (404 ou 500)
- **THEN** o ZIP é gerado sem esse ficheiro
- **AND** é adicionado um `_erros.txt` listando `{folder.name}/{file.name}: {status}`
- **AND** o toast mostra `"Descarregado com {n} erro(s)"` em vez de falhar tudo

#### Scenario: Limite de tamanho total

- **WHEN** a soma de `file.size` dos seleccionados excede 200 MB
- **THEN** o sistema mostra `toast.warning("Selecção demasiado grande ({x} MB). Divide em lotes menores.")`
- **AND** NÃO inicia o download

---

### Requirement: Visualizador modal

O sistema SHALL fornecer um `<DocumentViewerModal>` que recebe `files: DocumentFile[]` e `initialIndex`. Renderização por tipo: PDF em `<iframe>` com toolbar, `image/*` em `<img>` com `object-contain`, `.docx` em iframe do Office Online Viewer, outros tipos em placeholder com CTA "Descarregar". MUST suportar navegação por teclado (Esc fecha, ←/→ troca).

#### Scenario: Preview de PDF

- **WHEN** o ficheiro activo tem `mimeType === 'application/pdf'`
- **THEN** renderiza `<iframe src="{url}#toolbar=1&navpanes=0" />` ocupando a área principal

#### Scenario: Preview de imagem

- **WHEN** `mimeType` começa por `image/`
- **THEN** renderiza `<img>` com `object-contain` e fundo `bg-muted`

#### Scenario: Preview de DOCX via Office Online

- **WHEN** `mimeType` é `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **AND** `R2_PUBLIC_DOMAIN` está definido em env
- **THEN** renderiza `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src={encodeURIComponent(url)}" />`

#### Scenario: Fallback para tipos não suportados

- **WHEN** o tipo não é PDF, imagem nem DOCX
- **THEN** renderiza placeholder com ícone, nome do ficheiro e botão "Descarregar"

#### Scenario: Navegação entre ficheiros

- **WHEN** há mais que um ficheiro no array
- **THEN** aparece contador `"N / M"` no topo + setas esquerda/direita
- **AND** teclas `ArrowLeft`/`ArrowRight` navegam também
- **AND** tecla `Escape` fecha o modal

#### Scenario: Sidebar com acções por ficheiro

- **WHEN** o modal está aberto
- **THEN** a sidebar direita lista os ficheiros com ícone por tipo (PDF vermelho, imagem azul)
- **AND** em hover mostra botões "Descarregar", "Substituir", "Eliminar" (se permissão)
- **AND** "Eliminar" pede confirmação via `AlertDialog` PT-PT

---

### Requirement: Diálogo de upload

O sistema SHALL fornecer um `<DocumentUploadDialog>` com drag-and-drop (`react-dropzone`), múltiplos ficheiros, validação de extensão via `docType.allowedExtensions`, limite 50MB por ficheiro, campo opcional de etiqueta por ficheiro, campo de data de validade (só se `docType.has_expiry`) e textarea de notas. O submit MUST fazer upload sequencial e mostrar `toast.promise`.

#### Scenario: Drag-and-drop de múltiplos ficheiros

- **WHEN** o utilizador arrasta 3 ficheiros para a dropzone
- **THEN** os 3 aparecem como cards com nome, tamanho e X para remover
- **AND** ficheiros com extensão não permitida são rejeitados com `toast.error("{nome}: extensão não permitida")`

#### Scenario: Validação de tamanho

- **WHEN** qualquer ficheiro excede 50 MB
- **THEN** é rejeitado com `toast.error("{nome}: excede o limite de 50 MB")`

#### Scenario: Data de validade condicional

- **WHEN** o `docType.has_expiry === true`
- **THEN** o campo "Data de validade" é visível e obrigatório se `docType.expiry_required`
- **WHEN** `has_expiry === false`
- **THEN** o campo não aparece

#### Scenario: Submit com progresso

- **WHEN** o utilizador clica "Enviar"
- **THEN** cada ficheiro é enviado via POST à API do domínio com `FormData`
- **AND** é mostrado `toast.loading` com progresso `"{n}/{total} ficheiros"`
- **AND** no fim `toast.success("Documentos enviados com sucesso")` e o `onSuccess()` é chamado

---

### Requirement: Diálogo de tipo customizado

O sistema SHALL fornecer um `<CustomDocTypeDialog>` que permite criar um `doc_type` ad-hoc para a categoria "Outros" do domínio actual. Campos: nome (required), toggle "Tem validade?", aplicação a `applies_to` (inferido do domínio). Após criar, MUST abrir automaticamente o diálogo de upload com esse tipo.

#### Scenario: Criar tipo customizado

- **WHEN** o utilizador submete nome `"Certificado de parque"` e activa "Tem validade?"
- **THEN** é criado um registo em `doc_types` com `category = 'outros'`, `has_expiry = true`, `expiry_required = false`, `alert_days = [30, 15, 7]`, slug gerado a partir do nome
- **AND** `applies_to` inclui o domínio actual (ex: `['properties']`)
- **AND** o diálogo de upload abre automaticamente com esse tipo pré-seleccionado

---

### Requirement: Estilo de selecção e ícones partilhados

O sistema SHALL adicionar em `app/globals.css` (layer `components`) a regra `.selection-area-rect` usando variáveis de tema shadcn para respeitar dark mode. O `FolderIcon` existente em `components/icons/folder-icon.tsx` MUST ser estendido com props opcionais `thumbnailUrl`, `badgeCount` e `state: 'empty' | 'filled' | 'selected'`. O `DocIcon` existente em `components/icons/doc-icon.tsx` MUST ser reutilizado em todos os pontos onde é renderizado um ficheiro individual (sidebar do viewer, previews do upload dialog, listas) — **não usar ícones Lucide genéricos** para representar ficheiros.

#### Scenario: Dark mode respeitado

- **WHEN** o tema está em dark mode
- **THEN** o rectângulo de selecção usa `hsl(var(--primary) / 0.08)` automaticamente com border mais visível

#### Scenario: Thumbnail no folder icon

- **WHEN** a pasta tem pelo menos um ficheiro `image/*`
- **THEN** o `FolderIcon` recebe `thumbnailUrl` e mostra a imagem a espreitar
- **WHEN** a pasta está vazia
- **THEN** o `FolderIcon` é renderizado com `state="empty"` (gradiente mais claro)
- **WHEN** a pasta está seleccionada
- **THEN** `state="selected"` aplica `ring-2 ring-primary`

#### Scenario: DocIcon em listas de ficheiros

- **WHEN** o `DocumentViewerModal` renderiza a sidebar ou o `DocumentUploadDialog` renderiza previews
- **THEN** cada item usa `<DocIcon extension={ext} />` com a extensão derivada de `mimeType` ou `fileName`
- **AND** o badge do `DocIcon` reflecte a cor correcta (PDF vermelho, DOCX azul, JPG roxo, ZIP cinza, etc.)
- **AND** extensões não mapeadas caem no fallback com label `"doc"` e cor `hsl(var(--primary))`
