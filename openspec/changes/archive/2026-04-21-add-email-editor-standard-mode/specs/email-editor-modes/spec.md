## ADDED Requirements

### Requirement: Three editor modes

The email template editor SHALL expose three top-level modes via a `ToggleGroup` in the topbar: `standard`, `advanced`, and `preview`. The toggle MUST be visible at all times while editing and MUST accept switching between any two modes without data loss for content that is representable in both target modes.

The modes MUST use these PT-PT labels in the UI:

- `standard` → "Padrão"
- `advanced` → "Avançado"
- `preview` → "Pré-visualizar"

#### Scenario: Default mode on new template

- **WHEN** the user opens `/dashboard/templates-email/novo`
- **THEN** the editor SHALL load in `standard` mode with an empty Tiptap editing area and the fixed envelope (header, signature, footer) rendered around it

#### Scenario: Mode toggle is keyboard-accessible

- **WHEN** the user focuses the mode `ToggleGroup` and presses arrow keys
- **THEN** the selection SHALL move between `standard`, `advanced`, and `preview` and update the active mode on selection

#### Scenario: Undo/Redo disabled in preview only

- **WHEN** the mode is `standard` or `advanced`
- **THEN** the Undo/Redo buttons SHALL be enabled subject to their own history state
- **WHEN** the mode is `preview`
- **THEN** the Undo/Redo buttons SHALL be disabled

### Requirement: Fixed envelope in standard mode

In `standard` mode, the canvas SHALL render a fixed envelope composed of, in order: `EmailHeader`, a Tiptap editing area for free-form content, `EmailSignature`, and `EmailFooter`. The envelope elements MUST NOT be removable, draggable, or re-orderable in standard mode. The envelope MUST render visually identically to the preview output for those same elements, so the user can trust WYSIWYG semantics.

#### Scenario: Envelope cannot be removed in standard

- **WHEN** the user is in `standard` mode
- **THEN** no delete, duplicate, move, or drag handle SHALL be available on the header, signature, or footer

#### Scenario: Signature reacts to signature_mode

- **WHEN** the user toggles `signature_mode` between `process_owner` and `sender` in the topbar while in `standard` mode
- **THEN** the signature block in the canvas SHALL re-render accordingly without resetting the Tiptap content

#### Scenario: Tiptap area is the only editable region

- **WHEN** the user clicks anywhere in the `standard` canvas outside the Tiptap area
- **THEN** no caret SHALL appear and no editing SHALL be possible; the click MAY focus the nearest editable area or do nothing

### Requirement: Standard mode Tiptap capabilities

The Tiptap editor used in `standard` mode SHALL reuse the existing `useEmailTiptap` hook so that variable parsing, mention trigger (`@`), and HTML output are consistent with the `EmailText` node used in advanced mode. It MUST support: paragraphs, headings (H1–H4), bold, italic, underline, text alignment, text color, font family, font size, links, unordered lists, ordered lists, and variable insertion via `@`.

#### Scenario: Variable insertion via @ trigger

- **WHEN** the user types `@` in the Tiptap area and selects `lead_nome` from the suggestion popup
- **THEN** the editor SHALL insert a variable node that serializes to `{{lead_nome}}` in the stored HTML

#### Scenario: Formatting persists across mode toggles

- **WHEN** the user applies bold+italic to a word in `standard` mode and switches to `advanced` mode
- **THEN** the same word SHALL be rendered as bold+italic inside the `EmailText` node in the Craft.js canvas

### Requirement: Unified editor_state persistence

Templates saved from `standard` mode SHALL be persisted using the same storage contract as `advanced` mode: the API body sent to `POST/PUT /api/libraries/emails[/:id]` MUST include `editor_state` (Craft.js JSON), `body_html`, `signature_mode`, `name`, `subject`, and `category`. The `editor_state` produced by `standard` mode MUST be a valid Craft.js tree that, when rendered by `renderEmailToHtml`, produces the same `body_html`.

The canonical `editor_state` shape for standard-mode templates SHALL be:

```
ROOT (EmailContainer, canvas)
  ├── EmailHeader
  ├── EmailContainer (canvas, inner)
  │     └── EmailText { html: <tiptap HTML> }
  ├── EmailSignature { consultantId?, mode: signature_mode }
  └── EmailFooter
```

#### Scenario: Save round-trip preserves content

- **WHEN** the user writes content in `standard` mode and clicks "Guardar"
- **THEN** the saved `editor_state` MUST match the canonical standard shape and `renderEmailToHtml(editor_state, {})` MUST produce `body_html` byte-identical to what the editor previewed

#### Scenario: body_html equivalence across modes

- **WHEN** the same underlying `editor_state` is loaded in `standard` and in `advanced` and re-rendered
- **THEN** `renderEmailToHtml` SHALL produce identical `body_html` in both cases

### Requirement: Mode auto-selection when opening an existing template

When loading an existing template at `/dashboard/templates-email/[id]`, the editor SHALL inspect the persisted `editor_state` and pick an initial mode using the following heuristic:

1. If `editor_state` is `null` and `body_html` is non-empty, open in `standard` and seed the Tiptap editor with `body_html`.
2. If `editor_state` matches the canonical standard shape (see previous requirement), open in `standard`.
3. Otherwise, open in `advanced`.

The user MAY override the auto-selected mode via the topbar toggle at any time.

#### Scenario: Template authored in advanced opens in advanced

- **WHEN** a template whose `editor_state` contains an `EmailImage` inside the inner container is opened
- **THEN** the editor SHALL open in `advanced` mode

#### Scenario: Template authored in standard opens in standard

- **WHEN** a template whose `editor_state` matches the canonical standard shape is opened
- **THEN** the editor SHALL open in `standard` mode and the Tiptap editor SHALL load the `EmailText.html` content

### Requirement: Safe switching between standard and advanced

When the user switches mode while unsaved changes exist, the editor SHALL preserve all representable content and warn about any lossy conversion.

- `standard → advanced`: ALWAYS safe. The current Tiptap HTML MUST be written into the `EmailText` node of the canonical standard shape and handed to the Craft.js editor.
- `advanced → standard`: May be lossy. If the current Craft.js state contains any node other than the canonical standard shape (for example, extra `EmailImage`, `EmailButton`, `EmailGrid`, `EmailPropertyGrid`, or multiple text blocks), the editor SHALL prompt an `AlertDialog` warning: *"Ao voltar ao modo Padrão perderá [N] blocos que só existem no modo Avançado. Continuar?"*. On confirm, the editor SHALL extract the concatenated HTML of all `EmailText` descendants in document order as the new Tiptap content; on cancel, the mode switch SHALL be aborted.

#### Scenario: Lossless standard to advanced

- **WHEN** the user is in `standard` mode with content `"Olá {{lead_nome}}"` and clicks the "Avançado" toggle
- **THEN** the editor SHALL switch to `advanced` mode and the canvas SHALL display the same content inside an `EmailText` node

#### Scenario: Warning before lossy advanced to standard

- **WHEN** the user is in `advanced` mode with an `EmailImage` in the canvas and clicks the "Padrão" toggle
- **THEN** an `AlertDialog` SHALL appear listing the blocks that will be dropped and the mode SHALL only change after explicit confirmation

#### Scenario: Cancel reverts toggle

- **WHEN** the user cancels the lossy-switch `AlertDialog`
- **THEN** the mode SHALL remain `advanced` and the `ToggleGroup` selection SHALL reflect `advanced`

### Requirement: Preview mode reuses existing panel

Entering `preview` mode from either `standard` or `advanced` SHALL serialize the current working state to `editor_state` and pass it to the existing `EmailPreviewPanel`. The preview output SHALL be identical regardless of which editing mode was active.

#### Scenario: Preview from standard

- **WHEN** the user is in `standard` mode and clicks "Pré-visualizar"
- **THEN** the current Tiptap HTML SHALL be serialized into the canonical standard shape and the preview panel SHALL render the same `body_html` it would render if the template had been saved and reopened

### Requirement: Saving rules unchanged

Save validation (non-empty `name`, non-empty `subject`) SHALL apply identically in both `standard` and `advanced`. The `Guardar` button MUST be available in both modes with the same loading, success-toast, and error-toast behavior.

#### Scenario: Save from standard

- **WHEN** the user clicks "Guardar" while in `standard` mode with valid `name` and `subject`
- **THEN** the template SHALL be persisted and the user SHALL receive a `"Template guardado com sucesso"` or `"Template criado com sucesso"` toast identical to the one shown after saving from `advanced`
