# Marketing Shop & Conta Corrente — Feature Specification

## Overview

The Marketing Shop is an internal storefront within the CRM where agents can purchase marketing services (photography sessions, video production, design work, physical materials) for their properties. Purchases are not paid with real money — they are debited from the agent's **conta corrente** (current account), a running balance that tracks all debits and credits. When the agent earns a commission from a property sale, the outstanding balance is deducted before payout.

---

## 1. Service & Product Catalog (Back-Office)

The marketing team or admin manages the catalog of available services.

### 1.1 Service/Product Fields

Each catalog item has:

- `id` (UUID, auto-generated)
- `name` (text, required — e.g., "Sessão Fotográfica Lifestyle", "Vídeo Vertical para Imóvel")
- `description` (rich text, required — detailed explanation of what the service includes)
- `category` (enum/dropdown, required — Photography, Video, Design, Physical Materials, Ads, Other)
- `price` (decimal, required — in EUR)
- `estimated_delivery_days` (integer, required — SLA in business days)
- `thumbnail` (image URL, optional — for the storefront display)
- `is_active` (boolean, default true — inactive items are hidden from agents but kept for historical orders)
- `requires_scheduling` (boolean — true for services that need a property visit, like photo/video sessions; false for things like business cards or digital designs)
- `requires_property` (boolean — true for property-specific services, false for agent-level services like headshots or business cards)
- `created_at`, `updated_at` (timestamps)

### 1.2 Packs / Bundles

Bundles group multiple services at a discounted price.

- `id` (UUID)
- `name` (text, required — e.g., "Pack Premium: Fotos + Vídeo Vertical + Vídeo Posicionamento")
- `description` (rich text, required)
- `price` (decimal, required — the bundle price, typically less than the sum of individual items)
- `thumbnail` (image URL, optional)
- `is_active` (boolean)
- `created_at`, `updated_at`

Each bundle references its component services via a junction table (`marketing_pack_items`), so when a bundle is purchased, individual tasks can be generated for each component.

### 1.3 Catalog Display (Agent-Facing)

- Grid/gallery layout with service cards showing name, thumbnail, price, and brief description
- Filter by category
- Search by name
- Detail view per service with full description, price, estimated delivery time, and example work gallery (if available)
- Clear distinction between individual services and packs
- "Pedir Serviço" (Request Service) action on each item

---

## 2. Dual Entry Points

Agents can order marketing services from two different starting points. Both result in the same order record.

### Entry Point A: From the Marketing Shop

1. Agent browses the catalog and selects a service or pack
2. System asks: "Which property is this for?" (only if `requires_property` is true)
   - **Option 1:** Select from existing properties (searchable dropdown of the agent's portfolio) → form fields auto-fill with known data
   - **Option 2:** Fill in property details manually (for properties not yet registered in the CRM)
3. Agent fills the service request form (see Section 3)
4. Agent reviews summary, sees price and conta corrente impact, confirms
5. Order is placed, conta corrente is debited

### Entry Point B: From the Property Page

1. Agent is viewing one of their properties in the CRM
2. There is a "Pedir Serviço de Marketing" button or section on the property page
3. Property data is already pre-filled in the form
4. Agent is presented with available services/packs (filtered to those where `requires_property` is true), each showing name, description, price, and estimated delivery time
5. Agent selects what they want, reviews, confirms
6. Order is placed, conta corrente is debited

Both paths produce identical order records. The difference is only the UX sequence.

---

## 3. Service Request Form (Multi-Step)

When a service requires scheduling (e.g., photo or video session), the agent fills a multi-step form. The steps are:

### Step 1: Location / Morada

- `address` (text, required) — pre-filled if property selected
- `postal_code` (text, required) — pre-filled if property selected
- `city` (text, auto-filled from postal code if possible) — pre-filled if property selected
- `parish` (text, optional) — pre-filled if property selected
- `floor_door` (text, optional) — pre-filled if property selected
- `access_instructions` (textarea, optional — e.g., "ring bell 3B", "key at café next door", "gate code 1234")

### Step 2: Date & Scheduling

- `preferred_date` (date picker, required)
- `preferred_time` (selection: Manhã / Tarde / Todo o dia, required)
- `alternative_date` (date picker, required — fallback option for marketing team)
- `alternative_time` (selection: Manhã / Tarde / Todo o dia, required)

The agent is proposing date preferences, not booking a fixed slot. The marketing team confirms the final date after reviewing.

When the marketing team confirms a date, the system must create a **Google Calendar event** for:
- The assigned photographer/videographer
- The agent
- Optionally, the contact person listed in Step 4

### Step 3: Property Details / Dados do Imóvel

- `property_type` (dropdown, required — Apartamento, Moradia, Loja, Terreno, Escritório, Armazém, Garagem, Outros) — pre-filled if property selected
- `typology` (dropdown, required — T0, T1, T2, T3, T4, T5+) — pre-filled if property selected
- `area_m2` (number, required) — pre-filled if property selected
- `has_exteriors` (boolean toggle — does the property have outdoor areas to shoot?)
- `has_facades` (boolean toggle — should exterior building facades be captured?)
- `is_occupied` (boolean toggle — is someone currently living there? Affects scheduling and preparation)
- `is_staged` (boolean toggle — is the property already styled/staged for the shoot?)
- `number_of_divisions` (integer, optional — helps photographer estimate time needed)
- `parking_available` (boolean toggle, optional — practical for crew arriving with equipment)

If `is_occupied` is true, consider prompting for a note about coordinating access with the current occupant.

### Step 4: Contact Person / Quem vai?

The person who will be present at the property during the session. Not necessarily the agent.

- `contact_is_agent` (boolean — "I will be there myself". If true, auto-fill name and phone from agent's profile)
- `contact_name` (text, required)
- `contact_phone` (text, required — validate Portuguese format: +351 or 9-digit mobile)
- `contact_relationship` (dropdown, optional — Agent, Owner, Tenant, Colleague, Other)
- `contact_observations` (textarea, optional — e.g., "owner only speaks English", "dog on premises", "call 30 min before arrival")

### Step 5: Service Selection & Summary

This step adapts based on the entry point:

- **If coming from the Shop (Entry A):** The service is already selected. This step shows a review summary of the chosen service(s) plus all form data.
- **If coming from the Property Page (Entry B):** This step presents the available services/packs with names, descriptions, prices, and delivery times. The agent selects here.

In both cases, the summary displays:
- Selected service(s) / pack with individual prices and descriptions
- Total cost
- Agent's current conta corrente balance
- Projected balance after this purchase
- If the resulting balance would exceed a credit limit (if configured), show a warning or block the purchase
- Confirmation button: "Confirmar Pedido"
- Disclaimer text: "Este valor será debitado da sua conta corrente e deduzido nas próximas comissões"

---

## 4. Form Validation Rules

- All required fields must be filled before proceeding to the next step
- At least one date + time preference must be provided
- Phone number validated for Portuguese format (+351 or 9-digit mobile)
- Area must be a positive number
- If the agent's conta corrente would exceed the credit limit, block the purchase
- If the selected property already has a pending or in-progress order for the same service type, show a warning: "Já tem um pedido de [serviço] pendente para este imóvel. Deseja continuar?"

---

## 5. Post-Submission Flow

When the agent confirms the order:

1. **Order record is created** with all form data, selected services, and total amount
2. **Conta corrente is debited** immediately (DEBIT ledger entry on the agent's account)
3. **Notification is sent** to the marketing team (in-app + email) with the new order details
4. **A task is generated** for the marketing team to review, accept, and schedule
5. Order status starts as **"Pendente"**

### Marketing Team Processing

- Review the order and form details
- Accept or reject (with reason). If rejected, the debit is automatically reversed (REFUND entry on conta corrente).
- Confirm one of the proposed dates, or negotiate a different date with the agent
- Once a date is confirmed:
  - Order status → **"Agendado"**
  - Google Calendar event is created for all relevant parties
- When the session takes place and work begins:
  - Order status → **"Em Produção"**
- When deliverables are ready:
  - Marketing uploads files (photos, videos) to the order
  - Order status → **"Entregue"**
- Agent confirms satisfaction:
  - Order status → **"Concluído"**

### Cancellation

- Agent can request cancellation at any point before "Em Produção"
- If cancelled, the debit is reversed automatically (REFUND entry on conta corrente)
- Cancellation after "Em Produção" may require admin approval

---

## 6. Property Linking

### If agent selected an existing CRM property:
- Order is linked via `property_id`
- All deliverables produced from this order are automatically associated with the property's media gallery
- The property page shows a history of all marketing orders placed for it

### If agent filled in manually (property not in CRM):
- Form data is stored directly on the order record
- The system should offer an option to "Create this property in the CRM" from the order data (to avoid duplicate data entry later)
- If the property is registered later, the order can be retroactively linked to it

---

## 7. Conta Corrente (Agent Current Account)

### 7.1 Account Structure

Every agent has a conta corrente with:
- `agent_id` (FK to the agent/user)
- `current_balance` (decimal — can be negative, meaning the agent owes the company)
- Full transaction ledger (list of all movements)

### 7.2 Ledger Entry Fields

Every movement on the conta corrente is a ledger entry:

- `id` (UUID)
- `agent_id` (FK)
- `date` (timestamp)
- `type` (enum: DEBIT or CREDIT)
- `category` (enum):
  - DEBIT categories: `marketing_purchase`, `physical_material`, `fee_registration`, `fee_renewal`, `fee_technology`, `fee_process_management`, `manual_adjustment`
  - CREDIT categories: `commission_payment`, `refund`, `manual_adjustment`
- `amount` (decimal, always positive — the type field determines direction)
- `description` (text — human-readable, e.g., "Pack Premium — Rua da Liberdade 45")
- `reference_id` (UUID, nullable — links to the order ID, commission ID, or fee ID that generated this entry)
- `reference_type` (text — e.g., "marketing_order", "commission", "fee", "manual")
- `balance_after` (decimal — running balance after this transaction)
- `created_by` (FK to user — system or admin who triggered it)
- `created_at` (timestamp)

### 7.3 Commission Integration

When an agent earns a commission (from a property sale/rent):

1. The gross commission amount is calculated
2. The system checks the agent's conta corrente balance
3. If the balance is negative, the owed amount is deducted from the commission
4. The net payout = commission - abs(negative balance)
5. A CREDIT ledger entry is created for the full commission
6. The balance auto-adjusts
7. The invoice is generated for the net payout amount

**Example:** Agent has a balance of -€500. They earn a €3,000 commission. A CREDIT of €3,000 is applied. New balance: +€2,500. The agent receives €2,500 as payout.

### 7.4 Automatic Debit on Purchase

When an agent confirms a marketing shop order:
- A DEBIT entry is created for the total order amount
- Balance is updated immediately
- Agent sees the updated balance in their profile, dashboard, and within the shop

### 7.5 Balance Visibility

- Agent can see their current balance at all times (profile, dashboard, shop checkout)
- Full transaction history, filterable by date range, type, and category
- Negative balance is visually flagged (e.g., red text, warning indicator)
- Manager/admin has a global view of all agents' balances

### 7.6 Alerts & Limits

- Optional credit limit per agent (maximum allowed negative balance). If exceeded, new purchases are blocked.
- Alert to manager when an agent's negative balance exceeds a configurable threshold
- Notification to agent when their balance changes (on purchase, on commission credit, on refund)

---

## 8. Marketing Team — Order Management

### 8.1 Orders Inbox

- List of all incoming orders from agents
- Filterable by: status, agent, category, urgency, date
- Sortable by urgency and date
- Badge/notification count for new pending orders

### 8.2 Order Processing

- View full order details (agent, items, property, form data, proposed dates, contact person)
- Accept or reject (rejection requires a reason; triggers automatic debit reversal)
- Assign to a team member (photographer, videographer, designer)
- Update status as work progresses
- Upload deliverables (photos, videos, files) directly to the order
- Mark as delivered
- Internal notes (visible only to marketing team, not the agent)

### 8.3 Task Auto-Generation

When an order is accepted:
- One task is created per service item in the order
- Each task is assigned to the relevant team member
- Deadline is set based on estimated_delivery_days + urgency
- Task is linked to the order and the property
- Tasks appear on the marketing calendar and individual task lists
- Email alert is sent if a task becomes overdue

---

## 9. Admin / Financial Management

### 9.1 Catalog Administration

- Full CRUD for services and packs
- Price changes only affect future orders, not existing ones
- Category management (add/edit/remove categories)

### 9.2 Conta Corrente Administration

- Table view of all agents' current balances
- Manual credit or debit adjustments (with mandatory reason field — for corrections, exceptions, non-standard charges)
- Export conta corrente statement per agent (PDF or CSV)
- Export global financial summary across all agents

### 9.3 Commission Payout Process

When processing a commission payout from the deals module:
1. Calculate gross commission
2. Check agent's conta corrente balance
3. If negative, deduct the owed amount automatically
4. Display the net payout amount for admin review
5. On confirmation, create the CREDIT ledger entry
6. Generate or flag the invoice for the net amount

---

## 10. Database Tables

### Core Tables

- **marketing_catalog** — individual services/products
- **marketing_packs** — bundles definition
- **marketing_pack_items** — junction: which catalog items belong to which pack
- **marketing_orders** — orders placed by agents
- **marketing_order_items** — individual items within each order (references catalog or pack)
- **marketing_order_form_data** — the full form submission per order (location, dates, property details, contact person). Can also be flattened into marketing_orders if preferred.
- **marketing_order_schedule** — confirmed date/time, assigned team member, Google Calendar event reference ID
- **marketing_order_deliverables** — files uploaded as deliverables per order
- **conta_corrente_transactions** — the ledger (every debit and credit entry)
- **conta_corrente_limits** — optional credit limits per agent

### Key Relationships

- `marketing_orders.agent_id` → users table
- `marketing_orders.property_id` → properties table (nullable for manual entries)
- `marketing_order_items.catalog_item_id` → marketing_catalog
- `marketing_order_items.pack_id` → marketing_packs (nullable)
- `conta_corrente_transactions.agent_id` → users table
- `conta_corrente_transactions.reference_id` → marketing_orders or commissions table (polymorphic via reference_type)

---

## 11. Key Business Rules

1. Agents never pay with real money — everything is debited from their conta corrente
2. Conta corrente balance can go negative (agent owes the company)
3. Commissions are the primary way balances are credited
4. Net payout = Commission earned minus negative conta corrente balance
5. Orders auto-generate tasks for the marketing team
6. Catalog price changes do not affect existing orders
7. Rejected or cancelled orders automatically reverse the debit (REFUND entry)
8. Every transaction is traceable (audit trail: who, when, what, why)
9. Only admins can make manual adjustments to the conta corrente
10. Agents see a clear balance warning before confirming any purchase
11. Confirmed scheduling dates create Google Calendar events for all parties
12. Deliverables from orders flow back to the property's media gallery automatically
13. Duplicate order warning if the same service is already pending for the same property

---

## 12. Order Status Flow

```
Pendente → Aceite → Agendado → Em Produção → Entregue → Concluído
              ↓
          Rejeitado (debit reversed)

At any point before "Em Produção":
   → Cancelado (debit reversed)
```

---

## 13. Line to Add to claude.md

```
For the Marketing Shop & Conta Corrente feature, refer to specs/marketing-shop.md
```
