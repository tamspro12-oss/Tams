# TAMS Pro Accounting Systems Comparison (Legacy vs. Unified Ledger)

*Plain-language guide explaining why totals can look different across screens in TAMS Pro and what a future safe merge requires. **No accounting formulas were modified in this update.***

---

## 1. The Two Systems Side by Side

TAMS Pro evolved from an earlier set of standalone tables into a newer double-entry ledger, and both sets of tables currently live in the database:

| Area | Legacy Tables | Unified Ledger Tables |
| :--- | :--- | :--- |
| **Parties (People & Companies)** | `clients`, `vendors`, `b2b_agents` | `parties` (stores `client`, `vendor`, `agent`) |
| **Bookings / Sales** | `clients` (price columns) + `b2b_bookings` | `booking_invoices` (`client_amount`, `vendor_payable`, `paid_amount`) |
| **Payments & Receipts** | `client_payment_history`, `vendor_payment_history`, `b2b_ledger`, `vouchers`, `cash_bank_entries` | `payment_vouchers`, `invoice_allocations`, `transactions`, `central_journal_entries` |
| **Accounts & Balances** | `agency_banks` + manual cash calcs | `accounts` (`type`: `'cash'` / `'bank'`) + `account_balances()` RPC |
| **Opening Balances** | `opening_balances` table | `transactions` (`type = 'opening'`, `legacy_source = 'opening_balance'`) + `parties.opening_balance` |

---

## 2. Where Totals Can Differ Today

### A. Vendor Dues (Dashboard vs. Vendors Tab)
- **What the Dashboard shows** (`src/pages/Dashboard.tsx`, `get_agency_financial_summary()` in SQL, and `computeFinancialMetrics()` in `src/lib/accountingEngine.ts`):
  - As soon as an agency has at least **1 row** in `booking_invoices`, the Dashboard computes Vendor Dues strictly from the **unified tables**:
    $$\text{Vendor Due} = \sum_{\text{per vendor}} \max\Big(0,\ \text{Active } \texttt{booking\_invoices.vendor\_payable} - \big(\text{Active } \texttt{payment\_vouchers (paid)} - \text{Vendor Refunds}\big)\Big)$$
  - It only reads `vendors.payment_amount - vendors.amount_paid` if `booking_invoices` has **zero** rows for that agency.
- **What the Vendors page shows** (`src/pages/Vendors.tsx` and `src/pages/VendorDashboard.tsx`):
  - Computes vendor payables directly from legacy `clients.purchasing_price` (where `clients.vendor_id = vendor.id`) plus `vendors.payment_amount` minus `vendors.amount_paid`.
- **Why they disagree**:
  - Invoices saved in the new Bookings Hub (`booking_invoices`) and payouts saved as `payment_vouchers` update the Dashboard, **not** `vendors.payment_amount` / `vendors.amount_paid`.
  - Conversely, legacy `vendors.payment_amount` / `vendors.amount_paid` entries or `opening_balances` rows for vendors are **not** included in the Dashboard KPI once `booking_invoices` is non-empty.

### B. Client Dues & Receivables
- **Dashboard & Reports Hub (`/app/reports`)**:
  - Reads `booking_invoices` (`client_amount - paid_amount`), grouped by `party_id` (`GREATEST(0, net_due)`).
  - Voided / refunded / cancelled invoices are excluded cleanly.
- **Legacy Client & B2B Views**:
  - Legacy `clients.selling_price - clients.amount_paid` and `b2b_bookings` / `b2b_ledger` store separate balances. Unless backfilled to `booking_invoices`, those balances are not added on top of `booking_invoices` on the Dashboard.
- **Party Opening Balances (`opening_balances` table)**:
  - Writing to `opening_balances` syncs an `opening` row to `transactions`, which shows up in Account/Party Statements (`transactions`), **but** `get_agency_financial_summary()` calculates `client_dues` and `vendor_dues` strictly from `booking_invoices` and `payment_vouchers` — so opening balances for a client or vendor do not automatically appear in the Dashboard "Client Dues" or "Vendor Dues" summary cards.

### C. Profit & Reports (`/app/reports` vs. `/app/accounts?tab=reports`)
- **Reports Hub (`/app/reports`, `src/pages/ReportsHub.tsx`)**:
  - Reads primarily from `booking_invoices` (falling back to `clients` only if `booking_invoices` is empty), `payment_vouchers`, `transactions`, `expenses`, and `refunds`.
- **Legacy Reports Tab (`/app/accounts?tab=reports`, `src/pages/Reports.tsx`)**:
  - Reads **only** from `clients`, `vendors`, and `expenses`. For agencies using `booking_invoices` and `payment_vouchers`, the Legacy Reports tab misses unified invoices and vouchers entirely.

### D. Cash & Bank Balance
- **Unified `account_balances()`** calculates `accounts.opening_balance + SUM(transactions.debit - credit WHERE reversed_of IS NULL)`. Internal transfers debit one account and credit another, netting to zero across total Cash & Bank.
- **Cash & Bank Manager (`cash_bank_entries`)** stores its own manual entry rows AND (for Cash In / Cash Out / Bank In / Bank Out) calls `record_payment` / `record_expense` to write to `transactions`. Until an agency reconciles historical `cash_bank_entries`, old pre-unification rows in `cash_bank_entries` only match `transactions` if they were backfilled.

---

## 3. What a Future Safe Merge Needs (Read-Only Roadmap)

Before removing legacy tables or forcing every page onto a single calculation, do these steps **non-destructively**:

1. **Per-agency audit query (read-only)**: Compare totals side-by-side for each live agency:
   - `clients` count & balance vs. `booking_invoices` count & balance
   - `vendors` count & balance vs. `parties(type='vendor')` + `booking_invoices.vendor_payable`
   - `opening_balances` rows vs. `transactions(legacy_source='opening_balance')` and `parties.opening_balance`
   - `cash_bank_entries` rows missing a matching `transactions` link
2. **Idempotent backfill verification**: Ensure any pre-existing `clients`, `vendors`, `b2b_bookings`, `vendor_payment_history`, and `opening_balances` rows that predate `booking_invoices` are linked into `parties`, `booking_invoices`, `payment_vouchers`, and `transactions` using `(agency_id, legacy_source, legacy_id)` without double-counting.
3. **Include Opening Balances explicitly in KPI definitions**: Decide whether Dashboard "Client Dues" and "Vendor Dues" should include `parties.opening_balance` / `opening_balances` receivables & payables, and update both `get_agency_financial_summary()` (SQL) and `computeFinancialMetrics()` (`accountingEngine.ts`) together in lockstep.
4. **Update `Vendors.tsx`, `VendorDashboard.tsx`, and `Reports.tsx`**: Switch them to read from `parties`, `booking_invoices`, `payment_vouchers`, and `transactions` (matching `ReportsHub` and `Dashboard`) **only after** verifying every agency's historical legacy vendor records exist in `parties` and `booking_invoices`/`payment_vouchers`.
5. **Keep legacy tables read-only for an archive window** (`60–90 days`) before ever considering table archival.
