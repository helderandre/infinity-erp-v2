# RLS lockdown — public website (anon) vs. logged-in only

The anon key is **meant** to be public; the real protection is **RLS**, which is
currently off on the foundational tables. This locks it down without breaking the ERP.

## Model
- **`service_role` bypasses RLS** → every ERP admin-client API route keeps working.
- **`authenticated` gets full access** (`USING (true)`) → logged-in ERP users keep
  exactly today's access; only **anonymous** access is removed.
- **`anon` gets a narrow, row-scoped allowlist** → only what the public website reads/writes.

## Public allowlist (anon)
| Table | Anon access | Scope |
|---|---|---|
| `dev_properties` | SELECT | `show_on_website = true` |
| `dev_property_media` | SELECT | media of published properties |
| `dev_property_specifications` | SELECT | specs of published properties |
| `property_type`, `property_status` | SELECT | all (lookups) |
| `dev_users` | SELECT | `is_active AND display_website` |
| `dev_consultant_profiles` | SELECT | profiles of published consultants |
| `user_roles`, `roles` | SELECT | published consultants / lookup |
| `contact_form_submissions` | INSERT only | — |
| `create_website_lead()` | EXECUTE | must be `SECURITY DEFINER` |

Everything else currently RLS-off → **authenticated-only**. Tables that already
have RLS (the ~63 hand-designed ones, incl. the `leads_*` legacy pipeline) are
**left untouched**.

## Run order
1. **`01-verify.sql`** — read-only. Confirm current RLS state and that
   `create_website_lead.security_definer = true` (and its owner bypasses RLS).
2. **Apply on a Supabase BRANCH**, not prod: run `02-lockdown.sql`.
3. **Smoke-test on the branch**:
   - Website (anon): `/property` lists only published, `/agents` loads, lead +
     contact forms submit, a non-published or draft property is NOT readable.
   - ERP (logged in): a normal read/write still works.
   - ERP (service role): unaffected.
4. **Promote the branch to prod** once green. If anything breaks, run `03-rollback.sql`.

## Intended behaviour changes (confirmed)
- Public listings show **only `show_on_website = true`**.
- **`/property/add`** (anon insert/update/delete on `dev_properties`) **stops working
  anonymously** — it must become a logged-in/ERP action.

## Known follow-ups
- `roles` SELECT to anon exposes the `permissions` json structure (mild info
  disclosure, not credentials). Harden later with a column-limited `public_consultants`
  view and point the website at it, then drop anon access to the base tables.
- A consultant who is `is_active` but **not** `display_website` will no longer render
  on their own listing (the property page reads `dev_users` under the same anon policy).
- Optional defense-in-depth: `revoke` anon table grants in addition to RLS.
