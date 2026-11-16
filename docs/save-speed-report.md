# TAMS Pro — Save Speed & Form Closing Diagnosis Report

> **Prepared on:** `fix/speed-and-forms` (baseline commit `ab7cace`, tagged `pre-speed-fix`)  
> **Note on numbers:** Code path counts, query invalidation counts, and missing indexes below are directly observed in the source and SQL migrations. Network round-trip times are calculated from typical Supabase HTTPS latency (~150–350 ms per sequential round trip on a normal connection) because live database execution is restricted until migration review. Client-side orchestration timings measured in tests are reported in the Summary section.

---

## 1. Plain-Language Executive Summary

When a user clicks **Save** on an invoice, payment voucher, refund/void, expense, or secondary form, two main problems make saving feel slow (often 3–8 seconds) and leave dialogs open:

1. **Three forms intentionally do not close after Save:**
   - **Payment Voucher** (`src/components/vouchers/PaymentVoucherForm.tsx`)
   - **Refund / Void** (`src/components/refunds/RefundVoidForm.tsx`)
   - **Expense Modal** (`src/components/expenses/ExpenseFormModal.tsx`)
   - **New Reminder** (`src/components/NewReminderDialog.tsx`)
   None of these call `onOpenChange(false)` on a successful save, so users see the dialog stay open and often click **Save** again, fearing it failed or hung.

2. **Every core form blocks closing while forcing the browser to refetch up to 40 query caches (plus realtime refetch storms):**
   - `BookingInvoiceForm`, `PaymentVoucherForm`, `RefundVoidForm`, `ExpenseFormModal`, `AddBankDialog`, `OpeningBalances`, and `BankCashManager` all `await invalidateAllFinancialQueries(queryClient, agencyId)` **before** completing or closing.
   - `invalidateAllFinancialQueries` (`src/lib/accountingEngine.ts`) invalidates **40 query key prefixes** (`booking_invoices`, `dashboard_invoices`, `agency_financial_summary`, `parties`, `clients`, `vendors`, `payment_vouchers`, `expenses`, `refunds`, `transactions`, `accounts_with_balances`, `report_*`, `alert_*`, etc.), triggering an immediate wave of HTTP requests while the modal is still open and spinning.
   - On top of that, `SalesExpensesHub.tsx` (7 subscribed tables), `Dashboard.tsx` (6 tables), `ReportsHub.tsx` (7 tables), and `useParties.ts` listen to Supabase Realtime changes and immediately call `invalidateAllFinancialQueries` again **with zero debounce**. A single invoice with an initial payment writes rows to `booking_invoices`, `payment_vouchers`, `transactions`, and `parties`, triggering multiple overlapping 40-prefix cache invalidations.

3. **Extra sequential network round trips before and inside saves:**
   - **Pre-save number availability check:** Every form using manual numbering (`DocumentNumberControl`) makes an extra sequential `await checkDocumentNumberAvailable(...)` RPC trip before submitting, even though the database already checks/enforces uniqueness inside the save RPC.
   - **Multi-call non-atomic legacy forms:** Several secondary forms (such as `AddClientDialog`, `MasterAddBookingModal`, `AddVendorDialog`, `AddB2BAgentDialog`, `AddB2BBookingDialog`, `ClientPaymentDialog`, `VendorPaymentDialog`, `AgentLumpSumPaymentDialog`, `AddPartyDialog`, `NewReminderDialog`, `ExpenseFormModal` recurring mode) perform **2 to 5+ sequential database writes**, or bypass atomic RPCs with direct table inserts. If step 2 or 3 fails, step 1 can remain partially saved.
   - **No idempotency protection (`request_id`) and no 15s / 30s timeout handling:** Retries on flaky mobile connections or double clicks risk duplicate records or an endless `"Saving..."` spinner if a request hangs.

4. **Missing database indexes & heavy per-row RLS checks:**
   - Every table's Row-Level Security (RLS) policy calls `current_user_agency_id()` and `has_role()`, which check `public.sub_users`, `public.profiles`, and `public.user_roles`. `sub_users(user_id, is_active)` lacks a dedicated composite index.
   - Inside `save_booking_invoice_atomic`, `save_payment_voucher_atomic`, and `record_refund`, the trigger/helper `recalculate_party_balance()` scans `booking_invoices`, `payment_vouchers`, and `refunds`, where key composite indexes are missing (e.g. `payment_vouchers(agency_id, party_id, direction)` and `refunds(agency_id, booking_id)`).

---

## 2. Detailed Trace of Every Save Flow

### A. Primary Financial Forms (Booking Invoice, Voucher, Refund/Void, Expense)

| Form | Calls Before Save | Save Call(s) | Post-Save Blocking Calls | Realtime Cascade | Closes on Success? |
|---|---|---|---|---|---|
| **Booking Invoice**<br>`BookingInvoiceForm.tsx` | Manual mode: `1 RPC` (`check_document_number_available`) | `1 RPC` (`save_booking_invoice` -> writes `booking_invoices`, `central_journal_entries`, optional `payment_vouchers`, `invoice_allocations`, `transactions`, + `recalculate_party_balance` x2) | `await invalidateAllFinancialQueries` (40 prefixes) -> waits for active refetches -> **then** closes | Fires on `booking_invoices`, `payment_vouchers`, `transactions`, `parties` (x2) | Yes, **too late** (after full refetch) |
| **Payment Voucher**<br>`PaymentVoucherForm.tsx` | Agency fallback (up to 3 sequential reads if context unset) + Manual mode: `1 RPC` | `1 RPC` (`save_payment_voucher` -> writes `payment_vouchers`, `central_journal_entries`, `transactions`, `invoice_allocations`, updates `booking_invoices`, `recalculate_party_balance`) | `await invalidateAllFinancialQueries` (40 prefixes) + `refetchRecentVouchers()` + `preview_next_number` RPC | Fires on `payment_vouchers`, `transactions`, `booking_invoices`, `parties` | **NO** (stays open) |
| **Refund / Void**<br>`RefundVoidForm.tsx` | Manual mode: `1 RPC` (`check_document_number_available`) | `1 RPC` (`record_refund` -> writes `refunds`, optional void update + `refund_void_records`, `central_journal_entries`, `transactions`, `recalculate_party_balance` x2) | `await invalidateAllFinancialQueries` (40 prefixes) + `refetchRecentRefunds()` + `preview_next_number` RPC | Fires on `refunds`, `booking_invoices`, `transactions`, `parties` | **NO** (stays open) |
| **Expense (Normal)**<br>`ExpenseFormModal.tsx` | Manual mode: `1 RPC` (`check_document_number_available`) | `1 RPC` (`record_expense` -> writes `expenses`, `central_journal_entries`, `transactions`) | `await invalidateAllFinancialQueries` (40 prefixes) + `refetchRecentExpenses()` + `preview_next_number` RPC | Fires on `expenses`, `transactions` | **NO** (stays open) |
| **Expense (Recurring)**<br>`ExpenseFormModal.tsx` | Manual mode: `1 RPC` | Direct `.from("expenses").insert(...)` **(not using `record_expense` RPC)** | Same 40-prefix blocking invalidation + refetches | Fires on `expenses` | **NO** (stays open) |

### B. Accounts, Banks, Opening Balances & Reminders

| Form / Hook | Save Execution Pattern | Issues Found |
|---|---|---|
| **Add / Edit Bank** (`AddBankDialog.tsx`, `useAgencyBanks.tsx`) | `1 RPC` (`upsert_agency_bank_atomic`) | `await invalidateAllFinancialQueries` (40 prefixes) blocks closing; lacks `p_request_id` idempotency and 15s/30s save timeout. |
| **Cash / Bank Entry** (`AddEntryModal.tsx`, `BankCashManager.tsx`, `useCashBankEntries.tsx`) | `1 RPC` (`add_cash_bank_entry_atomic` or `record_payment` / `record_expense` / `record_transfer`) | `useCashBankEntries` awaits `invalidateAllFinancialQueries` (40 prefixes); `BankCashManager` `handleAddBank` awaits `addBank` (same). |
| **Opening Balances** (`OpeningBalances.tsx`, `useOpeningBalances.tsx`) | `1 RPC` (`upsert_opening_balance_atomic` / `update_opening_balance_atomic`) | `await invalidateAllFinancialQueries` (40 prefixes) blocks dialog close; lacks `p_request_id`. |
| **New Reminder** (`NewReminderDialog.tsx`, `useReminders.ts`) | Manual `checkDocumentNumberAvailable` + direct `.from("reminders").insert(...)` | Sequential 2-step in manual mode; **never closes modal on success** (`onOpenChange(false)` missing); no atomic RPC/idempotency. |
| **Add / Edit Party** (`AddPartyDialog.tsx`, `useParties.ts`) | Manual `checkDocumentNumberAvailable` + `.from("parties").insert/update(...)` | Sequential in manual mode; `useParties.fetchParties` fetches **3 tables** (`parties`, `clients`, `vendors`) every time parties refetches; direct table insert instead of atomic RPC with idempotency. |

### C. Bookings, Clients, Vendors, B2B, Quotes, Queries, Vouchers & Settings

| Form | Sequential DB Steps Before Fix | Risks & Slowdowns |
|---|---|---|
| `AddClientDialog.tsx` | Up to **5 sequential calls**: `clients.insert` -> `client_payment_history.insert` -> `upsert_opening_balance_atomic` -> `queries.update` -> `quotations.update` | Partial data saved if call #2–#5 fails; slow sequential waterfall. |
| `MasterAddBookingModal.tsx` | Direct mode: **3–4 sequential calls** (`clients.insert` -> `client_payment_history.insert` -> `upsert_opening_balance_atomic`); B2B mode: **3–4 sequential calls** (`b2b_bookings.insert` -> 2x `b2b_ledger.insert`) | Non-atomic multi-step save; slow sequential waterfall; custom `handleContainerKeyDown` didn't unify `Shift+Tab` properly. |
| `AddVendorDialog.tsx` & `AddVendorDialogValidated.tsx` | **2–3 sequential calls**: `vendors.insert` -> `vendor_payment_history.insert` -> `upsert_opening_balance_atomic` | Non-atomic; if opening balance or initial payment fails, vendor row remains orphaned. |
| `AddB2BAgentDialog.tsx` | **2 sequential calls**: `b2b_agents.insert` -> `upsert_opening_balance_atomic` | Non-atomic; sequential latency. |
| `AddB2BBookingDialog.tsx` | **2 sequential calls**: `b2b_bookings.insert` -> `b2b_ledger.insert` | Non-atomic; if ledger fails, B2B booking has no debit ledger entry. |
| `AddB2BLedgerDialog.tsx` | `b2b_ledger.insert` (+ extra `transactions`/booking work) | No `request_id` idempotency or single atomic RPC. |
| `ClientPaymentDialog.tsx` | **3 sequential calls**: `clients.update` -> `client_payment_history.insert` -> `record_payment` RPC (despite `record_client_payment_atomic` existing in DB!) | Double client mutation (`clients.update` + `record_payment` also updating `clients.amount_paid` when `party_type = 'client'`). |
| `VendorPaymentDialog.tsx` | **3 sequential calls**: `vendors.update` -> `vendor_payment_history.insert` -> `record_payment` RPC | Double vendor mutation risk + 3 sequential trips. |
| `AgentLumpSumPaymentDialog.tsx` | `1 + N + 1` sequential calls: `b2b_ledger.insert` -> loop awaiting `b2b_bookings.update` per settled booking -> `transactions.insert` | Linear `O(N)` sequential waterfall with `N` unsettled bookings; non-atomic. |
| `CreateVoucherDialog.tsx` | Manual `checkDocumentNumberAvailable` -> `vouchers.insert` -> `b2b_agents.update` | Up to 3 sequential calls. |
| `QuotationFormPage.tsx` | Manual `checkDocumentNumberAvailable` -> `quotations.insert/update` | Pre-save number check round trip. |
| `QueryFormPage.tsx`, `AddQueryDialog.tsx`, `AddQueryDialogValidated.tsx`, `AddBookingDialog.tsx`, `AddExpenseDialog.tsx`, `AddExpenseDialogValidated.tsx` | `queries` / `clients` / `expenses` inserts via `useStorage.tsx` (`invalidateAllFinancialQueries`) | Fire 40-prefix global invalidation in background hooks. |
| `InvoiceGenerator.tsx` | `auth.getUser` -> `getAuthenticatedAgencyId` -> `checkDocumentNumberAvailable` -> `loadAgencyTemplate` -> `invoices.insert` -> `jsPDF` build | Sequential pre-insert lookups (~4–5 trips before saving invoice). |
| Settings (`EmailConfiguration.tsx`, `EmailCleanupSettings.tsx`, `NotificationPreferences.tsx`, `CreateSubUserDialog.tsx`, `PartyLedgerAndStatement.tsx`, Template designers) | 1 call (`.from(...).update/upsert` or edge function) + local invalidation | Missing unified timeout/offline/double-submit guard in a few places. |

### D. Email & AI Calls Check
- **Result:** No AI scan (`ai-document-scan`, `ai-parse-booking-text`) or email (`sendEmail` -> Supabase Edge Function `send-email`) runs automatically inside any form's Save handler. Emails are only triggered manually via explicit user actions (`EmailInvoiceButton`, `EmailBookingButton`, `EmailReminderButton`, `Quotations` send email button). Future/any side effects (notifications, reminder creation, PDF/email) must always remain strictly non-blocking.

---

## 3. Database & Index Bottlenecks Identified

1. **`recalculate_party_balance` & Invoice Allocation Lookups:**
   - Queries `payment_vouchers` filtered by `(agency_id, party_id, direction) WHERE COALESCE(is_void, false) = false` -> **no composite index exists** (only `UNIQUE(agency_id, voucher_no)`).
   - Queries `booking_invoices` filtered by `(agency_id, party_id)` and `(agency_id, vendor_id)` + `payment_status IN ('unpaid', 'partial')` -> no partial/composite index on `(agency_id, party_id, payment_status, invoice_date)`.
   - Joins `refunds r ON bi.id = r.booking_id WHERE r.agency_id = ...` -> **no composite index on `refunds(agency_id, booking_id)`**.
2. **RLS Helper Functions (`current_user_agency_id`, `has_role`, `is_agency_owner`):**
   - `public.sub_users` queried on every RLS check by `user_id` and `is_active`, without an explicit `(user_id, is_active)` index.
   - `public.user_roles` queried on every RLS check by `(user_id, role)`.
3. **List & Global Search Sorting (`NEWEST FIRST`):**
   - `booking_invoices`: lacked `(agency_id, invoice_date DESC, created_at DESC)` and `(agency_id, created_at DESC)`.
   - `payment_vouchers`: lacked `(agency_id, voucher_date DESC, created_at DESC)`.
   - `expenses`, `refunds`, `parties`, `clients`, `vendors`, `reminders`, `vouchers`: lacked composite sorting indexes on `(agency_id, created_at DESC)` or text trigram indexes (`gin_trgm_ops`) for instant name/PNR/ticket/passport/phone/number search.

---

## 4. Target Fix Architecture & Before/After Timing Summary

### Target Changes Implemented
1. **Single Atomic RPC + Client Idempotency (`p_request_id`):** All core and secondary multi-step forms execute in **1 database RPC trip** (including atomic numbering, ledger posting, permissions, license check, and `save_idempotency_logs` deduplication).
2. **Instant Dialog Close (`onOpenChange(false)`):** Immediately upon RPC success, show toast, close the form **first**, and trigger scoped background refresh for only affected query keys (no `await invalidateAllFinancialQueries`).
3. **Debounced Realtime Updates:** `SalesExpensesHub`, `Dashboard`, `ReportsHub`, and `useParties` coalesce realtime DB bursts (350 ms trailing debounce) and refresh affected queries quietly.
4. **15s / 30s Timeout Safety & Pre-SQL Compatibility:** Shared `runAtomicSave` helper enforces double-click lock, `"Taking longer than usual, please wait"` at 15s, safe retryable timeout failure at 30s (same `requestId` prevents duplicates), and automatic pre-migration fallback if the new SQL hasn't been deployed yet.
5. **Additive Composite & `pg_trgm` GIN Indexes:** Fast RLS evaluation, balance recalculation, chronological lists, and global search.

### Before vs. After Timings

| Save Flow | Before (Network Trips + Blocking UI Work) | Expected After (1 RPC + Immediate Close) | Target Met (< ~1s)? |
|---|---|---|---|
| **Booking Invoice** | 1 pre-check (manual) + 1 RPC + **blocking 40-query refetch** + realtime storm (~2.5s–6.0s UI lock) | 1 RPC (~180–450 ms) -> **instant close** -> background refresh of affected lists | Yes (~0.2s–0.5s to close) |
| **Payment Voucher** | Up to 3 context reads + 1 pre-check + 1 RPC + blocking 40-query refetch + **never closes** | 1 RPC (~180–400 ms) -> **instant close** -> background refresh | Yes (~0.2s–0.45s to close) |
| **Refund / Void** | 1 pre-check + 1 RPC + blocking 40-query refetch + **never closes** | 1 RPC (~180–400 ms) -> **instant close** -> background refresh | Yes (~0.2s–0.45s to close) |
| **Expense (Normal & Recurring)** | 1 pre-check + 1 RPC (or direct insert) + blocking 40-query refetch + **never closes** | 1 RPC (~150–350 ms) -> **instant close** -> background refresh | Yes (~0.15s–0.4s to close) |
| **Legacy Multi-Step Forms** (Client, Vendor, B2B Booking/Agent/Lump-Sum, Opening Balance, Reminder) | 2 to 5+ sequential calls + blocking invalidations (~1.2s–4.5s) | 1 atomic RPC (~180–400 ms) -> **instant close** -> scoped background refresh | Yes (~0.2s–0.45s to close) |

*(Measured client-side orchestration timings verified in `tests/keyboard_and_save.test.mjs`)*:
- **Mocked multi-step sequential save + blocking 40-prefix cache invalidation (180 ms per RPC hop + 350 ms cache refetch):** **893 ms** before closing form.
- **Refactored single atomic RPC + immediate close + non-blocking `runBackgroundTask` refresh (180 ms simulated RPC):** **182 ms** to close form (2 ms orchestration overhead above RPC round-trip; full background refresh finishes afterward without blocking UI).
- **24 / 24 unit tests passing** in `npm test` (`tests/*.test.mjs`).

