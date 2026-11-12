-- ==============================================================================
-- TAMS PRO: DATA PERSISTENCE, MULTI-DEVICE SYNC & DOUBLE-ENTRY ACCOUNTING
-- Migration: 20261112_tams_pro_full_persistence_and_sync_fix.sql
-- 100% Additive, Idempotent, Multi-Tenant Agency Isolation & Realtime Engine
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CURRENT USER AGENCY RESOLVER (STABLE & DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  -- 1. Check profiles table for authenticated user
  SELECT agency_id INTO v_agency_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- 2. Fallback to sub_users if profiles.agency_id was null
  IF v_agency_id IS NULL THEN
    SELECT agency_id INTO v_agency_id
    FROM public.sub_users
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1;
  END IF;

  RETURN v_agency_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_agency_id();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_agency_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_agency_id() TO authenticated, anon;


-- ------------------------------------------------------------------------------
-- 2. SEQUENCE & ATOMIC NUMBER GENERATOR FOR INVOICES, VOUCHERS, EXPENSES, REFUNDS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_counters (
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    counter_type TEXT NOT NULL,
    current_val BIGINT NOT NULL DEFAULT 1000,
    prefix TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (agency_id, counter_type)
);

ALTER TABLE public.agency_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies view own counters" ON public.agency_counters;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies view own counters"
    ON public.agency_counters FOR ALL
    USING (agency_id = public.current_agency_id())
    WITH CHECK (agency_id = public.current_agency_id());

CREATE OR REPLACE FUNCTION public.next_formatted_number(
    p_agency_id UUID,
    p_counter_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_val BIGINT;
    v_pfx TEXT;
    v_year TEXT := TO_CHAR(CURRENT_DATE, 'YY');
BEGIN
    IF p_agency_id IS NULL THEN
        RAISE EXCEPTION 'Agency ID is required for sequence numbering';
    END IF;

    -- Standard prefixes
    CASE p_counter_type
        WHEN 'invoice' THEN v_pfx := 'INV-';
        WHEN 'voucher_crv' THEN v_pfx := 'CRV-';
        WHEN 'voucher_cpv' THEN v_pfx := 'CPV-';
        WHEN 'expense' THEN v_pfx := 'EXP-';
        WHEN 'refund' THEN v_pfx := 'REF-';
        WHEN 'void' THEN v_pfx := 'VOID-';
        WHEN 'party_client' THEN v_pfx := 'CLT-';
        WHEN 'party_vendor' THEN v_pfx := 'VND-';
        ELSE v_pfx := UPPER(SUBSTRING(p_counter_type FROM 1 FOR 3)) || '-';
    END CASE;

    INSERT INTO public.agency_counters (agency_id, counter_type, current_val, prefix, updated_at)
    VALUES (p_agency_id, p_counter_type, 1001, v_pfx, now())
    ON CONFLICT (agency_id, counter_type)
    DO UPDATE SET
        current_val = public.agency_counters.current_val + 1,
        updated_at = now()
    RETURNING current_val, prefix INTO v_val, v_pfx;

    RETURN v_pfx || v_year || '-' || LPAD(v_val::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_formatted_number(UUID, TEXT) TO authenticated;


-- ------------------------------------------------------------------------------
-- 3. ENSURE PARTIES TABLE & COLUMNS EXIST WITH PROPER CONSTRAINTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('client', 'vendor', 'both')),
    name TEXT NOT NULL,
    code TEXT,
    phone TEXT,
    whatsapp TEXT,
    city TEXT,
    address TEXT,
    cnic TEXT,
    ntn TEXT,
    email TEXT,
    passport TEXT,
    credit_limit NUMERIC NOT NULL DEFAULT 0,
    opening_balance NUMERIC NOT NULL DEFAULT 0,
    current_balance NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    legacy_source TEXT,
    legacy_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill party codes if missing
UPDATE public.parties
SET code = CASE WHEN type = 'client' THEN 'CLT-' ELSE 'VND-' END || SUBSTRING(id::TEXT FROM 1 FOR 6)
WHERE code IS NULL OR code = '';


-- ------------------------------------------------------------------------------
-- 4. ENSURE BOOKING INVOICES TABLE & FOREIGN KEYS EXIST
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    invoice_no TEXT NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    service TEXT NOT NULL CHECK (service IN ('Ticket', 'Umrah', 'Visa', 'Insurance', 'Hotel', 'Other')),
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    client_amount NUMERIC NOT NULL DEFAULT 0,
    vendor_payable NUMERIC NOT NULL DEFAULT 0,
    profit NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial', 'void')),
    pnr TEXT,
    ticket_no TEXT,
    passport_no TEXT,
    passengers JSONB DEFAULT '[]'::jsonb,
    currency TEXT NOT NULL DEFAULT 'PKR',
    sar_rate NUMERIC,
    sar_amount NUMERIC,
    commission NUMERIC DEFAULT 0,
    wht NUMERIC DEFAULT 0,
    more_details JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    is_void BOOLEAN NOT NULL DEFAULT false,
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT booking_invoices_agency_invoice_no UNIQUE (agency_id, invoice_no)
);


-- ------------------------------------------------------------------------------
-- 5. ENSURE PAYMENT VOUCHERS TABLE EXISTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    voucher_no TEXT NOT NULL,
    voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
    direction TEXT NOT NULL CHECK (direction IN ('received', 'paid')),
    payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'bank', 'transfer')),
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    is_adjustment BOOLEAN NOT NULL DEFAULT false,
    adjustment_reason TEXT,
    reference_no TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_vouchers_agency_voucher_no UNIQUE (agency_id, voucher_no)
);


-- ------------------------------------------------------------------------------
-- 6. ENSURE INVOICE ALLOCATIONS TABLE EXISTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    voucher_id UUID NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.booking_invoices(id) ON DELETE CASCADE,
    allocated_amount NUMERIC NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------------------------
-- 7. ENSURE CENTRAL JOURNAL ENTRIES TABLE EXISTS (Double-Entry Engine)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.central_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    entry_group_id UUID NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_type TEXT NOT NULL CHECK (account_type IN ('cash_bank', 'receivable', 'payable', 'revenue', 'expense', 'equity', 'liability')),
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.booking_invoices(id) ON DELETE SET NULL,
    voucher_id UUID REFERENCES public.payment_vouchers(id) ON DELETE SET NULL,
    debit NUMERIC NOT NULL DEFAULT 0,
    credit NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------------------------
-- 8. ATOMIC SAVE_BOOKING_INVOICE WITH DOUBLE-ENTRY JOURNAL & ALLOCATION
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
    v_party_name TEXT := 'Client';
    v_vendor_name TEXT := 'Vendor';
    v_status TEXT := 'unpaid';
BEGIN
    v_agency_id := public.current_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    -- Auto-generate atomic invoice number if missing or default
    IF v_inv_no IS NULL OR TRIM(v_inv_no) = '' OR v_inv_no LIKE 'INV-100%' THEN
        v_inv_no := public.next_formatted_number(v_agency_id, 'invoice');
    END IF;

    v_profit := COALESCE(p_client_amount, 0) - COALESCE(p_vendor_payable, 0);

    IF COALESCE(p_amount_paid, 0) >= COALESCE(p_client_amount, 0) AND COALESCE(p_client_amount, 0) > 0 THEN
        v_status := 'paid';
    ELSIF COALESCE(p_amount_paid, 0) > 0 THEN
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
        v_profit, COALESCE(p_amount_paid, 0), v_status,
        p_pnr, p_ticket_no, p_passport_no,
        COALESCE(p_passengers, '[]'::jsonb), COALESCE(p_currency, 'PKR'),
        p_sar_rate, p_sar_amount, COALESCE(p_commission, 0), COALESCE(p_wht, 0),
        COALESCE(p_more_details, '{}'::jsonb), p_notes, auth.uid()
    )
    RETURNING id INTO v_invoice_id;

    -- Retrieve party name if present
    IF p_party_id IS NOT NULL THEN
        SELECT name INTO v_party_name FROM public.parties WHERE id = p_party_id;
    END IF;

    -- 2. Double-Entry: Client Invoice
    -- Debit: Accounts Receivable (Client owes total client_amount)
    -- Credit: Service Revenue (Income earned)
    IF COALESCE(p_client_amount, 0) > 0 THEN
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, invoice_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'receivable', p_party_id, v_invoice_id,
            p_client_amount, 0, 'Booking Invoice ' || v_inv_no || ' (' || COALESCE(v_party_name, 'Client') || ')', auth.uid()
        );

        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, invoice_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'revenue', v_invoice_id,
            0, p_client_amount, 'Sales Revenue: ' || p_service || ' (' || v_inv_no || ')', auth.uid()
        );

        -- Update party current_balance (receivables are positive)
        IF p_party_id IS NOT NULL THEN
            UPDATE public.parties
            SET current_balance = COALESCE(current_balance, 0) + p_client_amount,
                updated_at = now()
            WHERE id = p_party_id AND agency_id = v_agency_id;
        END IF;
    END IF;

    -- 3. Double-Entry: Vendor Payable & Cost of Service
    -- Debit: Cost of Sales / Expense
    -- Credit: Accounts Payable (Owed to vendor)
    IF COALESCE(p_vendor_payable, 0) > 0 AND p_vendor_id IS NOT NULL THEN
        SELECT name INTO v_vendor_name FROM public.parties WHERE id = p_vendor_id;

        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, invoice_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'expense', v_invoice_id,
            p_vendor_payable, 0, 'Cost of Service: ' || p_service || ' (' || v_inv_no || ')', auth.uid()
        );

        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, invoice_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'payable', p_vendor_id, v_invoice_id,
            0, p_vendor_payable, 'Vendor Payable: ' || v_inv_no || ' (' || COALESCE(v_vendor_name, 'Vendor') || ')', auth.uid()
        );

        -- Update vendor balance (payables are negative in parties.current_balance)
        UPDATE public.parties
        SET current_balance = COALESCE(current_balance, 0) - p_vendor_payable,
            updated_at = now()
        WHERE id = p_vendor_id AND agency_id = v_agency_id;
    END IF;

    -- 4. Initial Payment Recording (if client paid upfront at booking)
    IF COALESCE(p_amount_paid, 0) > 0 THEN
        DECLARE
            v_v_no TEXT := public.next_formatted_number(v_agency_id, 'voucher_crv');
            v_pmt_group UUID := gen_random_uuid();
        BEGIN
            INSERT INTO public.payment_vouchers (
                agency_id, voucher_no, voucher_date, direction, payment_mode, account_id,
                party_id, amount, is_adjustment, adjustment_reason, reference_no, notes, created_by
            ) VALUES (
                v_agency_id, v_v_no, COALESCE(p_invoice_date, CURRENT_DATE), 'received', COALESCE(p_payment_mode, 'cash'), v_acc_id,
                p_party_id, p_amount_paid, false, NULL, 'AT-BOOKING-' || v_inv_no, 'Initial payment at booking for ' || v_inv_no, auth.uid()
            )
            RETURNING id INTO v_voucher_id;

            -- Double entry for payment received
            -- Debit: Cash/Bank
            -- Credit: Accounts Receivable
            INSERT INTO public.central_journal_entries (
                agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id, debit, credit, description, created_by
            ) VALUES (
                v_agency_id, v_pmt_group, COALESCE(p_invoice_date, CURRENT_DATE), 'cash_bank', v_acc_id, v_voucher_id,
                p_amount_paid, 0, 'Receipt: Initial payment for ' || v_inv_no || ' (' || v_v_no || ')', auth.uid()
            );

            INSERT INTO public.central_journal_entries (
                agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id, debit, credit, description, created_by
            ) VALUES (
                v_agency_id, v_pmt_group, COALESCE(p_invoice_date, CURRENT_DATE), 'receivable', p_party_id, v_voucher_id,
                0, p_amount_paid, 'Payment reduction for ' || v_inv_no, auth.uid()
            );

            -- Allocate payment to this invoice
            INSERT INTO public.invoice_allocations (
                agency_id, voucher_id, invoice_id, allocated_amount
            ) VALUES (
                v_agency_id, v_voucher_id, v_invoice_id, p_amount_paid
            );

            -- Deduct paid amount from party dues
            IF p_party_id IS NOT NULL THEN
                UPDATE public.parties
                SET current_balance = COALESCE(current_balance, 0) - p_amount_paid,
                    updated_at = now()
                WHERE id = p_party_id AND agency_id = v_agency_id;
            END IF;
        END;
    END IF;

    -- Backward compatibility: mirror into clients table
    BEGIN
        INSERT INTO public.clients (
            agency_id, name, contact_number, travel_type, selling_price, purchasing_price,
            amount_paid, payment_status, pnr, passport_number, flight_date
        ) VALUES (
            v_agency_id, COALESCE(v_party_name, 'Client'), p_passengers->0->>'phone',
            p_service, COALESCE(p_client_amount, 0), COALESCE(p_vendor_payable, 0),
            COALESCE(p_amount_paid, 0), v_status, p_pnr, p_passport_no,
            COALESCE(p_invoice_date, CURRENT_DATE)
        );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_no', v_inv_no,
        'profit', v_profit,
        'payment_status', v_status
    );
END;
$$;

-- Alias save_booking_invoice to save_booking_invoice_atomic
CREATE OR REPLACE FUNCTION public.save_booking_invoice(
    p_invoice_no TEXT DEFAULT NULL,
    p_service TEXT DEFAULT 'Ticket',
    p_party_id UUID DEFAULT NULL,
    p_vendor_id UUID DEFAULT NULL,
    p_client_amount NUMERIC DEFAULT 0,
    p_vendor_payable NUMERIC DEFAULT 0,
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
BEGIN
    RETURN public.save_booking_invoice_atomic(
        p_invoice_no => p_invoice_no,
        p_service => p_service,
        p_party_id => p_party_id,
        p_vendor_id => p_vendor_id,
        p_client_amount => p_client_amount,
        p_vendor_payable => p_vendor_payable,
        p_amount_paid => 0,
        p_payment_mode => 'cash',
        p_account_id => NULL,
        p_invoice_date => p_invoice_date,
        p_pnr => p_pnr,
        p_ticket_no => p_ticket_no,
        p_passport_no => p_passport_no,
        p_passengers => p_passengers,
        p_currency => p_currency,
        p_sar_rate => p_sar_rate,
        p_sar_amount => p_sar_amount,
        p_commission => p_commission,
        p_wht => p_wht,
        p_more_details => p_more_details,
        p_notes => p_notes
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_booking_invoice_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_booking_invoice TO authenticated;


-- ------------------------------------------------------------------------------
-- 9. ATOMIC SAVE_PAYMENT_VOUCHER WITH DOUBLE-ENTRY JOURNAL & ALLOCATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_payment_voucher_atomic(
    p_direction TEXT, -- 'received' or 'paid'
    p_amount NUMERIC,
    p_payment_mode TEXT DEFAULT 'cash', -- 'cash', 'bank'
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
    v_party_name TEXT := 'Party';
BEGIN
    v_agency_id := public.current_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Voucher amount must be greater than zero';
    END IF;

    -- Auto-generate atomic voucher number if missing or default
    IF v_v_no IS NULL OR TRIM(v_v_no) = '' OR v_v_no LIKE '%-200%' THEN
        v_v_no := public.next_formatted_number(
            v_agency_id,
            CASE WHEN p_direction = 'received' THEN 'voucher_crv' ELSE 'voucher_cpv' END
        );
    END IF;

    -- Insert payment voucher
    INSERT INTO public.payment_vouchers (
        agency_id, voucher_no, voucher_date, direction, payment_mode, account_id,
        party_id, amount, is_adjustment, adjustment_reason, reference_no, notes, created_by
    ) VALUES (
        v_agency_id, v_v_no, COALESCE(p_voucher_date, CURRENT_DATE), p_direction, COALESCE(p_payment_mode, 'cash'), v_acc_id,
        p_party_id, p_amount, COALESCE(p_is_adjustment, false), p_adjustment_reason, p_reference_no, p_notes, auth.uid()
    )
    RETURNING id INTO v_voucher_id;

    IF p_party_id IS NOT NULL THEN
        SELECT name INTO v_party_name FROM public.parties WHERE id = p_party_id;
    END IF;

    -- Double-Entry Journal
    IF p_direction = 'received' THEN
        -- Money received: Debit Cash/Bank, Credit Accounts Receivable
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'cash_bank', v_acc_id, v_voucher_id,
            p_amount, 0, 'Receipt Voucher ' || v_v_no || ' (' || COALESCE(v_party_name, 'Party') || ')', auth.uid()
        );

        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'receivable', p_party_id, v_voucher_id,
            0, p_amount, 'Payment from ' || COALESCE(v_party_name, 'Party') || ' (' || v_v_no || ')', auth.uid()
        );

        -- Update party current_balance (receivable drops by p_amount)
        IF p_party_id IS NOT NULL THEN
            UPDATE public.parties
            SET current_balance = COALESCE(current_balance, 0) - p_amount,
                updated_at = now()
            WHERE id = p_party_id AND agency_id = v_agency_id;
        END IF;

        -- Auto-allocate to oldest unpaid booking invoices
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
        -- Money paid: Debit Accounts Payable, Credit Cash/Bank
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'payable', p_party_id, v_voucher_id,
            p_amount, 0, 'Payment to ' || COALESCE(v_party_name, 'Vendor') || ' (' || v_v_no || ')', auth.uid()
        );

        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'cash_bank', v_acc_id, v_voucher_id,
            0, p_amount, 'Payment Voucher ' || v_v_no, auth.uid()
        );

        -- Update vendor balance (payable drops, balance moves toward positive)
        IF p_party_id IS NOT NULL THEN
            UPDATE public.parties
            SET current_balance = COALESCE(current_balance, 0) + p_amount,
                updated_at = now()
            WHERE id = p_party_id AND agency_id = v_agency_id;
        END IF;
    END IF;

    -- Mirror into transactions table
    BEGIN
        INSERT INTO public.transactions (
            agency_id, date, type, party_id, account_id,
            debit, credit, method, reference_no, notes, created_by
        ) VALUES (
            v_agency_id, COALESCE(p_voucher_date, CURRENT_DATE),
            CASE WHEN p_direction = 'received' THEN 'payment_in' ELSE 'payment_out' END,
            p_party_id, v_acc_id,
            CASE WHEN p_direction = 'received' THEN p_amount ELSE 0 END,
            CASE WHEN p_direction = 'paid' THEN p_amount ELSE 0 END,
            COALESCE(p_payment_mode, 'cash'), v_v_no, p_notes, auth.uid()
        );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'voucher_id', v_voucher_id,
        'voucher_no', v_v_no,
        'amount', p_amount,
        'direction', p_direction
    );
END;
$$;

-- Alias save_payment_voucher to save_payment_voucher_atomic
CREATE OR REPLACE FUNCTION public.save_payment_voucher(
    p_direction TEXT,
    p_amount NUMERIC,
    p_payment_mode TEXT DEFAULT 'cash',
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
BEGIN
    RETURN public.save_payment_voucher_atomic(
        p_direction => p_direction,
        p_amount => p_amount,
        p_payment_mode => p_payment_mode,
        p_account_id => p_account_id,
        p_party_id => p_party_id,
        p_voucher_no => p_voucher_no,
        p_voucher_date => p_voucher_date,
        p_reference_no => p_reference_no,
        p_is_adjustment => p_is_adjustment,
        p_adjustment_reason => p_adjustment_reason,
        p_notes => p_notes
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_payment_voucher_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_payment_voucher TO authenticated;


-- ------------------------------------------------------------------------------
-- 10. ATOMIC REFUND & EXPENSE POSTING WITH DOUBLE-ENTRY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    client_id UUID,
    booking_id UUID,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    refund_no TEXT,
    refund_date DATE NOT NULL DEFAULT CURRENT_DATE,
    refund_amount NUMERIC NOT NULL DEFAULT 0,
    payment_mode TEXT NOT NULL DEFAULT 'cash',
    reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.record_refund(
    p_amount NUMERIC,
    p_account_id UUID DEFAULT NULL,
    p_party_id UUID DEFAULT NULL,
    p_party_type TEXT DEFAULT 'client',
    p_booking_id UUID DEFAULT NULL,
    p_date DATE DEFAULT CURRENT_DATE,
    p_method TEXT DEFAULT 'cash',
    p_reference_no TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_tx_id UUID;
    v_ref_id UUID;
    v_group_id UUID := gen_random_uuid();
    v_ref_no TEXT := p_reference_no;
BEGIN
    v_agency_id := public.current_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    IF v_ref_no IS NULL OR TRIM(v_ref_no) = '' THEN
        v_ref_no := public.next_formatted_number(v_agency_id, 'refund');
    END IF;

    -- Insert into refunds table
    INSERT INTO public.refunds (
        agency_id, client_id, booking_id, party_id, refund_no,
        refund_date, refund_amount, payment_mode, reason, notes, created_by
    ) VALUES (
        v_agency_id, p_party_id, p_booking_id, p_party_id, v_ref_no,
        COALESCE(p_date, CURRENT_DATE), p_amount, COALESCE(p_method, 'cash'), p_reason, p_notes, auth.uid()
    )
    RETURNING id INTO v_ref_id;

    -- Double entry:
    -- Debit: Revenue Reduction / Refund Expense
    -- Credit: Cash / Bank
    INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id, debit, credit, description, created_by
    ) VALUES (
        v_agency_id, v_group_id, COALESCE(p_date, CURRENT_DATE), 'revenue', p_party_id,
        p_amount, 0, 'Customer Refund: ' || v_ref_no || COALESCE(' (' || p_reason || ')', ''), auth.uid()
    );

    INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, account_id, debit, credit, description, created_by
    ) VALUES (
        v_agency_id, v_group_id, COALESCE(p_date, CURRENT_DATE), 'cash_bank', p_account_id,
        0, p_amount, 'Refund Paid Out (' || v_ref_no || ')', auth.uid()
    );

    -- Mirror into transactions
    INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, account_id,
        debit, credit, method, reference_no, category, notes, created_by
    ) VALUES (
        v_agency_id, COALESCE(p_date, CURRENT_DATE), 'refund', p_party_id, p_party_type, p_booking_id, p_account_id,
        0, p_amount, COALESCE(p_method, 'cash'), v_ref_no, 'Refund', COALESCE(p_notes, p_reason), auth.uid()
    )
    RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object('success', true, 'refund_id', v_ref_id, 'refund_no', v_ref_no);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_refund TO authenticated;

-- Record Expense RPC
CREATE OR REPLACE FUNCTION public.record_expense(
    p_amount NUMERIC,
    p_account_id UUID DEFAULT NULL,
    p_category TEXT DEFAULT 'General Expense',
    p_date DATE DEFAULT CURRENT_DATE,
    p_method TEXT DEFAULT 'cash',
    p_reference_no TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_party_id UUID DEFAULT NULL,
    p_party_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_tx_id UUID;
    v_exp_id UUID;
    v_group_id UUID := gen_random_uuid();
    v_ref_no TEXT := p_reference_no;
BEGIN
    v_agency_id := public.current_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero';
    END IF;

    IF v_ref_no IS NULL OR TRIM(v_ref_no) = '' THEN
        v_ref_no := public.next_formatted_number(v_agency_id, 'expense');
    END IF;

    -- Insert into expenses
    INSERT INTO public.expenses (
        agency_id, expense_date, expense_type, amount, notes, payment_mode, reference_number
    ) VALUES (
        v_agency_id, COALESCE(p_date, CURRENT_DATE), COALESCE(p_category, 'General Expense'), p_amount, p_notes, COALESCE(p_method, 'cash'), v_ref_no
    )
    RETURNING id INTO v_exp_id;

    -- Double entry:
    -- Debit: Operating Expense
    -- Credit: Cash/Bank
    INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, debit, credit, description, created_by
    ) VALUES (
        v_agency_id, v_group_id, COALESCE(p_date, CURRENT_DATE), 'expense',
        p_amount, 0, 'Operating Expense: ' || COALESCE(p_category, 'Expense') || ' (' || v_ref_no || ')', auth.uid()
    );

    INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, account_id, debit, credit, description, created_by
    ) VALUES (
        v_agency_id, v_group_id, COALESCE(p_date, CURRENT_DATE), 'cash_bank', p_account_id,
        0, p_amount, 'Expense Paid (' || v_ref_no || ')', auth.uid()
    );

    -- Mirror into transactions
    INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, account_id,
        debit, credit, method, reference_no, category, notes, created_by
    ) VALUES (
        v_agency_id, COALESCE(p_date, CURRENT_DATE), 'expense', p_party_id, p_party_type, p_account_id,
        0, p_amount, COALESCE(p_method, 'cash'), v_ref_no, COALESCE(p_category, 'General Expense'), p_notes, auth.uid()
    )
    RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object('success', true, 'expense_id', v_exp_id, 'reference_no', v_ref_no);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_expense TO authenticated;


-- ------------------------------------------------------------------------------
-- 11. STRICT RLS POLICIES FOR ALL CORE TABLES (One agency never sees another)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  tbls TEXT[] := ARRAY[
    'booking_invoices', 'payment_vouchers', 'refunds', 'expenses', 'parties',
    'clients', 'vendors', 'central_journal_entries', 'transactions', 'accounts',
    'invoice_allocations', 'agency_banks', 'queries', 'quotations', 'reminders'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

      -- Drop existing policies
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_agency_isolation', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Agencies manage their own ' || t, t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Users can view ' || t || ' in their agency', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Users can insert ' || t || ' in their agency', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Users can update ' || t || ' in their agency', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Users can delete ' || t || ' in their agency', t);

      -- Create strict unified isolation policy
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (agency_id = public.current_agency_id()) WITH CHECK (agency_id = public.current_agency_id());',
        t || '_agency_isolation',
        t
      );

      -- Set replica identity to full so Realtime events convey full payload to other devices
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
    END IF;
  END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 12. SUPABASE REALTIME PUBLICATION SUBSCRIPTION ENABLER
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  tbls TEXT[] := ARRAY[
    'booking_invoices', 'payment_vouchers', 'refunds', 'expenses', 'parties',
    'clients', 'vendors', 'transactions', 'agency_banks'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
      EXCEPTION WHEN duplicate_object THEN
        -- already added to publication
        NULL;
      WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- TAMS PRO: MASTER ADMIN & REGISTERED USERS DIRECTORY SYNC SCRIPT
-- Project: mwpbschzwjxeioyrzskv (https://mwpbschzwjxeioyrzskv.supabase.co)
-- Date: 2026-11-12
--
-- Instructions:
-- Paste this complete SQL script into Supabase Dashboard -> SQL Editor and click "Run".
-- URL: https://supabase.com/dashboard/project/mwpbschzwjxeioyrzskv/sql
-- ============================================================================

-- 0. Relax check constraints on public.agencies to support 'lifetime' plans & statuses
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_subscription_plan_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_subscription_plan_check 
  CHECK (subscription_plan IN ('free', 'monthly', 'yearly', 'lifetime'));

ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_license_status_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_license_status_check 
  CHECK (license_status IN ('active', 'expired', 'trial', 'lifetime'));

-- 1. Helper function: Check if caller is Master Admin (usmn4u@gmail.com)
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_jwt_email TEXT;
  v_db_email TEXT;
  v_is_super BOOLEAN;
BEGIN
  IF current_user = 'postgres' OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN true;
  END IF;

  -- Check JWT claim directly (fastest, available synchronously)
  v_jwt_email := LOWER(COALESCE(auth.jwt()->>'email', ''));
  IF v_jwt_email = 'usmn4u@gmail.com' THEN
    RETURN true;
  END IF;

  IF _user_id IS NULL THEN
    _user_id := auth.uid();
  END IF;

  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check auth.users table
  SELECT LOWER(email) INTO v_db_email
  FROM auth.users
  WHERE id = _user_id;

  IF v_db_email = 'usmn4u@gmail.com' THEN
    RETURN true;
  END IF;

  -- Check profiles is_super_admin flag
  SELECT is_super_admin INTO v_is_super
  FROM public.profiles
  WHERE id = _user_id;

  RETURN COALESCE(v_is_super, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_master_admin(UUID) TO authenticated, anon;


-- 2. Add email and is_super_admin columns to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;


-- 3. Backfill profiles.email from auth.users for all existing users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');


-- 4. Ensure master admin usmn4u@gmail.com is configured with Lifetime Access
DO $$
DECLARE
  v_admin_user_id UUID;
  v_admin_agency_id UUID;
BEGIN
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE LOWER(email) = 'usmn4u@gmail.com'
  LIMIT 1;

  IF v_admin_user_id IS NOT NULL THEN
    SELECT agency_id INTO v_admin_agency_id
    FROM public.profiles
    WHERE id = v_admin_user_id;

    IF v_admin_agency_id IS NULL THEN
      INSERT INTO public.agencies (
        name, license_key, subscription_plan,
        license_expiry, license_status, license_active
      )
      VALUES (
        'Master Admin HQ',
        'LIFETIME-MASTER-KEY',
        'lifetime',
        '2099-12-31 23:59:59+00'::TIMESTAMPTZ,
        'active',
        true
      )
      RETURNING id INTO v_admin_agency_id;

      INSERT INTO public.profiles (id, agency_id, full_name, email, is_super_admin)
      VALUES (v_admin_user_id, v_admin_agency_id, 'Master Administrator', 'usmn4u@gmail.com', true)
      ON CONFLICT (id) DO UPDATE
      SET agency_id = v_admin_agency_id,
          email = 'usmn4u@gmail.com',
          is_super_admin = true;
    ELSE
      UPDATE public.agencies
      SET subscription_plan = 'lifetime',
          license_status = 'active',
          license_active = true,
          license_expiry = '2099-12-31 23:59:59+00'::TIMESTAMPTZ
      WHERE id = v_admin_agency_id;

      UPDATE public.profiles
      SET is_super_admin = true,
          email = 'usmn4u@gmail.com'
      WHERE id = v_admin_user_id;
    END IF;

    -- Ensure admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;


-- 5. Update RLS policies on profiles & agencies so Master Admin can view and manage all users
DROP POLICY IF EXISTS "Master admin can view all profiles" ON public.profiles;
CREATE POLICY "Master admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admin can update all profiles" ON public.profiles;
CREATE POLICY "Master admin can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_master_admin(auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admin can view all agencies" ON public.agencies;
CREATE POLICY "Master admin can view all agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admin can update all agencies" ON public.agencies;
CREATE POLICY "Master admin can update all agencies"
ON public.agencies
FOR UPDATE
TO authenticated
USING (public.is_master_admin(auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()));


-- 6. Direct SECURITY DEFINER function to list ALL registered users (queries auth.users directly)
CREATE OR REPLACE FUNCTION public.admin_get_registered_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_jwt_email TEXT := LOWER(COALESCE(auth.jwt()->>'email', ''));
  v_result JSONB;
BEGIN
  IF current_user != 'postgres' 
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
     AND v_jwt_email != 'usmn4u@gmail.com' 
     AND NOT public.is_master_admin(v_caller_id) THEN
    RAISE EXCEPTION '403 Forbidden: Master Admin privilege required';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'email', COALESCE(u.email, 'No Email'),
      'full_name', COALESCE(NULLIF(p.full_name, ''), NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
      'role', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' OR p.is_super_admin = true THEN 'admin'
        WHEN r.role IS NOT NULL THEN r.role::text
        ELSE 'user'
      END,
      'agency_id', COALESCE(p.agency_id::text, a.id::text, ''),
      'agency_name', COALESCE(a.name, u.raw_user_meta_data->>'agency_name', 'Primary Agency'),
      'subscription_plan', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' THEN 'lifetime'
        ELSE COALESCE(a.subscription_plan, u.raw_user_meta_data->>'subscription_plan', 'free')
      END,
      'license_expiry', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' THEN '2099-12-31T23:59:59.000Z'
        WHEN a.license_expiry IS NOT NULL THEN a.license_expiry::text
        ELSE (u.created_at + INTERVAL '14 days')::text
      END,
      'license_status', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' THEN 'active'
        WHEN a.license_status IS NOT NULL THEN a.license_status
        ELSE 'active'
      END,
      'created_at', u.created_at::text,
      'email_confirmed_at', u.email_confirmed_at::text,
      'last_sign_in_at', u.last_sign_in_at::text,
      'active_sessions', 1
    ) ORDER BY u.created_at DESC
  )
  INTO v_result
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.agencies a ON a.id = p.agency_id
  LEFT JOIN (
    SELECT DISTINCT ON (user_id) user_id, role
    FROM public.user_roles
    ORDER BY user_id, role ASC
  ) r ON r.user_id = u.id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_registered_users() TO authenticated, anon;


-- 7. Direct RPC for Master Admin to update agency subscriptions
CREATE OR REPLACE FUNCTION public.admin_set_agency_subscription(
  p_agency_id UUID,
  p_plan TEXT,
  p_duration_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_new_expiry TIMESTAMPTZ;
  v_plan_clean TEXT := LOWER(TRIM(p_plan));
BEGIN
  IF current_user != 'postgres' 
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
     AND LOWER(COALESCE(auth.jwt()->>'email', '')) != 'usmn4u@gmail.com' 
     AND NOT public.is_master_admin(v_caller_id) THEN
    RAISE EXCEPTION '403 Forbidden: Master Admin privilege required';
  END IF;

  IF v_plan_clean = 'lifetime' THEN
    v_new_expiry := '2099-12-31 23:59:59+00'::TIMESTAMPTZ;
  ELSE
    v_new_expiry := NOW() + (COALESCE(p_duration_days, 30) || ' days')::INTERVAL;
  END IF;

  UPDATE public.agencies
  SET subscription_plan = v_plan_clean,
      license_status = 'active',
      license_active = true,
      license_expiry = v_new_expiry
  WHERE id = p_agency_id;

  RETURN jsonb_build_object(
    'success', true,
    'agency_id', p_agency_id,
    'plan', v_plan_clean,
    'license_expiry', v_new_expiry
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_agency_subscription(UUID, TEXT, INT) TO authenticated, anon;
