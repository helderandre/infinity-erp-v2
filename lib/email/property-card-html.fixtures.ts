/**
 * Manual-QA fixtures for `renderPropertyGrid`.
 *
 * The project has no test runner configured (no jest/vitest in package.json),
 * so these fixtures are provided for ad-hoc verification. Run:
 *
 *   npx tsx lib/email/property-card-html.fixtures.ts > /tmp/grid.html
 *   open /tmp/grid.html
 *
 * and visually check the three scenarios documented in
 * `openspec/changes/send-negocio-properties/specs/email-property-grid/spec.md`.
 *
 * A proper snapshot test suite is tracked as a follow-up.
 */

import {
  renderPropertyGrid,
  type PropertyCardInput,
} from './property-card-html'

const mk = (i: number, withImage = true): PropertyCardInput => ({
  title: `Apartamento T${i} em Demo`,
  priceLabel: '750\u202F000\u00A0€',
  location: 'Lisboa · Parque das Nações',
  specs: `${i} quartos · ${80 + i * 10} m²`,
  imageUrl: withImage
    ? 'https://picsum.photos/seed/infinity/400/300'
    : null,
  href: `https://infinitygroup.pt/property/demo-t${i}`,
  reference: `DEMO-00${i}`,
})

export const fixtures = {
  one: renderPropertyGrid([mk(2)]),
  three: renderPropertyGrid([mk(1), mk(2), mk(3)]),
  five: renderPropertyGrid([mk(1), mk(2), mk(3), mk(4), mk(5)]),
  noImage: renderPropertyGrid([mk(1, false), mk(2, false)]),
}

if (typeof require !== 'undefined' && require.main === module) {
  for (const [name, html] of Object.entries(fixtures)) {
    // eslint-disable-next-line no-console
    console.log(`\n<!-- ===== ${name} ===== -->\n${html}\n`)
  }
}
