# Marketing Catalog — Seed Data

Seed the marketing catalog with the following data. Create a seed script or migration that inserts these records into `marketing_catalog`, `marketing_catalog_addons`, and `marketing_packs` / `marketing_pack_items` tables. All items should be `is_active = true` by default. Prices are final, not placeholders.

---

## Individual Services

### Category: Photography

**FOTO (Câmara + Drone)** — €50
- Full property photo session including interior, exterior, and drone aerial shots. Includes professional editing and delivery of high-res files.
- `requires_scheduling`: true
- `requires_property`: true
- `is_subscription`: false
- Add-ons:
  - Home Staging com AI — +€20
  - Night and Day com AI — +€20
  - Build a House com AI — +€20

---

### Category: Video

**Vídeo Slow** — €180
- Video with simple transitions, drone footage, and color grading. Duration: 35–50 seconds.
- `requires_scheduling`: true
- `requires_property`: true
- `is_subscription`: false
- Add-ons:
  - Consultor fala (com legendas) — +€40
  - Home Staging com AI — +€25
  - Night and Day com AI — +€25
  - Build a House com AI — +€25

**Vídeo Dinâmico** — €270
- Video with dynamic transitions, drone footage, color grading, and consultant speaking with subtitles. Duration: 35–50 seconds.
- `requires_scheduling`: true
- `requires_property`: true
- `is_subscription`: false
- Add-ons:
  - Home Staging com AI — +€40
  - Night and Day com AI — +€40
  - Build a House com AI — +€40

**Vídeo Cinematográfico** — €400
- Cinematic video with visual narrative, detailed shots, lifestyle footage, and drone. Duration: 45–90 seconds.
- `requires_scheduling`: true
- `requires_property`: true
- `is_subscription`: false
- Add-ons:
  - Home Staging com AI — €0 (OFERTA / included)
  - Night and Day com AI — €0 (OFERTA / included)

**Vídeo Documentário** — €500
- Documentary-style film where the consultant presents the property at a calm pace, with professional lighting and a visual narrative showcasing the architecture, details, and atmosphere of the property.
- `requires_scheduling`: true
- `requires_property`: true
- `is_subscription`: false
- Add-ons:
  - Home Staging com AI — €0 (OFERTA / included)
  - Night and Day com AI — €0 (OFERTA / included)

**Vídeo Posicionamento Indoor** — €100
- Indoor video with subtitles and simple transitions. Includes professional lighting, light diffusers, teleprompter, and filters to add dynamic to the backdrop.
- `requires_scheduling`: true
- `requires_property`: false
- `is_subscription`: false
- Add-ons:
  - Pack x8 vídeos (1 manhã de gravações, 4 mudas de roupa, 2 cantos indoor) — +€380 (total becomes €480 for the pack of 8, so the add-on price is €480 - €100 = €380)

**Vídeo Posicionamento Outdoor** — €100
- Outdoor video with subtitles and simple transitions. Great for presenting a city, town, or neighborhood where the consultant specializes.
- `requires_scheduling`: true
- `requires_property`: false
- `is_subscription`: false
- Add-ons: none

**Vídeo FPV** — €350
- Property tour filmed with an FPV drone for an immersive house tour experience.
- `requires_scheduling`: true
- `requires_property`: true
- `is_subscription`: false
- Add-ons:
  - Consultor fala (com legendas) — +€40

---

### Category: Social Media Management (Subscription)

**Gestão de Redes Sociais — Plano Base** — €550/mês
- Monthly content planning, content creation (photos and videos for social media), reel and short video editing, caption writing, content publishing, Instagram/social media profile management, strategy for visibility and attracting new clients, content filming with the consultant. Includes: 6 carousels and 2 positioning reels per month.
- `requires_scheduling`: false (scheduling is handled as part of the ongoing relationship)
- `requires_property`: false
- `is_subscription`: true
- `billing_cycle`: monthly
- Add-ons: none

**Gestão de Redes Sociais — Plano Intermédio** — €700/mês
- Everything in the Base plan. Includes: 8 carousels and 4 positioning reels per month.
- `requires_scheduling`: false
- `requires_property`: false
- `is_subscription`: true
- `billing_cycle`: monthly
- Add-ons: none

**Gestão de Redes Sociais — Plano Premium** — €900/mês
- Everything in the Intermédio plan, plus 1 dynamic real estate reel per month with AI editing included (OFERTA). Includes: 8 carousels, 4 positioning reels, and 1 dynamic reel per month.
- `requires_scheduling`: false
- `requires_property`: false
- `is_subscription`: true
- `billing_cycle`: monthly
- Add-ons: none

---

## Important Implementation Notes for the Seed Script

1. **Add-on prices are per parent service.** The same add-on name (e.g., "Home Staging com AI") has different prices depending on which service it belongs to. Each is a separate record in `marketing_catalog_addons` with its own `parent_service_id` and `price`.

2. **OFERTA add-ons** should be seeded with `price: 0.00`. In the UI, display these as "Incluído" or "OFERTA" instead of "€0".

3. **The x8 pack on Vídeo Posicionamento Indoor** is modeled as an add-on with a price of €380. When selected, the total is €100 (base) + €380 (add-on) = €480. The description should clarify it replaces the single video with a pack of 8 (1 morning of recordings, 4 outfit changes, 2 indoor corners).

4. **Subscription services** are not one-time purchases. The system must track them as active subscriptions and auto-debit the agent's conta corrente monthly.

5. **All prices are in EUR and are the real prices.** Do not modify them.
