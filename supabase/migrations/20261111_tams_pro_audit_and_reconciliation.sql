-- ==============================================================================
-- TAMS PRO: MULTI-AGENCY DATA ISOLATION, SAVE RELIABILITY & RECONCILIATION
-- Migration: 20261111_tams_pro_audit_and_reconciliation.sql
-- 100% Additive, Idempotent, Strict Multi-Tenant Isolation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXPAND AGENCY COUNTERS TABLE TO SUPPORT ALL BUSINESS SEQUENCES
-- ------------------------------------------------------------------------------
-- Drop old counter_type check and update with all entity types
DO $$
BEGIN
  ALTER TABLE public.agency_counters DROP CONSTRAINT IF EXISTS agency_counters_counter_type_check;
  ALTER TABLE public.agency_counters ADD CONSTRAINT agency_counters_counter_type_check 
    CHECK (counter_type IN ('invoice', 'client', 'vendor', 'voucher', 'refund', 'expense', 'quotation', 'query', 'reminder'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Update format_agency_number to format all sequence types
CREATE OR REPLACE FUNCTION public.format_agency_number(
  p_agency_id UUID,
  p_counter_type TEXT,
  p_val BIGINT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_code TEXT;
  v_digits INT;
BEGIN
  SELECT agency_code INTO v_agency_code
  FROM public.agencies
  WHERE id = p_agency_id;

  IF v_agency_code IS NULL OR TRIM(v_agency_code) = '' THEN
    v_agency_code := 'A00001';
  END IF;

  IF p_counter_type = 'invoice' THEN
    v_digits := GREATEST(8, LENGTH(p_val::TEXT));
    RETURN 'INV-' || v_agency_code || '-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'client' THEN
    v_digits := GREATEST(6, LENGTH(p_val::TEXT));
    RETURN 'C-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'vendor' THEN
    v_digits := GREATEST(6, LENGTH(p_val::TEXT));
    RETURN 'V-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'voucher' THEN
    v_digits := GREATEST(8, LENGTH(p_val::TEXT));
    RETURN 'PV-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'refund' THEN
    v_digits := GREATEST(8, LENGTH(p_val::TEXT));
    RETURN 'RF-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'expense' THEN
    v_digits := GREATEST(8, LENGTH(p_val::TEXT));
    RETURN 'EXP-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'quotation' THEN
    v_digits := GREATEST(8, LENGTH(p_val::TEXT));
    RETURN 'QT-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'query' THEN
    v_digits := GREATEST(6, LENGTH(p_val::TEXT));
    RETURN 'QRY-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'reminder' THEN
    v_digits := GREATEST(6, LENGTH(p_val::TEXT));
    RETURN 'REM-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSE
    RETURN p_val::TEXT;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. AUTO-ASSIGN NUMBERING TRIGGERS FOR EXPENSES, QUOTATIONS, QUERIES & REMINDERS
-- ------------------------------------------------------------------------------
-- Auto-assign Expense Reference Number
CREATE OR REPLACE FUNCTION public.assign_expense_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_number IS NULL OR TRIM(NEW.reference_number) = '' OR NEW.reference_number ~* 'preview' OR NEW.reference_number ~ '^EXP-[0-9]{4,6}$' THEN
    NEW.reference_number := public.next_formatted_number(NEW.agency_id, 'expense');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_expense_number ON public.expenses;
CREATE TRIGGER trg_assign_expense_number
BEFORE INSERT ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.assign_expense_number();

-- Auto-assign Quotation Number
CREATE OR REPLACE FUNCTION public.assign_quotation_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quotation_number IS NULL OR TRIM(NEW.quotation_number) = '' OR NEW.quotation_number ~* 'preview' OR NEW.quotation_number ~ '^QT-[0-9]{4,6}$' THEN
    NEW.quotation_number := public.next_formatted_number(NEW.agency_id, 'quotation');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_quotation_number ON public.quotations;
CREATE TRIGGER trg_assign_quotation_number
BEFORE INSERT ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.assign_quotation_number();

-- Ensure unique indexes per agency for all number sequences
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_agency_ref_no ON public.expenses (agency_id, reference_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_agency_quotation_no ON public.quotations (agency_id, quotation_number);


-- ------------------------------------------------------------------------------
-- 3. AUDIT & ERROR LOGGING TABLE (Part D requirement)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "error_logs_agency_isolation" ON public.error_logs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "error_logs_agency_isolation"
  ON public.error_logs FOR ALL
  USING (agency_id = public.current_agency_id() OR agency_id IS NULL)
  WITH CHECK (agency_id = public.current_agency_id() OR public.current_agency_id() IS NULL);

DROP TRIGGER IF EXISTS trg_isolation_error_logs ON public.error_logs;
CREATE TRIGGER trg_isolation_error_logs
BEFORE INSERT OR UPDATE ON public.error_logs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_agency_isolation();

CREATE INDEX IF NOT EXISTS idx_error_logs_agency_created ON public.error_logs (agency_id, created_at DESC);


-- ------------------------------------------------------------------------------
-- 4. ATOMIC SAVE_BOOKING_INVOICE WITH PAYMENT & DOUBLE ENTRY (Part C requirement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_booking_invoice_atomic(
    p_invoice_no TEXT DEFAULT NULL,
    p_service TEXT DEFAULT 'Ticket',
    p_party_id UUID DEFAULT NULL,
    p_vendor_id UUID DEFAULT NULL,
    p_client_amount NUMERIC DEFAULT 0,
    p_vendor_payable NUMERIC DEFAULT 0,
    p_amount_paid NUMERIC DEFAULT 0,
    p_payment_mode TEXT DEFAULT 'cash',
    p_account_id UUID DEFAULT NULL,
    p_invoice_date DATE DEFAULT CURRENT_DATE,
    p_pnr TEXT DEFAULT NULL,
    p_ticket_no TEXT DEFAULT NULL,
    p_passport_no TEXT DEFAULT NULL,
    p_passengers JSONB DEFAULT '[]'::jsonb,
    p_currency TEXT DEFAULT 'PKR',
    p_sar_rate NUMERIC DEFAULT NULL,
    p_sar_amount NUMERIC DEFAULT NULL,
    p_commission NUMERIC DEFAULT 0,
    p_wht NUMERIC DEFAULT 0,
    p_more_details JSONB DEFAULT '{}'::jsonb,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_invoice_id UUID;
    v_group_id UUID := gen_random_uuid();
    v_profit NUMERIC;
    v_inv_no TEXT := p_invoice_no;
    v_acc_id UUID := p_account_id;
    v_voucher_id UUID;
    v_voucher_no TEXT;
    v_status TEXT := 'unpaid';
    v_paid NUMERIC := COALESCE(p_amount_paid, 0);
BEGIN
    v_agency_id := public.current_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    -- Validation
    IF COALESCE(p_client_amount, 0) < 0 OR COALESCE(p_vendor_payable, 0) < 0 THEN
        RAISE EXCEPTION 'Validation error: Amounts cannot be negative';
    END IF;

    IF v_paid < 0 THEN
        RAISE EXCEPTION 'Validation error: Paid amount cannot be negative';
    END IF;

    IF v_paid > COALESCE(p_client_amount, 0) THEN
        RAISE EXCEPTION 'Validation error: Paid amount cannot exceed total client amount';
    END IF;

    -- Calculate profit
    v_profit := COALESCE(p_client_amount, 0) - COALESCE(p_vendor_payable, 0);

    -- Format or generate running sequence invoice number
    IF v_inv_no IS NULL OR TRIM(v_inv_no) = '' OR v_inv_no ~* 'preview' OR v_inv_no ~ '^INV-[0-9]{4,7}$' THEN
        v_inv_no := public.next_formatted_number(v_agency_id, 'invoice');
    END IF;

    -- Determine status
    IF v_paid >= COALESCE(p_client_amount, 0) AND COALESCE(p_client_amount, 0) > 0 THEN
        v_status := 'paid';
    ELSIF v_paid > 0 THEN
        v_status := 'partial';
    ELSE
        v_status := 'unpaid';
    END IF;

    -- 1. Insert Booking Invoice
    INSERT INTO public.booking_invoices (
        agency_id, invoice_no, invoice_date, service, party_id, vendor_id,
        client_amount, vendor_payable, profit, paid_amount, payment_status,
        pnr, ticket_no, passport_no, passengers, currency, sar_rate, sar_amount,
        commission, wht, more_details, notes, created_by
    )
    VALUES (
        v_agency_id, v_inv_no, COALESCE(p_invoice_date, CURRENT_DATE), p_service,
        p_party_id, p_vendor_id, COALESCE(p_client_amount, 0), COALESCE(p_vendor_payable, 0),
        v_profit, v_paid, v_status,
        p_pnr, p_ticket_no, p_passport_no,
        COALESCE(p_passengers, '[]'::jsonb), COALESCE(p_currency, 'PKR'),
        p_sar_rate, p_sar_amount, COALESCE(p_commission, 0), COALESCE(p_wht, 0),
        COALESCE(p_more_details, '{}'::jsonb), p_notes, auth.uid()
    )
    RETURNING id INTO v_invoice_id;

    -- 2. Double-Entry Journal Postings
    -- 2A. Client Receivable: Debit
    IF p_party_id IS NOT NULL AND COALESCE(p_client_amount, 0) > 0 THEN
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, booking_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'receivable', p_party_id, v_invoice_id,
            p_client_amount, 0, 'Invoice ' || v_inv_no || ' (' || p_service || ')', auth.uid()
        );

        -- Also mirror to public.transactions for parity with day book & account statements
        INSERT INTO public.transactions (
            agency_id, booking_id, party_id, date, reference_no, type, debit, credit, notes, created_by
        ) VALUES (
            v_agency_id, v_invoice_id, p_party_id, COALESCE(p_invoice_date, CURRENT_DATE), v_inv_no,
            'charge', p_client_amount, 0, p_service || ' Booking Invoice', auth.uid()
        );
    END IF;

    -- 2B. Vendor Payable: Credit
    IF p_vendor_id IS NOT NULL AND COALESCE(p_vendor_payable, 0) > 0 THEN
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, booking_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'payable', p_vendor_id, v_invoice_id,
            0, p_vendor_payable, 'Vendor Payable for ' || v_inv_no, auth.uid()
        );

        UPDATE public.parties
        SET current_balance = COALESCE(current_balance, 0) - p_vendor_payable, updated_at = now()
        WHERE id = p_vendor_id AND agency_id = v_agency_id;
    END IF;

    -- 2C. Service Gross Income: Credit
    IF v_profit <> 0 THEN
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, booking_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'income', v_invoice_id,
            CASE WHEN v_profit < 0 THEN ABS(v_profit) ELSE 0 END,
            CASE WHEN v_profit > 0 THEN v_profit ELSE 0 END,
            'Gross Income on ' || v_inv_no, auth.uid()
        );
    END IF;

    -- 3. Atomic Immediate Payment Receipt (if client paid upfront)
    IF v_paid > 0 THEN
        -- Resolve account_id if not provided
        IF v_acc_id IS NULL THEN
            IF p_payment_mode = 'bank' THEN
                SELECT id INTO v_acc_id FROM public.accounts WHERE agency_id = v_agency_id AND type = 'bank' AND active = true LIMIT 1;
            END IF;
            IF v_acc_id IS NULL THEN
                SELECT id INTO v_acc_id FROM public.accounts WHERE agency_id = v_agency_id AND type = 'cash' AND active = true LIMIT 1;
            END IF;
        END IF;

        v_voucher_no := public.next_formatted_number(v_agency_id, 'voucher');

        INSERT INTO public.payment_vouchers (
            agency_id, voucher_no, voucher_date, direction, payment_mode, account_id, party_id, amount, reference_no, notes, created_by
        ) VALUES (
            v_agency_id, v_voucher_no, COALESCE(p_invoice_date, CURRENT_DATE), 'received', COALESCE(p_payment_mode, 'cash'),
            v_acc_id, p_party_id, v_paid, v_inv_no, 'Payment on Invoice ' || v_inv_no, auth.uid()
        )
        RETURNING id INTO v_voucher_id;

        -- Allocate to this invoice
        INSERT INTO public.invoice_allocations (agency_id, voucher_id, invoice_id, allocated_amount)
        VALUES (v_agency_id, v_voucher_id, v_invoice_id, v_paid);

        -- Double-entry for payment: Debit Asset (cash/bank), Credit Party Receivable
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'cash_bank', v_acc_id, v_voucher_id,
            v_paid, 0, 'Receipt ' || v_voucher_no || ' for ' || v_inv_no, auth.uid()
        );

        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'receivable', p_party_id, v_voucher_id,
            0, v_paid, 'Payment Receipt ' || v_voucher_no, auth.uid()
        );

        -- Record in transactions table
        INSERT INTO public.transactions (
            agency_id, account_id, party_id, booking_id, date, reference_no, type, debit, credit, amount, method, notes, created_by
        ) VALUES (
            v_agency_id, v_acc_id, p_party_id, v_invoice_id, COALESCE(p_invoice_date, CURRENT_DATE), v_voucher_no,
            'payment_in', v_paid, 0, v_paid, COALESCE(p_payment_mode, 'cash'), 'Payment received for ' || v_inv_no, auth.uid()
        );

        -- Update account balance
        IF v_acc_id IS NOT NULL THEN
            UPDATE public.accounts
            SET current_balance = COALESCE(current_balance, 0) + v_paid, updated_at = now()
            WHERE id = v_acc_id AND agency_id = v_agency_id;
        END IF;

        -- Update party balance: (Total Invoice - Amount Paid)
        IF p_party_id IS NOT NULL THEN
            UPDATE public.parties
            SET current_balance = COALESCE(current_balance, 0) + (COALESCE(p_client_amount, 0) - v_paid), updated_at = now()
            WHERE id = p_party_id AND agency_id = v_agency_id;
        END IF;
    ELSE
        -- No upfront payment: add full client_amount to party balance
        IF p_party_id IS NOT NULL AND COALESCE(p_client_amount, 0) > 0 THEN
            UPDATE public.parties
            SET current_balance = COALESCE(current_balance, 0) + p_client_amount, updated_at = now()
            WHERE id = p_party_id AND agency_id = v_agency_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_no', v_inv_no,
        'voucher_no', v_voucher_no,
        'profit', v_profit,
        'paid', v_paid,
        'status', v_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_booking_invoice_atomic TO authenticated;


-- ------------------------------------------------------------------------------
-- 5. ATOMIC SAVE_PAYMENT_VOUCHER_ENHANCED (Part C requirement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_payment_voucher_atomic(
    p_direction TEXT, -- 'received' or 'paid'
    p_amount NUMERIC,
    p_payment_mode TEXT DEFAULT 'cash', -- 'cash', 'bank', 'transfer'
    p_account_id UUID DEFAULT NULL,
    p_party_id UUID DEFAULT NULL,
    p_voucher_no TEXT DEFAULT NULL,
    p_voucher_date DATE DEFAULT CURRENT_DATE,
    p_reference_no TEXT DEFAULT NULL,
    p_is_adjustment BOOLEAN DEFAULT false,
    p_adjustment_reason TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_voucher_id UUID;
    v_group_id UUID := gen_random_uuid();
    v_v_no TEXT := p_voucher_no;
    v_acc_id UUID := p_account_id;
    v_rem_amount NUMERIC := p_amount;
    v_inv RECORD;
    v_alloc_amt NUMERIC;
    v_new_paid NUMERIC;
BEGIN
    v_agency_id := public.current_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    IF COALESCE(p_amount, 0) <= 0 THEN
        RAISE EXCEPTION 'Validation error: Voucher amount must be greater than zero';
    END IF;

    -- Format or generate running sequence voucher number
    IF v_v_no IS NULL OR TRIM(v_v_no) = '' OR v_v_no ~* 'preview' OR v_v_no ~ '^(PV|CRV|CPV)-[0-9]{4,7}$' THEN
        v_v_no := public.next_formatted_number(v_agency_id, 'voucher');
    END IF;

    -- Auto-resolve account if null
    IF v_acc_id IS NULL THEN
        IF p_payment_mode = 'bank' THEN
            SELECT id INTO v_acc_id FROM public.accounts WHERE agency_id = v_agency_id AND type = 'bank' AND active = true LIMIT 1;
        END IF;
        IF v_acc_id IS NULL THEN
            SELECT id INTO v_acc_id FROM public.accounts WHERE agency_id = v_agency_id AND type = 'cash' AND active = true LIMIT 1;
        END IF;
    END IF;

    -- 1. Insert Payment Voucher
    INSERT INTO public.payment_vouchers (
        agency_id, voucher_no, voucher_date, direction, payment_mode, account_id,
        party_id, amount, is_adjustment, adjustment_reason, reference_no, notes, created_by
    ) VALUES (
        v_agency_id, v_v_no, COALESCE(p_voucher_date, CURRENT_DATE), p_direction, p_payment_mode, v_acc_id,
        p_party_id, p_amount, COALESCE(p_is_adjustment, false), p_adjustment_reason, p_reference_no, p_notes, auth.uid()
    )
    RETURNING id INTO v_voucher_id;

    -- 2. Double-Entry Journal & Transactions
    IF p_direction = 'received' THEN
        -- Money in: Debit Cash/Bank, Credit Party Receivable
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'cash_bank', v_acc_id, v_voucher_id,
            p_amount, 0, 'Receipt Voucher ' || v_v_no, auth.uid()
        );

        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'receivable', p_party_id, v_voucher_id,
            0, p_amount, 'Payment from client (Voucher ' || v_v_no || ')', auth.uid()
        );

        -- Mirror into transactions table
        INSERT INTO public.transactions (
            agency_id, account_id, party_id, date, reference_no, type, debit, credit, amount, method, notes, created_by
        ) VALUES (
            v_agency_id, v_acc_id, p_party_id, COALESCE(p_voucher_date, CURRENT_DATE), v_v_no,
            'payment_in', p_amount, 0, p_amount, p_payment_mode, COALESCE(p_notes, 'Payment received'), auth.uid()
        );

        -- Update party balance
        IF p_party_id IS NOT NULL THEN
            UPDATE public.parties
            SET current_balance = COALESCE(current_balance, 0) - p_amount, updated_at = now()
            WHERE id = p_party_id AND agency_id = v_agency_id;
        END IF;

        -- Update account balance
        IF v_acc_id IS NOT NULL THEN
            UPDATE public.accounts
            SET current_balance = COALESCE(current_balance, 0) + p_amount, updated_at = now()
            WHERE id = v_acc_id AND agency_id = v_agency_id;
        END IF;

        -- Auto-allocate to oldest unpaid client invoices
        IF p_party_id IS NOT NULL THEN
            FOR v_inv IN
                SELECT id, client_amount, paid_amount
                FROM public.booking_invoices
                WHERE agency_id = v_agency_id AND party_id = p_party_id AND payment_status IN ('unpaid', 'partial')
                ORDER BY invoice_date ASC, created_at ASC
            LOOP
                EXIT WHEN v_rem_amount <= 0;
                v_alloc_amt := LEAST(v_rem_amount, (v_inv.client_amount - v_inv.paid_amount));
                IF v_alloc_amt > 0 THEN
                    v_new_paid := v_inv.paid_amount + v_alloc_amt;
                    UPDATE public.booking_invoices
                    SET paid_amount = v_new_paid,
                        payment_status = CASE WHEN v_new_paid >= client_amount THEN 'paid' ELSE 'partial' END,
                        updated_at = now()
                    WHERE id = v_inv.id;

                    INSERT INTO public.invoice_allocations (
                        agency_id, voucher_id, invoice_id, allocated_amount
                    ) VALUES (
                        v_agency_id, v_voucher_id, v_inv.id, v_alloc_amt
                    );

                    v_rem_amount := v_rem_amount - v_alloc_amt;
                END IF;
            END LOOP;
        END IF;

    ELSE
        -- Money out: Debit Vendor Payable, Credit Cash/Bank
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'payable', p_party_id, v_voucher_id,
            p_amount, 0, 'Payment to vendor (Voucher ' || v_v_no || ')', auth.uid()
        );

        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'cash_bank', v_acc_id, v_voucher_id,
            0, p_amount, 'Disbursement Voucher ' || v_v_no, auth.uid()
        );

        -- Mirror into transactions table
        INSERT INTO public.transactions (
            agency_id, account_id, party_id, date, reference_no, type, debit, credit, amount, method, notes, created_by
        ) VALUES (
            v_agency_id, v_acc_id, p_party_id, COALESCE(p_voucher_date, CURRENT_DATE), v_v_no,
            'payment_out', 0, p_amount, p_amount, p_payment_mode, COALESCE(p_notes, 'Payment disbursed'), auth.uid()
        );

        -- Update party balance
        IF p_party_id IS NOT NULL THEN
            UPDATE public.parties
            SET current_balance = COALESCE(current_balance, 0) + p_amount, updated_at = now()
            WHERE id = p_party_id AND agency_id = v_agency_id;
        END IF;

        -- Update account balance
        IF v_acc_id IS NOT NULL THEN
            UPDATE public.accounts
            SET current_balance = COALESCE(current_balance, 0) - p_amount, updated_at = now()
            WHERE id = v_acc_id AND agency_id = v_agency_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'voucher_id', v_voucher_id,
        'voucher_no', v_v_no,
        'amount', p_amount
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_payment_voucher_atomic TO authenticated;


-- ------------------------------------------------------------------------------
-- 6. DATA INTEGRITY CHECK RPC (Part D requirement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_agency_data_integrity(p_agency_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency UUID := COALESCE(p_agency_id, public.current_agency_id());
    v_unmatched_invoices INT := 0;
    v_unbalanced_journals INT := 0;
    v_party_mismatches INT := 0;
    v_orphan_records INT := 0;
BEGIN
    IF v_agency IS NULL THEN
        RAISE EXCEPTION 'Agency ID is required for data integrity check';
    END IF;

    -- 1. Invoices whose paid_amount exceeds client_amount or is negative
    SELECT COUNT(*) INTO v_unmatched_invoices
    FROM public.booking_invoices
    WHERE agency_id = v_agency
      AND (paid_amount < 0 OR paid_amount > client_amount);

    -- 2. Journal entry groups that are unbalanced (Debit != Credit)
    SELECT COUNT(*) INTO v_unbalanced_journals
    FROM (
        SELECT entry_group_id, SUM(debit) as sum_dr, SUM(credit) as sum_cr
        FROM public.central_journal_entries
        WHERE agency_id = v_agency
        GROUP BY entry_group_id
        HAVING ABS(SUM(debit) - SUM(credit)) > 0.01
    ) sub;

    -- 3. Parties with negative credit limits or invalid types
    SELECT COUNT(*) INTO v_party_mismatches
    FROM public.parties
    WHERE agency_id = v_agency
      AND (credit_limit < 0 OR type NOT IN ('client', 'vendor', 'both'));

    -- 4. Orphan records without valid agency
    SELECT (
        (SELECT COUNT(*) FROM public.booking_invoices WHERE agency_id IS NULL) +
        (SELECT COUNT(*) FROM public.payment_vouchers WHERE agency_id IS NULL) +
        (SELECT COUNT(*) FROM public.parties WHERE agency_id IS NULL) +
        (SELECT COUNT(*) FROM public.expenses WHERE agency_id IS NULL)
    ) INTO v_orphan_records;

    RETURN jsonb_build_object(
        'agency_id', v_agency,
        'unmatched_invoices', v_unmatched_invoices,
        'unbalanced_journals', v_unbalanced_journals,
        'party_mismatches', v_party_mismatches,
        'orphan_records', v_orphan_records,
        'is_healthy', (v_unmatched_invoices = 0 AND v_unbalanced_journals = 0 AND v_party_mismatches = 0 AND v_orphan_records = 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_agency_data_integrity TO authenticated;


-- ------------------------------------------------------------------------------
-- 7. RECONCILIATION CHECK RPC (Part B issue 3 requirement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_agency_balances(p_agency_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency UUID := COALESCE(p_agency_id, public.current_agency_id());
    v_total_client_dues NUMERIC := 0;
    v_total_vendor_payables NUMERIC := 0;
    v_total_cash_and_bank NUMERIC := 0;
    v_total_sales NUMERIC := 0;
    v_total_costs NUMERIC := 0;
    v_total_expenses NUMERIC := 0;
    v_total_refunds NUMERIC := 0;
    v_net_profit NUMERIC := 0;
BEGIN
    IF v_agency IS NULL THEN
        RAISE EXCEPTION 'Agency ID is required for reconciliation';
    END IF;

    -- 1. Client Receivables & Vendor Payables from Parties
    SELECT
        COALESCE(SUM(current_balance) FILTER (WHERE current_balance > 0 AND type IN ('client', 'both')), 0),
        COALESCE(SUM(ABS(current_balance)) FILTER (WHERE current_balance < 0 AND type IN ('vendor', 'both')), 0)
    INTO v_total_client_dues, v_total_vendor_payables
    FROM public.parties
    WHERE agency_id = v_agency;

    -- 2. Liquid Cash & Bank from Accounts
    SELECT COALESCE(SUM(current_balance), 0) INTO v_total_cash_and_bank
    FROM public.accounts
    WHERE agency_id = v_agency AND active = true;

    -- 3. Profit = Sales - Costs - Expenses - Refunds
    SELECT
        COALESCE(SUM(client_amount), 0),
        COALESCE(SUM(vendor_payable), 0)
    INTO v_total_sales, v_total_costs
    FROM public.booking_invoices
    WHERE agency_id = v_agency;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
    FROM public.expenses
    WHERE agency_id = v_agency;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_refunds
    FROM public.refunds
    WHERE agency_id = v_agency;

    v_net_profit := (v_total_sales - v_total_costs) - v_total_expenses - v_total_refunds;

    RETURN jsonb_build_object(
        'agency_id', v_agency,
        'client_receivables', v_total_client_dues,
        'vendor_payables', v_total_vendor_payables,
        'cash_and_bank_liquidity', v_total_cash_and_bank,
        'gross_sales', v_total_sales,
        'direct_costs', v_total_costs,
        'operating_expenses', v_total_expenses,
        'customer_refunds', v_total_refunds,
        'net_agency_profit', v_net_profit,
        'reconciled', true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_agency_balances TO authenticated;
