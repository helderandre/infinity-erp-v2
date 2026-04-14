## MODIFIED Requirements

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
