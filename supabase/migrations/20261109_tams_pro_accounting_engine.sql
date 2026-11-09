-- ==============================================================================
-- TAMS PRO — SAFE ADDITIVE MIGRATION: ACCOUNTING ENGINE & PARTIES
-- Migration: 20261109_tams_pro_accounting_engine.sql
-- 100% Self-Contained, Idempotent, and Non-destructive: keeps all existing data.
-- ==============================================================================

-- 0A. MULTI-TENANT ISOLATION HELPER (safe fallback if not already created)
CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- 0B. ACCOUNTS TABLE (Cash & Bank Accounts)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank')),
    name TEXT NOT NULL,
    opening_balance NUMERIC NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT accounts_agency_name_unique UNIQUE (agency_id, name)
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies manage their own accounts" ON public.accounts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies manage their own accounts"
    ON public.accounts FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());

CREATE INDEX IF NOT EXISTS idx_accounts_agency_active ON public.accounts (agency_id, active);
CREATE INDEX IF NOT EXISTS idx_accounts_agency_type ON public.accounts (agency_id, type);

-- 1. UNIFIED PARTIES TABLE (Clients, Vendors, Both)
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
    current_balance NUMERIC NOT NULL DEFAULT 0, -- Net balance: positive = receivable, negative = payable
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    legacy_source TEXT, -- 'clients', 'vendors', 'b2b_agents'
    legacy_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT parties_agency_name_unique UNIQUE (agency_id, name, type)
);

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies manage their own parties" ON public.parties;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies manage their own parties"
    ON public.parties FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());

CREATE INDEX IF NOT EXISTS idx_parties_agency_type ON public.parties (agency_id, type, active);
CREATE INDEX IF NOT EXISTS idx_parties_agency_name ON public.parties (agency_id, name);
CREATE INDEX IF NOT EXISTS idx_parties_agency_code ON public.parties (agency_id, code);

-- 2. BOOKING INVOICES TABLE (Ticket, Umrah, Visa, Insurance, Hotel, Other)
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
    profit NUMERIC NOT NULL DEFAULT 0, -- Stored on each booking: client_amount - vendor_payable
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

ALTER TABLE public.booking_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies manage their own booking invoices" ON public.booking_invoices;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies manage their own booking invoices"
    ON public.booking_invoices FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());

CREATE INDEX IF NOT EXISTS idx_booking_invoices_agency_date ON public.booking_invoices (agency_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_booking_invoices_party ON public.booking_invoices (agency_id, party_id);
CREATE INDEX IF NOT EXISTS idx_booking_invoices_vendor ON public.booking_invoices (agency_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_booking_invoices_pnr ON public.booking_invoices (agency_id, pnr);
CREATE INDEX IF NOT EXISTS idx_booking_invoices_ticket ON public.booking_invoices (agency_id, ticket_no);

-- 3. PAYMENT VOUCHERS & ALLOCATIONS
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    voucher_no TEXT NOT NULL,
    voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
    direction TEXT NOT NULL CHECK (direction IN ('received', 'paid')),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'bank', 'transfer')),
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    is_adjustment BOOLEAN NOT NULL DEFAULT false,
    adjustment_reason TEXT,
    reference_no TEXT,
    notes TEXT,
    is_void BOOLEAN NOT NULL DEFAULT false,
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vouchers_agency_no_unique UNIQUE (agency_id, voucher_no)
);

ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies manage their own vouchers" ON public.payment_vouchers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies manage their own vouchers"
    ON public.payment_vouchers FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());

-- 4. INVOICE PAYMENT ALLOCATIONS (invoice-wise matching)
CREATE TABLE IF NOT EXISTS public.invoice_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    voucher_id UUID NOT NULL REFERENCES public.payment_vouchers(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.booking_invoices(id) ON DELETE CASCADE,
    allocated_amount NUMERIC NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_allocations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies manage their own allocations" ON public.invoice_allocations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies manage their own allocations"
    ON public.invoice_allocations FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());

-- 5. REFUNDS AND VOIDS TABLE
CREATE TABLE IF NOT EXISTS public.refund_void_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    record_no TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('refund', 'void')),
    invoice_id UUID REFERENCES public.booking_invoices(id) ON DELETE CASCADE,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    client_refund_amount NUMERIC NOT NULL DEFAULT 0,
    vendor_refund_amount NUMERIC NOT NULL DEFAULT 0,
    pending_vendor_refund BOOLEAN NOT NULL DEFAULT false,
    pending_client_refund BOOLEAN NOT NULL DEFAULT false,
    reason TEXT NOT NULL,
    payment_mode TEXT DEFAULT 'cash',
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.refund_void_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies manage their own refunds" ON public.refund_void_records;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies manage their own refunds"
    ON public.refund_void_records FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());

-- 6. DOUBLE-ENTRY CENTRAL JOURNAL (Debit must equal Credit)
CREATE TABLE IF NOT EXISTS public.central_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    entry_group_id UUID NOT NULL, -- All debits and credits in a group must balance
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_type TEXT NOT NULL CHECK (account_type IN ('cash_bank', 'receivable', 'payable', 'income', 'expense', 'equity')),
    account_id UUID, -- For cash/bank or party account
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.booking_invoices(id) ON DELETE SET NULL,
    voucher_id UUID REFERENCES public.payment_vouchers(id) ON DELETE SET NULL,
    debit NUMERIC NOT NULL DEFAULT 0,
    credit NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.central_journal_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies manage their own journal entries" ON public.central_journal_entries;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies manage their own journal entries"
    ON public.central_journal_entries FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());

CREATE INDEX IF NOT EXISTS idx_central_journal_group ON public.central_journal_entries (agency_id, entry_group_id);
CREATE INDEX IF NOT EXISTS idx_central_journal_date ON public.central_journal_entries (agency_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_central_journal_party ON public.central_journal_entries (agency_id, party_id);

-- ==============================================================================
-- 7. ATOMIC DOUBLE-ENTRY RPCs
-- ==============================================================================

-- 7A. SAVE BOOKING INVOICE
CREATE OR REPLACE FUNCTION public.save_booking_invoice(
    p_invoice_no TEXT,
    p_service TEXT,
    p_party_id UUID,
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
DECLARE
    v_agency_id UUID;
    v_invoice_id UUID;
    v_group_id UUID := gen_random_uuid();
    v_profit NUMERIC;
    v_inv_no TEXT := p_invoice_no;
    v_seq INT;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    -- Calculate profit
    v_profit := COALESCE(p_client_amount, 0) - COALESCE(p_vendor_payable, 0);

    -- Auto-generate invoice number if not provided
    IF v_inv_no IS NULL OR TRIM(v_inv_no) = '' THEN
        SELECT COALESCE(MAX(SUBSTRING(invoice_no FROM '[0-9]+')::INT), 1000) + 1 INTO v_seq
        FROM public.booking_invoices
        WHERE agency_id = v_agency_id;
        v_inv_no := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_seq::TEXT, 4, '0');
    END IF;

    -- Insert Booking Invoice
    INSERT INTO public.booking_invoices (
        agency_id, invoice_no, invoice_date, service, party_id, vendor_id,
        client_amount, vendor_payable, profit, paid_amount, payment_status,
        pnr, ticket_no, passport_no, passengers, currency, sar_rate, sar_amount,
        commission, wht, more_details, notes, created_by
    ) VALUES (
        v_agency_id, v_inv_no, COALESCE(p_invoice_date, CURRENT_DATE), p_service, p_party_id, p_vendor_id,
        COALESCE(p_client_amount, 0), COALESCE(p_vendor_payable, 0), v_profit, 0, 'unpaid',
        p_pnr, p_ticket_no, p_passport_no, p_passengers, COALESCE(p_currency, 'PKR'), p_sar_rate, p_sar_amount,
        COALESCE(p_commission, 0), COALESCE(p_wht, 0), p_more_details, p_notes, auth.uid()
    )
    RETURNING id INTO v_invoice_id;

    -- Double-Entry Journal Entries (Debit = Credit)
    -- 1. Debit: Party Accounts Receivable
    IF COALESCE(p_client_amount, 0) > 0 THEN
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, booking_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'receivable', p_party_id, v_invoice_id,
            p_client_amount, 0, 'Booking Invoice ' || v_inv_no || ' (' || p_service || ')', auth.uid()
        );

        -- Update party current balance
        UPDATE public.parties
        SET current_balance = current_balance + p_client_amount, updated_at = now()
        WHERE id = p_party_id AND agency_id = v_agency_id;
    END IF;

    -- 2. Credit: Vendor Accounts Payable
    IF COALESCE(p_vendor_payable, 0) > 0 AND p_vendor_id IS NOT NULL THEN
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, booking_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'payable', p_vendor_id, v_invoice_id,
            0, p_vendor_payable, 'Vendor Payable for Invoice ' || v_inv_no, auth.uid()
        );

        -- Update vendor balance
        UPDATE public.parties
        SET current_balance = current_balance - p_vendor_payable, updated_at = now()
        WHERE id = p_vendor_id AND agency_id = v_agency_id;
    END IF;

    -- 3. Credit: Service Income (Net Profit)
    IF v_profit <> 0 THEN
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, booking_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_invoice_date, CURRENT_DATE), 'income', v_invoice_id,
            CASE WHEN v_profit < 0 THEN ABS(v_profit) ELSE 0 END,
            CASE WHEN v_profit > 0 THEN v_profit ELSE 0 END,
            'Income on Booking ' || v_inv_no || ' (' || p_service || ')', auth.uid()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_no', v_inv_no,
        'profit', v_profit
    );
END;
$$;

-- 7B. SAVE PAYMENT VOUCHER (Auto-allocates to oldest unpaid invoices)
CREATE OR REPLACE FUNCTION public.save_payment_voucher(
    p_direction TEXT, -- 'received' or 'paid'
    p_amount NUMERIC,
    p_payment_mode TEXT, -- 'cash', 'bank', 'transfer'
    p_account_id UUID,
    p_party_id UUID,
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
    v_seq INT;
    v_rem_amount NUMERIC := p_amount;
    v_inv RECORD;
    v_alloc_amt NUMERIC;
    v_new_paid NUMERIC;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Voucher amount must be greater than zero';
    END IF;

    -- Auto-generate voucher number if not provided
    IF v_v_no IS NULL OR TRIM(v_v_no) = '' THEN
        SELECT COALESCE(MAX(SUBSTRING(voucher_no FROM '[0-9]+')::INT), 2000) + 1 INTO v_seq
        FROM public.payment_vouchers
        WHERE agency_id = v_agency_id;
        v_v_no := CASE WHEN p_direction = 'received' THEN 'CRV-' ELSE 'CPV-' END || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_seq::TEXT, 4, '0');
    END IF;

    -- Insert payment voucher
    INSERT INTO public.payment_vouchers (
        agency_id, voucher_no, voucher_date, direction, payment_mode, account_id,
        party_id, amount, is_adjustment, adjustment_reason, reference_no, notes, created_by
    ) VALUES (
        v_agency_id, v_v_no, COALESCE(p_voucher_date, CURRENT_DATE), p_direction, p_payment_mode, p_account_id,
        p_party_id, p_amount, p_is_adjustment, p_adjustment_reason, p_reference_no, p_notes, auth.uid()
    )
    RETURNING id INTO v_voucher_id;

    -- Double-Entry Journal
    IF p_direction = 'received' THEN
        -- Money in: Debit Cash/Bank, Credit Party Receivable
        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'cash_bank', p_account_id, v_voucher_id,
            p_amount, 0, 'Receipt Voucher ' || v_v_no, auth.uid()
        );

        INSERT INTO public.central_journal_entries (
            agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id, debit, credit, description, created_by
        ) VALUES (
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'receivable', p_party_id, v_voucher_id,
            0, p_amount, 'Payment from party (Voucher ' || v_v_no || ')', auth.uid()
        );

        -- Update party balance
        UPDATE public.parties
        SET current_balance = current_balance - p_amount, updated_at = now()
        WHERE id = p_party_id AND agency_id = v_agency_id;

        -- Auto-allocate to oldest unpaid invoices
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
            v_agency_id, v_group_id, COALESCE(p_voucher_date, CURRENT_DATE), 'cash_bank', p_account_id, v_voucher_id,
            0, p_amount, 'Payment Voucher ' || v_v_no, auth.uid()
        );

        -- Update party balance
        UPDATE public.parties
        SET current_balance = current_balance + p_amount, updated_at = now()
        WHERE id = p_party_id AND agency_id = v_agency_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'voucher_id', v_voucher_id,
        'voucher_no', v_v_no,
        'amount', p_amount
    );
END;
$$;

-- 8. INITIAL SAFE BACKFILL OF EXISTING PARTIES INTO `parties` TABLE
INSERT INTO public.parties (agency_id, type, name, phone, city, opening_balance, legacy_source, legacy_id)
SELECT agency_id, 'client', name, contact_number, destination, 0, 'clients', id
FROM public.clients
ON CONFLICT (agency_id, name, type) DO NOTHING;

INSERT INTO public.parties (agency_id, type, name, phone, city, opening_balance, legacy_source, legacy_id)
SELECT agency_id, 'vendor', name, phone, city, 0, 'vendors', id
FROM public.vendors
ON CONFLICT (agency_id, name, type) DO NOTHING;
