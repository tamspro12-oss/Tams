# Party Ledger vs. Stored Party Balance Mismatch Log

> **Policy:** TAMS Pro never alters accounting numbers or forces balances to match. When the chronological sum of a party's ledger entries differs from `parties.current_balance`, the Ledger View displays a small friendly notice and keeps both values honest and transparent.

## Structural Causes Identified in Existing Database Logic

In `supabase/migrations/20261114_02_accounting_unification_rpcs_and_realtime.sql`, `public.recalculate_party_balance(p_party_id, p_agency_id)` computes `parties.current_balance` as:

```text
current_balance = opening_balance
  + SUM(active non-void booking_invoices.client_amount where party_id = p_party_id)
  - SUM(non-void payment_vouchers.amount where party_id = p_party_id and direction = 'received')
  - SUM(active non-void booking_invoices.vendor_payable where vendor_id = p_party_id)
  + SUM(non-void payment_vouchers.amount where party_id = p_party_id and direction = 'paid')
  - SUM(refunds.vendor_refund_amount joined to non-void booking_invoices where vendor_id = p_party_id)
```

Because `src/lib/partyLedger.ts` displays the complete chronological sub-ledger (including cash refunds and void reversals), the ledger closing balance can legitimately differ from `parties.current_balance` in these cases:

1. **Client cash refunds (`refunds.client_refund_amount > 0`):**
   - `record_refund` inserts a `refunds` row with `client_refund_amount > 0` (money paid back to the client) and may also mark the linked `booking_invoices` row as `is_void = true`.
   - `recalculate_party_balance` drops the voided invoice from `v_client_invoiced` and keeps the original receipt in `v_client_paid`, **but does not add back `client_refund_amount`**.
   - Example: Client invoiced PKR 100,000, paid PKR 40,000 (balance PKR 60,000 DR), then invoice voided and PKR 40,000 refunded in cash. True ledger balance is `0` (`+100,000 - 100,000 - 40,000 + 40,000`), whereas `parties.current_balance` reports `-40,000` (`PKR 40,000 CR`).
2. **Vendor refunds on voided invoices (`refunds.vendor_refund_amount > 0` when `booking_invoices.is_void = true`):**
   - `recalculate_party_balance` filters `COALESCE(bi.is_void, false) = false` when summing `r.vendor_refund_amount`.
   - If an invoice is marked `is_void = true` in the same refund/void operation that records a vendor refund, `recalculate_party_balance` excludes `vendor_refund_amount` while still keeping the original vendor payment voucher in `v_vendor_paid`.
3. **Direct edits to `parties.opening_balance` via pre-SQL fallback:**
   - When `AddPartyDialog` updates a party using the pre-SQL fallback `.update(updates)` without `save_party_atomic`, `opening_balance` changes on `parties` without re-running `recalculate_party_balance` until the next invoice or voucher save.
4. **Legacy-only tables (`clients`, `vendors`, `client_payment_history`, `vendor_payment_history`):**
   - Legacy bookings and payments recorded before `parties` unification live in `clients` / `vendors` rather than `booking_invoices` / `payment_vouchers`, so `parties.current_balance` does not include entries that exist only in legacy tables.

## Verification Behavior in UI & Statements

- **Ledger View (`PartyLedgerView`):** Computes running balance oldest-to-newest from opening balance and compares the final row's running balance against `parties.current_balance`. Any difference `> PKR 0.01` surfaces a quiet, non-blocking note without changing any figure.
- **Send Statement (`SendStatementDialog`):** When a statement period ends today (including `This month`, `Last 3 months`, `All time`, or a Custom range ending today), compares the statement closing balance against `parties.current_balance` and surfaces the same friendly note if they differ, without modifying any numbers.

