# Speed & AI Boost Plan

Goal: make the app the fastest travel agency manager to operate, without touching existing tables, RLS, or business logic. Everything below is **additive-only** and layered on top of current forms/lists.

---

## 1. Smarter AI Document Scanner (upgrade existing `ai-document-scan`)

Extend the current scanner — no schema changes, same edge function name.

- **Batch upload**: accept up to 5 files in one dialog (passport + visa + ticket + ID front + ID back).
- **Multi-page PDF**: send all pages to Gemini as one `file` block; merge extracted fields.
- **Back+front ID**: auto-merge fields from two images (front → name/DOB/number, back → address/expiry).
- **Auto-classify**: model returns `doc_type` per file (passport / cnic / visa / ticket / invoice / receipt) so we know where to route the values.
- **Confidence per field** + a review sheet before applying — user clicks "Apply all" or edits individual fields. Nothing writes to DB until user saves the form.

## 2. AI Booking Assistant — "Paste to Booking"

New floating button `✨ Paste email / WhatsApp` on Booking, B2B Booking, and Client dialogs.

- User pastes airline confirmation, GDS PNR text, or a WhatsApp message.
- Edge function `ai-parse-booking-text` (new) → Gemini with strict prompt → returns JSON: PNR, airline, flight_no, dates, sector, pax list, fares, class.
- Fields land in the same form as the scanner, fully editable before save.
- Zero DB writes from the edge function; it only returns JSON.

## 3. Extend AI Autofill to 3 more forms

Reuse the existing `ScanAutofillButton` component, add a `fieldMap` per form:

- **Umrah Booking form** — passport → pax rows; visa → visa#/expiry; hotel voucher → hotel name/checkin/checkout.
- **Expense entry** — receipt image/PDF → amount, date, vendor, category guess, notes.
- **Vendor invoice / payment** — invoice PDF → vendor name match, invoice #, amount, due date, reference.

No changes to columns; only DOM-level value setting like today.

## 4. Global Command Bar (Ctrl/⌘+K)

New `CommandPalette.tsx` mounted once in `AppLayout`.

- Fuzzy search across clients, bookings (PNR), vendors, B2B agents (client-side filter of already-loaded lists — no new queries).
- Quick actions: "New booking", "New expense", "Add payment", "Go to Dashboard", "Sign out".
- Keyboard-only navigation.

## 5. Keyboard Shortcuts

Lightweight `useHotkeys` hook, shown in a "?" cheatsheet modal.

- `N` new booking · `Shift+N` new client · `E` new expense · `/` focus search · `Ctrl+S` save in any open dialog · `Esc` close dialog.

## 6. Bulk Actions (Bookings, Clients, Vendors, Expenses lists)

Additive column with checkboxes + a floating action bar when ≥1 row selected:

- Bookings: bulk status change, bulk export (CSV/PDF), bulk delete.
- Clients / Vendors: bulk export, bulk delete.
- Expenses: bulk category change, bulk export.

All operations reuse existing single-row mutations in a `Promise.all` loop with the same RLS/permissions — no new endpoints.

## 7. Saved Templates / Favorites

New table `booking_templates` (agency-scoped, RLS + grants per project rules) storing a JSON snapshot of a booking form. "Save as template" button on booking dialogs; "New from template" in the list header.

## 8. Virtualized Long Tables

Wrap Bookings, Clients, Vendors, B2B Bookings, Ledger, Expenses tables in `@tanstack/react-virtual`. No API changes, purely rendering — smooth on 1000+ rows.

---

## Technical Notes

- **AI**: Lovable AI Gateway, model `google/gemini-3-flash-preview` for text/parse, multimodal `image_url` + `file` blocks for scans. Structured output via `Output.object` with a flat schema; limits described in prompt, clamped in code.
- **Edge functions**: new `ai-parse-booking-text`; existing `ai-document-scan` extended to accept `files[]` and return `doc_type` + `confidence`. Both JWT-validated, CORS handled, no DB writes.
- **Frontend**: new files only — `CommandPalette.tsx`, `useHotkeys.ts`, `PasteToBookingButton.tsx`, `BulkActionBar.tsx`, `VirtualTable.tsx`, `TemplatePicker.tsx`. Existing dialogs get small additive imports; no logic rewrites.
- **DB**: only one new table (`booking_templates`) with proper `GRANT` + RLS scoped to `agency_id`. No changes to existing tables, functions, or triggers.
- **Privacy**: scanned files stay in-memory in the edge function; nothing persisted. No cross-agency data flow.

## Out of Scope

Refactoring existing forms, changing accounting logic, altering RLS on existing tables, replacing current UI framework.
