## ADDED Requirements

### Requirement: Pure HTML renderer for a property grid
The module `lib/email/property-card-html.ts` SHALL export `renderPropertyGrid(properties: PropertyCardInput[], options?: { locale?: 'pt' }): string` that produces a self-contained HTML fragment suitable for email clients. The output SHALL use only `<table>` layout with inline styles and a single `<style>` block for a mobile media query. No external CSS, JS, or web fonts SHALL be referenced.

`PropertyCardInput` shape:
```ts
{
  title: string
  priceLabel: string          // e.g. "750 000 €"
  location: string            // e.g. "Alcochete · Praia do Sal"
  specs: string               // e.g. "3 quartos · 106 m²"
  imageUrl?: string | null
  href: string
  reference?: string | null   // e.g. "121491860-156"
}
```

#### Scenario: Three-property grid renders 1 row × 3 cells
- **WHEN** `renderPropertyGrid([p1, p2, p3])` is called
- **THEN** the output contains one `<tr>` with three `<td class="property-card-cell">` children, each containing a nested card table

#### Scenario: Five-property grid wraps into 2 rows
- **WHEN** `renderPropertyGrid([p1..p5])` is called
- **THEN** the output contains two `<tr>` rows: the first with 3 cells, the second with 2 cells followed by 1 empty cell to preserve column widths

#### Scenario: Property without image renders placeholder
- **WHEN** a card input has `imageUrl=null`
- **THEN** its card renders a `<div>` placeholder with neutral background and a house emoji/icon, not a broken `<img>`

#### Scenario: HTML is Outlook-safe
- **WHEN** the output is inspected
- **THEN** it contains no `<div>` for layout spacing (only tables), no flex/grid CSS, no `display: none`, and all critical styles are inline on the elements that need them

### Requirement: Mobile responsiveness via media query
The `<style>` block SHALL include `@media (max-width: 480px) { td.property-card-cell { display: block !important; width: 100% !important; max-width: 100% !important; } }` so that in narrow mobile viewports the grid collapses to 1 column. In clients that strip `<style>` (e.g. some Gmail mobile renderings), cards SHALL remain legible as a 3-column table shrunk to fit.

#### Scenario: Narrow viewport collapses to 1 column
- **WHEN** the rendered HTML is opened in a 375px-wide viewport (iOS Safari emulation)
- **THEN** each card occupies the full width, stacked vertically

### Requirement: Craft.js block wrapping the renderer
The editor component `components/email-editor/components/email-property-grid.tsx` SHALL expose a Craft.js user-component that accepts a `properties` prop (editable via the settings panel as a JSON list or a picker bound to a `negocio_id`) and, on serialisation, calls `renderPropertyGrid` from the shared module so the HTML produced in the editor matches the HTML produced by the send endpoint.

#### Scenario: Editor preview matches sent email
- **WHEN** a consultant drags the `EmailPropertyGrid` block into the email editor, configures 2 properties, and saves the template
- **THEN** the serialised HTML emitted into the final email body is byte-identical to `renderPropertyGrid([p1, p2])` from the shared module

#### Scenario: Block without properties in the editor
- **WHEN** the block is dropped but no properties are configured yet
- **THEN** the editor preview shows a neutral empty-state placeholder ("Adicione imóveis") and the serialiser emits an empty `<table>` with a single cell containing a comment `<!-- no properties -->`

### Requirement: Localised labels
The renderer SHALL use PT-PT labels by default: the CTA button text SHALL be "Ver imóvel", and monetary values SHALL be formatted with a non-breaking space between the amount and the euro sign (e.g., `750 000\u00A0€`). Callers MAY override the CTA label via `options.ctaLabel`.

#### Scenario: Default CTA label
- **WHEN** `renderPropertyGrid([p])` is called without options
- **THEN** the CTA button contains the text "Ver imóvel"

#### Scenario: Custom CTA label
- **WHEN** `renderPropertyGrid([p], { ctaLabel: 'Saber mais' })` is called
- **THEN** the CTA button contains "Saber mais"
