-- ==============================================================================
-- TAMS PRO — UNIFIED TRANSACTIONS & ACCOUNTS LEDGER ENGINE
-- Migration: 20261107_accounts_bookings_unified_ledger.sql
-- Single Source of Truth for all financial transactions, accounts, and bookings.
-- Fully idempotent and safe: does NOT drop or alter any existing columns/tables.
-- ==============================================================================

-- 1. ACCOUNTS TABLE (Cash & Bank Accounts)
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

-- Enable RLS
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

-- 2. TRANSACTIONS TABLE (Single Source of Truth)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL CHECK (type IN ('charge', 'payment_in', 'payment_out', 'expense', 'refund', 'transfer', 'adjustment', 'opening')),
    party_id UUID, -- client, agent, or vendor ID
    party_type TEXT CHECK (party_type IN ('client', 'agent', 'vendor')),
    booking_id UUID, -- client booking or b2b booking ID
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    debit NUMERIC NOT NULL DEFAULT 0,
    credit NUMERIC NOT NULL DEFAULT 0,
    method TEXT DEFAULT 'cash',
    reference_no TEXT,
    category TEXT,
    notes TEXT,
    reversed_of UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    legacy_source TEXT, -- For idempotent migration backfill tracking
    legacy_id UUID,     -- For idempotent migration backfill tracking
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies manage their own transactions" ON public.transactions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies manage their own transactions"
    ON public.transactions FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());

CREATE INDEX IF NOT EXISTS idx_transactions_agency_date ON public.transactions (agency_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_agency_party ON public.transactions (agency_id, party_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_agency_account ON public.transactions (agency_id, account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_agency_booking ON public.transactions (agency_id, booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reversed_of ON public.transactions (reversed_of);
CREATE INDEX IF NOT EXISTS idx_transactions_legacy ON public.transactions (agency_id, legacy_source, legacy_id);


-- ==============================================================================
-- 3. ATOMIC STORED PROCEDURES (RPCs)
-- ==============================================================================

-- Helper: Get or create default cash account for agency
CREATE OR REPLACE FUNCTION public.get_or_create_default_cash_account(p_agency_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_acc_id UUID;
BEGIN
    SELECT id INTO v_acc_id
    FROM public.accounts
    WHERE agency_id = p_agency_id AND type = 'cash'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_acc_id IS NULL THEN
        INSERT INTO public.accounts (agency_id, type, name, opening_balance, active)
        VALUES (p_agency_id, 'cash', 'Main Cash Account', 0, true)
        ON CONFLICT (agency_id, name) DO UPDATE SET active = true
        RETURNING id INTO v_acc_id;
    END IF;

    RETURN v_acc_id;
END;
$$;

-- ATOMIC RPC: record_payment
CREATE OR REPLACE FUNCTION public.record_payment(
    p_direction TEXT, -- 'in' (received from client/agent) or 'out' (paid to vendor/client)
    p_amount NUMERIC,
    p_account_id UUID,
    p_party_id UUID DEFAULT NULL,
    p_party_type TEXT DEFAULT NULL,
    p_booking_id UUID DEFAULT NULL,
    p_date DATE DEFAULT CURRENT_DATE,
    p_method TEXT DEFAULT 'cash',
    p_reference_no TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_acc_id UUID := p_account_id;
    v_tx_id UUID;
    v_client RECORD;
    v_vendor RECORD;
    v_booking RECORD;
    v_tx_type TEXT;
    v_debit NUMERIC := 0;
    v_credit NUMERIC := 0;
    v_new_paid NUMERIC;
    v_status TEXT;
    v_party_name TEXT := 'Party';
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- Ensure valid account
    IF v_acc_id IS NULL THEN
        v_acc_id := public.get_or_create_default_cash_account(v_agency_id);
    ELSE
        IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = v_acc_id AND agency_id = v_agency_id) THEN
            RAISE EXCEPTION 'Invalid account selected';
        END IF;
    END IF;

    IF LOWER(p_direction) = 'in' THEN
        v_tx_type := 'payment_in';
        v_debit := p_amount; -- Bank / Cash inflow
        v_credit := 0;

        -- If linked to Direct Client (clients table)
        IF p_party_type = 'client' AND p_party_id IS NOT NULL THEN
            SELECT * INTO v_client FROM public.clients WHERE id = p_party_id AND agency_id = v_agency_id;
            IF FOUND THEN
                v_party_name := v_client.name;
                v_new_paid := COALESCE(v_client.amount_paid, 0) + p_amount;
                IF v_client.selling_price IS NOT NULL AND v_client.selling_price > 0 THEN
                    IF v_new_paid >= v_client.selling_price THEN
                        v_status := 'Paid';
                    ELSE
                        v_status := 'Partial';
                    END IF;
                ELSE
                    v_status := 'Paid';
                END IF;

                UPDATE public.clients
                SET amount_paid = v_new_paid,
                    payment_status = v_status,
                    updated_at = now()
                WHERE id = p_party_id AND agency_id = v_agency_id;

                -- Backward compatibility: insert into client_payment_history
                INSERT INTO public.client_payment_history (
                    client_id, agency_id, payment_amount, payment_date, payment_type, notes
                ) VALUES (
                    p_party_id, v_agency_id, p_amount, COALESCE(p_date, CURRENT_DATE),
                    CASE WHEN v_new_paid >= COALESCE(v_client.selling_price, 0) THEN 'full' ELSE 'partial' END,
                    COALESCE(p_notes, 'Payment received')
                );
            END IF;
        -- If linked to B2B Agent
        ELSIF p_party_type = 'agent' AND p_party_id IS NOT NULL THEN
            SELECT name INTO v_party_name FROM public.b2b_agents WHERE id = p_party_id AND agency_id = v_agency_id;
            -- Backward compatibility: insert into b2b_ledger
            INSERT INTO public.b2b_ledger (
                agency_id, agent_id, entry_date, entry_type, amount, payment_mode, remarks
            ) VALUES (
                v_agency_id, p_party_id, TO_CHAR(COALESCE(p_date, CURRENT_DATE), 'YYYY-MM-DD'),
                'credit', p_amount, p_method, COALESCE(p_notes, 'Payment received')
            );
        END IF;

    ELSE
        -- Payment Out (to vendor)
        v_tx_type := 'payment_out';
        v_debit := 0;
        v_credit := p_amount; -- Bank / Cash outflow

        IF p_party_type = 'vendor' AND p_party_id IS NOT NULL THEN
            SELECT * INTO v_vendor FROM public.vendors WHERE id = p_party_id AND agency_id = v_agency_id;
            IF FOUND THEN
                v_party_name := v_vendor.name;
                v_new_paid := COALESCE(v_vendor.amount_paid, 0) + p_amount;
                UPDATE public.vendors
                SET amount_paid = v_new_paid,
                    updated_at = now()
                WHERE id = p_party_id AND agency_id = v_agency_id;

                -- Backward compatibility: insert into vendor_payment_history
                INSERT INTO public.vendor_payment_history (
                    vendor_id, agency_id, payment_amount, payment_date, payment_type, notes
                ) VALUES (
                    p_party_id, v_agency_id, p_amount, COALESCE(p_date, CURRENT_DATE),
                    'partial', COALESCE(p_notes, 'Payout to vendor')
                );
            END IF;
        END IF;
    END IF;

    -- Record transaction row (Single Source of Truth)
    INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, account_id,
        debit, credit, method, reference_no, category, notes, created_by
    ) VALUES (
        v_agency_id, COALESCE(p_date, CURRENT_DATE), v_tx_type, p_party_id, p_party_type, p_booking_id, v_acc_id,
        v_debit, v_credit, COALESCE(p_method, 'cash'), p_reference_no, p_category, p_notes, auth.uid()
    )
    RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'account_id', v_acc_id,
        'amount', p_amount,
        'direction', p_direction,
        'type', v_tx_type
    );
END;
$$;

-- ATOMIC RPC: record_expense
CREATE OR REPLACE FUNCTION public.record_expense(
    p_amount NUMERIC,
    p_account_id UUID,
    p_category TEXT,
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
    v_acc_id UUID := p_account_id;
    v_tx_id UUID;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero';
    END IF;

    IF v_acc_id IS NULL THEN
        v_acc_id := public.get_or_create_default_cash_account(v_agency_id);
    END IF;

    -- Insert into transactions
    INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, account_id,
        debit, credit, method, reference_no, category, notes, created_by
    ) VALUES (
        v_agency_id, COALESCE(p_date, CURRENT_DATE), 'expense', p_party_id, p_party_type, v_acc_id,
        0, p_amount, COALESCE(p_method, 'cash'), p_reference_no, COALESCE(p_category, 'General Expense'), p_notes, auth.uid()
    )
    RETURNING id INTO v_tx_id;

    -- Backward compatibility: insert into expenses table
    INSERT INTO public.expenses (
        agency_id, expense_date, expense_type, amount, notes
    ) VALUES (
        v_agency_id, COALESCE(p_date, CURRENT_DATE), COALESCE(p_category, 'General Expense'), p_amount, p_notes
    );

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id);
END;
$$;

-- ATOMIC RPC: record_refund
CREATE OR REPLACE FUNCTION public.record_refund(
    p_amount NUMERIC,
    p_account_id UUID,
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
    v_acc_id UUID := p_account_id;
    v_tx_id UUID;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Refund amount must be greater than zero';
    END IF;

    IF v_acc_id IS NULL THEN
        v_acc_id := public.get_or_create_default_cash_account(v_agency_id);
    END IF;

    -- Insert into transactions
    INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, account_id,
        debit, credit, method, reference_no, category, notes, created_by
    ) VALUES (
        v_agency_id, COALESCE(p_date, CURRENT_DATE), 'refund', p_party_id, p_party_type, p_booking_id, v_acc_id,
        0, p_amount, COALESCE(p_method, 'cash'), p_reference_no, 'Refund', COALESCE(p_notes, p_reason), auth.uid()
    )
    RETURNING id INTO v_tx_id;

    -- Backward compatibility: insert into refunds table
    INSERT INTO public.refunds (
        agency_id, client_id, booking_id, refund_date, refund_amount, payment_mode, reason, notes, created_by
    ) VALUES (
        v_agency_id, p_party_id, p_booking_id, COALESCE(p_date, CURRENT_DATE), p_amount, COALESCE(p_method, 'cash'), p_reason, p_notes, auth.uid()
    );

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id);
END;
$$;

-- ATOMIC RPC: record_transfer (Between accounts)
CREATE OR REPLACE FUNCTION public.record_transfer(
    p_from_account_id UUID,
    p_to_account_id UUID,
    p_amount NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE,
    p_reference_no TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_from_name TEXT;
    v_to_name TEXT;
    v_tx1_id UUID;
    v_tx2_id UUID;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be greater than zero';
    END IF;

    IF p_from_account_id = p_to_account_id THEN
        RAISE EXCEPTION 'Source and destination accounts must be different';
    END IF;

    SELECT name INTO v_from_name FROM public.accounts WHERE id = p_from_account_id AND agency_id = v_agency_id;
    SELECT name INTO v_to_name FROM public.accounts WHERE id = p_to_account_id AND agency_id = v_agency_id;

    IF v_from_name IS NULL OR v_to_name IS NULL THEN
        RAISE EXCEPTION 'One or both accounts not found in agency';
    END IF;

    -- Outflow from source account (Credit)
    INSERT INTO public.transactions (
        agency_id, date, type, account_id, debit, credit, method, reference_no, category, notes, created_by
    ) VALUES (
        v_agency_id, COALESCE(p_date, CURRENT_DATE), 'transfer', p_from_account_id, 0, p_amount, 'transfer',
        p_reference_no, 'Account Transfer', 'Transfer to ' || v_to_name || COALESCE(': ' || p_notes, ''), auth.uid()
    )
    RETURNING id INTO v_tx1_id;

    -- Inflow to destination account (Debit)
    INSERT INTO public.transactions (
        agency_id, date, type, account_id, debit, credit, method, reference_no, category, notes, created_by
    ) VALUES (
        v_agency_id, COALESCE(p_date, CURRENT_DATE), 'transfer', p_to_account_id, p_amount, 0, 'transfer',
        p_reference_no, 'Account Transfer', 'Transfer from ' || v_from_name || COALESCE(': ' || p_notes, ''), auth.uid()
    )
    RETURNING id INTO v_tx2_id;

    RETURN jsonb_build_object(
        'success', true,
        'from_transaction_id', v_tx1_id,
        'to_transaction_id', v_tx2_id,
        'amount', p_amount
    );
END;
$$;

-- ATOMIC RPC: post_booking_charge
CREATE OR REPLACE FUNCTION public.post_booking_charge(
    p_booking_id UUID,
    p_party_id UUID,
    p_party_type TEXT,
    p_amount NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE,
    p_reference_no TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_existing_id UUID;
    v_tx_id UUID;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    -- Check if charge already exists for this booking
    SELECT id INTO v_existing_id
    FROM public.transactions
    WHERE agency_id = v_agency_id
      AND booking_id = p_booking_id
      AND type = 'charge'
      AND reversed_of IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        IF p_amount <= 0 THEN
            -- Void existing charge
            UPDATE public.transactions
            SET debit = 0, notes = notes || ' (Cancelled / Zeroed)', updated_at = now()
            WHERE id = v_existing_id;
            RETURN jsonb_build_object('success', true, 'action', 'zeroed', 'transaction_id', v_existing_id);
        ELSE
            -- Update existing charge
            UPDATE public.transactions
            SET debit = p_amount,
                date = COALESCE(p_date, date),
                reference_no = COALESCE(p_reference_no, reference_no),
                notes = COALESCE(p_notes, notes),
                party_id = COALESCE(p_party_id, party_id),
                party_type = COALESCE(p_party_type, party_type),
                updated_at = now()
            WHERE id = v_existing_id;
            RETURN jsonb_build_object('success', true, 'action', 'updated', 'transaction_id', v_existing_id);
        END IF;
    ELSE
        IF p_amount > 0 THEN
            INSERT INTO public.transactions (
                agency_id, date, type, party_id, party_type, booking_id,
                debit, credit, method, reference_no, category, notes, created_by
            ) VALUES (
                v_agency_id, COALESCE(p_date, CURRENT_DATE), 'charge', p_party_id, p_party_type, p_booking_id,
                p_amount, 0, 'on_account', p_reference_no, 'Booking Charge', COALESCE(p_notes, 'Booking Charge'), auth.uid()
            )
            RETURNING id INTO v_tx_id;
            RETURN jsonb_build_object('success', true, 'action', 'created', 'transaction_id', v_tx_id);
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'action', 'noop');
END;
$$;

-- ATOMIC RPC: reverse_transaction (Never hard delete)
CREATE OR REPLACE FUNCTION public.reverse_transaction(
    p_transaction_id UUID,
    p_reason TEXT DEFAULT 'Transaction reversed / voided'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_orig RECORD;
    v_rev_id UUID;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    SELECT * INTO v_orig
    FROM public.transactions
    WHERE id = p_transaction_id AND agency_id = v_agency_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found or access denied';
    END IF;

    IF v_orig.reversed_of IS NOT NULL THEN
        RAISE EXCEPTION 'This transaction has already been reversed';
    END IF;

    -- Create reversing entry (swap debit and credit)
    INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, account_id,
        debit, credit, method, reference_no, category, notes, reversed_of, created_by
    ) VALUES (
        v_agency_id, CURRENT_DATE, v_orig.type, v_orig.party_id, v_orig.party_type, v_orig.booking_id, v_orig.account_id,
        v_orig.credit, v_orig.debit, v_orig.method, v_orig.reference_no, v_orig.category,
        'Reversal: ' || COALESCE(p_reason, 'Voided') || ' (Original #' || SUBSTRING(v_orig.id::text, 1, 8) || ')',
        v_orig.id, auth.uid()
    )
    RETURNING id INTO v_rev_id;

    -- Mark original as reversed
    UPDATE public.transactions
    SET reversed_of = v_rev_id, updated_at = now()
    WHERE id = v_orig.id;

    -- Revert payment on party if applicable
    IF v_orig.type = 'payment_in' AND v_orig.party_type = 'client' AND v_orig.party_id IS NOT NULL THEN
        UPDATE public.clients
        SET amount_paid = GREATEST(0, COALESCE(amount_paid, 0) - v_orig.debit),
            payment_status = CASE WHEN GREATEST(0, COALESCE(amount_paid, 0) - v_orig.debit) <= 0 THEN 'Pending' ELSE 'Partial' END,
            updated_at = now()
        WHERE id = v_orig.party_id AND agency_id = v_agency_id;
    ELSIF v_orig.type = 'payment_out' AND v_orig.party_type = 'vendor' AND v_orig.party_id IS NOT NULL THEN
        UPDATE public.vendors
        SET amount_paid = GREATEST(0, COALESCE(amount_paid, 0) - v_orig.credit),
            updated_at = now()
        WHERE id = v_orig.party_id AND agency_id = v_agency_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'original_id', v_orig.id,
        'reversal_id', v_rev_id
    );
END;
$$;


-- ==============================================================================
-- 4. VIEWS AND REPORTING RPCS
-- ==============================================================================

-- Account Balance RPC
CREATE OR REPLACE FUNCTION public.account_balances(p_agency_id UUID DEFAULT NULL)
RETURNS TABLE (
    account_id UUID,
    account_name TEXT,
    account_type TEXT,
    opening_balance NUMERIC,
    total_in NUMERIC,
    total_out NUMERIC,
    current_balance NUMERIC,
    active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
BEGIN
    v_agency_id := COALESCE(p_agency_id, public.current_user_agency_id());

    RETURN QUERY
    SELECT
        a.id AS account_id,
        a.name AS account_name,
        a.type AS account_type,
        a.opening_balance,
        COALESCE(SUM(t.debit) FILTER (WHERE t.reversed_of IS NULL), 0)::NUMERIC AS total_in,
        COALESCE(SUM(t.credit) FILTER (WHERE t.reversed_of IS NULL), 0)::NUMERIC AS total_out,
        (a.opening_balance + COALESCE(SUM(t.debit - t.credit) FILTER (WHERE t.reversed_of IS NULL), 0))::NUMERIC AS current_balance,
        a.active
    FROM public.accounts a
    LEFT JOIN public.transactions t ON t.account_id = a.id AND t.agency_id = v_agency_id
    WHERE a.agency_id = v_agency_id
    GROUP BY a.id, a.name, a.type, a.opening_balance, a.active
    ORDER BY a.type DESC, a.name ASC;
END;
$$;

-- Party Balance RPC (Receivables & Payables for clients, agents, vendors)
CREATE OR REPLACE FUNCTION public.party_balances(
    p_party_type TEXT DEFAULT NULL,
    p_agency_id UUID DEFAULT NULL
)
RETURNS TABLE (
    party_id UUID,
    party_type TEXT,
    party_name TEXT,
    total_debit NUMERIC,
    total_credit NUMERIC,
    current_balance NUMERIC -- Positive = receivable (they owe us), Negative = payable (we owe them)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
BEGIN
    v_agency_id := COALESCE(p_agency_id, public.current_user_agency_id());

    RETURN QUERY
    WITH raw_party_tx AS (
        SELECT
            t.party_id,
            t.party_type,
            COALESCE(SUM(t.debit) FILTER (WHERE t.reversed_of IS NULL), 0) AS s_debit,
            COALESCE(SUM(t.credit) FILTER (WHERE t.reversed_of IS NULL), 0) AS s_credit
        FROM public.transactions t
        WHERE t.agency_id = v_agency_id
          AND t.party_id IS NOT NULL
          AND (p_party_type IS NULL OR t.party_type = p_party_type)
        GROUP BY t.party_id, t.party_type
    )
    SELECT
        rp.party_id,
        rp.party_type,
        COALESCE(
            CASE 
                WHEN rp.party_type = 'client' THEN (SELECT c.name FROM public.clients c WHERE c.id = rp.party_id)
                WHEN rp.party_type = 'agent' THEN (SELECT a.name FROM public.b2b_agents a WHERE a.id = rp.party_id)
                WHEN rp.party_type = 'vendor' THEN (SELECT v.name FROM public.vendors v WHERE v.id = rp.party_id)
            END,
            'Unknown Party'
        ) AS party_name,
        rp.s_debit::NUMERIC AS total_debit,
        rp.s_credit::NUMERIC AS total_credit,
        (rp.s_debit - rp.s_credit)::NUMERIC AS current_balance
    FROM raw_party_tx rp
    ORDER BY (rp.s_debit - rp.s_credit) DESC;
END;
$$;

-- Agency Ledger with running balance
CREATE OR REPLACE FUNCTION public.get_agency_ledger(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_account_id UUID DEFAULT NULL,
    p_party_id UUID DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_include_reversed BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    date DATE,
    type TEXT,
    reference_no TEXT,
    category TEXT,
    notes TEXT,
    method TEXT,
    account_id UUID,
    account_name TEXT,
    party_id UUID,
    party_type TEXT,
    party_name TEXT,
    booking_id UUID,
    booking_ref TEXT,
    debit NUMERIC,
    credit NUMERIC,
    reversed_of UUID,
    is_reversed BOOLEAN,
    running_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
BEGIN
    v_agency_id := public.current_user_agency_id();

    RETURN QUERY
    WITH filtered_tx AS (
        SELECT
            t.id,
            t.date,
            t.type,
            t.reference_no,
            t.category,
            t.notes,
            t.method,
            t.account_id,
            acc.name AS account_name,
            t.party_id,
            t.party_type,
            COALESCE(
                CASE 
                    WHEN t.party_type = 'client' THEN cl.name
                    WHEN t.party_type = 'agent' THEN ag.name
                    WHEN t.party_type = 'vendor' THEN vn.name
                END,
                ''
            ) AS party_name,
            t.booking_id,
            COALESCE(cl.pnr, b2bb.pnr, t.reference_no, '') AS booking_ref,
            t.debit,
            t.credit,
            t.reversed_of,
            (t.reversed_of IS NOT NULL) AS is_reversed,
            t.created_at
        FROM public.transactions t
        LEFT JOIN public.accounts acc ON acc.id = t.account_id
        LEFT JOIN public.clients cl ON cl.id = t.party_id OR cl.id = t.booking_id
        LEFT JOIN public.b2b_agents ag ON ag.id = t.party_id
        LEFT JOIN public.b2b_bookings b2bb ON b2bb.id = t.booking_id
        LEFT JOIN public.vendors vn ON vn.id = t.party_id
        WHERE t.agency_id = v_agency_id
          AND (p_start_date IS NULL OR t.date >= p_start_date)
          AND (p_end_date IS NULL OR t.date <= p_end_date)
          AND (p_account_id IS NULL OR t.account_id = p_account_id)
          AND (p_party_id IS NULL OR t.party_id = p_party_id)
          AND (p_type IS NULL OR t.type = p_type)
          AND (p_include_reversed OR t.reversed_of IS NULL)
        ORDER BY t.date ASC, t.created_at ASC
    )
    SELECT
        f.id,
        f.date,
        f.type,
        f.reference_no,
        f.category,
        f.notes,
        f.method,
        f.account_id,
        f.account_name,
        f.party_id,
        f.party_type,
        f.party_name,
        f.booking_id,
        f.booking_ref,
        f.debit,
        f.credit,
        f.reversed_of,
        f.is_reversed,
        SUM(f.debit - f.credit) OVER (ORDER BY f.date ASC, f.created_at ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::NUMERIC AS running_balance
    FROM filtered_tx f
    ORDER BY f.date DESC, f.created_at DESC;
END;
$$;

-- Party Statement RPC (Client / Agent / Vendor Statement with opening & running balance)
CREATE OR REPLACE FUNCTION public.get_party_statement(
    p_party_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_include_reversed BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    date DATE,
    type TEXT,
    reference_no TEXT,
    booking_ref TEXT,
    notes TEXT,
    method TEXT,
    account_name TEXT,
    debit NUMERIC,
    credit NUMERIC,
    reversed_of UUID,
    is_reversed BOOLEAN,
    running_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_opening NUMERIC := 0;
BEGIN
    v_agency_id := public.current_user_agency_id();

    -- Calculate opening balance before start_date
    IF p_start_date IS NOT NULL THEN
        SELECT COALESCE(SUM(t.debit - t.credit), 0)
        INTO v_opening
        FROM public.transactions t
        WHERE t.agency_id = v_agency_id
          AND t.party_id = p_party_id
          AND t.date < p_start_date
          AND (p_include_reversed OR t.reversed_of IS NULL);
    END IF;

    RETURN QUERY
    WITH tx_rows AS (
        SELECT
            t.id,
            t.date,
            t.type,
            t.reference_no,
            COALESCE(cl.pnr, b2bb.pnr, t.reference_no, '') AS booking_ref,
            t.notes,
            t.method,
            COALESCE(acc.name, '') AS account_name,
            -- For party ledger: Charges/Invoices are Debit (increase balance); Payments received are Credit (reduce balance)
            CASE 
                WHEN t.type = 'charge' THEN t.debit
                WHEN t.type = 'payment_in' THEN 0
                WHEN t.type = 'refund' THEN t.credit
                ELSE t.debit
            END AS tx_debit,
            CASE 
                WHEN t.type = 'payment_in' THEN t.debit
                WHEN t.type = 'charge' THEN 0
                ELSE t.credit
            END AS tx_credit,
            t.reversed_of,
            (t.reversed_of IS NOT NULL) AS is_reversed,
            t.created_at
        FROM public.transactions t
        LEFT JOIN public.accounts acc ON acc.id = t.account_id
        LEFT JOIN public.clients cl ON cl.id = t.booking_id
        LEFT JOIN public.b2b_bookings b2bb ON b2bb.id = t.booking_id
        WHERE t.agency_id = v_agency_id
          AND t.party_id = p_party_id
          AND (p_start_date IS NULL OR t.date >= p_start_date)
          AND (p_end_date IS NULL OR t.date <= p_end_date)
          AND (p_include_reversed OR t.reversed_of IS NULL)
        ORDER BY t.date ASC, t.created_at ASC
    )
    SELECT
        r.id,
        r.date,
        r.type,
        r.reference_no,
        r.booking_ref,
        r.notes,
        r.method,
        r.account_name,
        r.tx_debit::NUMERIC,
        r.tx_credit::NUMERIC,
        r.reversed_of,
        r.is_reversed,
        (v_opening + SUM(r.tx_debit - r.tx_credit) OVER (ORDER BY r.date ASC, r.created_at ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW))::NUMERIC AS running_balance
    FROM tx_rows r
    ORDER BY r.date ASC, r.created_at ASC;
END;
$$;


-- ==============================================================================
-- 5. TRIGGERS: AUTO-POST CHARGE ON BOOKING CREATE / UPDATE / DELETE
-- ==============================================================================

-- Trigger on public.clients (Direct client bookings)
CREATE OR REPLACE FUNCTION public.trg_sync_client_booking_charge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        -- Mark charge as voided
        UPDATE public.transactions
        SET notes = notes || ' (Booking Deleted)', debit = 0, updated_at = now()
        WHERE agency_id = OLD.agency_id
          AND booking_id = OLD.id
          AND type = 'charge';
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        IF NEW.selling_price IS NOT NULL AND NEW.selling_price > 0 THEN
            INSERT INTO public.transactions (
                agency_id, date, type, party_id, party_type, booking_id,
                debit, credit, method, reference_no, category, notes
            ) VALUES (
                NEW.agency_id,
                COALESCE(NEW.flight_date::date, NEW.created_at::date, CURRENT_DATE),
                'charge', NEW.id, 'client', NEW.id,
                NEW.selling_price, 0, 'on_account', NEW.pnr, 'Booking Charge', 'Booking: ' || NEW.name
            );
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If selling price or date changed, update the charge transaction
        IF (OLD.selling_price IS DISTINCT FROM NEW.selling_price)
           OR (OLD.pnr IS DISTINCT FROM NEW.pnr)
           OR (OLD.name IS DISTINCT FROM NEW.name) THEN
            
            IF EXISTS (SELECT 1 FROM public.transactions WHERE booking_id = NEW.id AND type = 'charge' AND reversed_of IS NULL) THEN
                UPDATE public.transactions
                SET debit = COALESCE(NEW.selling_price, 0),
                    reference_no = NEW.pnr,
                    notes = 'Booking: ' || NEW.name,
                    updated_at = now()
                WHERE booking_id = NEW.id AND type = 'charge' AND reversed_of IS NULL;
            ELSE
                IF NEW.selling_price IS NOT NULL AND NEW.selling_price > 0 THEN
                    INSERT INTO public.transactions (
                        agency_id, date, type, party_id, party_type, booking_id,
                        debit, credit, method, reference_no, category, notes
                    ) VALUES (
                        NEW.agency_id,
                        COALESCE(NEW.flight_date::date, CURRENT_DATE),
                        'charge', NEW.id, 'client', NEW.id,
                        NEW.selling_price, 0, 'on_account', NEW.pnr, 'Booking Charge', 'Booking: ' || NEW.name
                    );
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_charge_sync ON public.clients;
CREATE TRIGGER trg_clients_charge_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_sync_client_booking_charge();

-- Trigger on public.b2b_bookings (Agent bookings)
CREATE OR REPLACE FUNCTION public.trg_sync_b2b_booking_charge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_charge_amount NUMERIC;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.transactions
        SET notes = notes || ' (B2B Booking Deleted)', debit = 0, updated_at = now()
        WHERE agency_id = OLD.agency_id
          AND booking_id = OLD.id
          AND type = 'charge';
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        v_charge_amount := COALESCE(NEW.selling_price, 0) - COALESCE(NEW.commission_amount, 0);
        IF v_charge_amount > 0 THEN
            INSERT INTO public.transactions (
                agency_id, date, type, party_id, party_type, booking_id,
                debit, credit, method, reference_no, category, notes
            ) VALUES (
                NEW.agency_id,
                COALESCE(NEW.flight_date::date, NEW.created_at::date, CURRENT_DATE),
                'charge', NEW.agent_id, 'agent', NEW.id,
                v_charge_amount, 0, 'on_account', NEW.pnr, 'B2B Booking Charge', 'Booking: ' || NEW.passenger_name
            );
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_charge_amount := COALESCE(NEW.selling_price, 0) - COALESCE(NEW.commission_amount, 0);
        IF (OLD.selling_price IS DISTINCT FROM NEW.selling_price)
           OR (OLD.commission_amount IS DISTINCT FROM NEW.commission_amount)
           OR (OLD.pnr IS DISTINCT FROM NEW.pnr)
           OR (OLD.passenger_name IS DISTINCT FROM NEW.passenger_name) THEN
            
            IF EXISTS (SELECT 1 FROM public.transactions WHERE booking_id = NEW.id AND type = 'charge' AND reversed_of IS NULL) THEN
                UPDATE public.transactions
                SET debit = v_charge_amount,
                    reference_no = NEW.pnr,
                    notes = 'Booking: ' || NEW.passenger_name,
                    updated_at = now()
                WHERE booking_id = NEW.id AND type = 'charge' AND reversed_of IS NULL;
            ELSE
                IF v_charge_amount > 0 THEN
                    INSERT INTO public.transactions (
                        agency_id, date, type, party_id, party_type, booking_id,
                        debit, credit, method, reference_no, category, notes
                    ) VALUES (
                        NEW.agency_id,
                        COALESCE(NEW.flight_date::date, CURRENT_DATE),
                        'charge', NEW.agent_id, 'agent', NEW.id,
                        v_charge_amount, 0, 'on_account', NEW.pnr, 'B2B Booking Charge', 'Booking: ' || NEW.passenger_name
                    );
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_b2b_bookings_charge_sync ON public.b2b_bookings;
CREATE TRIGGER trg_b2b_bookings_charge_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.b2b_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_sync_b2b_booking_charge();


-- ==============================================================================
-- 6. IDEMPOTENT MIGRATION BACKFILL (Existing bookings, payments, expenses, refunds)
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
    v_cash_acc_id UUID;
BEGIN
    -- 1. Ensure each agency has a default cash account
    FOR r IN SELECT id FROM public.agencies LOOP
        PERFORM public.get_or_create_default_cash_account(r.id);
    END LOOP;

    -- 2. Migrate agency_banks into accounts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agency_banks') THEN
        INSERT INTO public.accounts (agency_id, type, name, opening_balance, active)
        SELECT agency_id, 'bank', bank_name, COALESCE(opening_balance, 0), is_active
        FROM public.agency_banks
        ON CONFLICT (agency_id, name) DO NOTHING;
    END IF;

    -- 3. Backfill Opening Balances
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'opening_balances') THEN
        INSERT INTO public.transactions (
            agency_id, date, type, party_id, party_type, debit, credit, method, reference_no, category, notes, legacy_source, legacy_id
        )
        SELECT
            ob.agency_id,
            ob.as_of_date,
            'opening',
            ob.party_id,
            CASE WHEN ob.party_type = 'b2b_agent' THEN 'agent' ELSE ob.party_type END,
            CASE WHEN ob.balance_type = 'receivable' THEN ob.amount ELSE 0 END,
            CASE WHEN ob.balance_type = 'payable' THEN ob.amount ELSE 0 END,
            'opening',
            'OB-' || SUBSTRING(ob.id::text, 1, 6),
            'Opening Balance',
            COALESCE(ob.notes, 'Opening Balance Migration'),
            'opening_balances',
            ob.id
        FROM public.opening_balances ob
        WHERE NOT EXISTS (
            SELECT 1 FROM public.transactions t 
            WHERE t.legacy_source = 'opening_balances' AND t.legacy_id = ob.id
        );
    END IF;

    -- 4. Backfill Existing Direct Client Bookings Charges
    INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, debit, credit, method, reference_no, category, notes, legacy_source, legacy_id
    )
    SELECT
        c.agency_id,
        COALESCE(c.flight_date::date, c.created_at::date, CURRENT_DATE),
        'charge',
        c.id,
        'client',
        c.id,
        c.selling_price,
        0,
        'on_account',
        c.pnr,
        'Booking Charge',
        'Booking: ' || c.name,
        'clients',
        c.id
    FROM public.clients c
    WHERE c.selling_price IS NOT NULL AND c.selling_price > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.legacy_source = 'clients' AND t.legacy_id = c.id
      );

    -- 5. Backfill Existing B2B Bookings Charges
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b2b_bookings') THEN
        INSERT INTO public.transactions (
            agency_id, date, type, party_id, party_type, booking_id, debit, credit, method, reference_no, category, notes, legacy_source, legacy_id
        )
        SELECT
            b.agency_id,
            COALESCE(b.flight_date::date, b.created_at::date, CURRENT_DATE),
            'charge',
            b.agent_id,
            'agent',
            b.id,
            (COALESCE(b.selling_price, 0) - COALESCE(b.commission_amount, 0)),
            0,
            'on_account',
            b.pnr,
            'B2B Booking Charge',
            'Booking: ' || b.passenger_name,
            'b2b_bookings',
            b.id
        FROM public.b2b_bookings b
        WHERE (COALESCE(b.selling_price, 0) - COALESCE(b.commission_amount, 0)) > 0
          AND NOT EXISTS (
            SELECT 1 FROM public.transactions t 
            WHERE t.legacy_source = 'b2b_bookings' AND t.legacy_id = b.id
          );
    END IF;

    -- 6. Backfill Existing Client Payment History
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_payment_history') THEN
        INSERT INTO public.transactions (
            agency_id, date, type, party_id, party_type, booking_id, account_id, debit, credit, method, reference_no, category, notes, legacy_source, legacy_id
        )
        SELECT
            cph.agency_id,
            cph.payment_date,
            'payment_in',
            cph.client_id,
            'client',
            cph.client_id,
            acc.id,
            cph.payment_amount,
            0,
            'cash',
            'PAY-' || SUBSTRING(cph.id::text, 1, 6),
            'Client Payment',
            COALESCE(cph.notes, 'Client Payment Migration'),
            'client_payment_history',
            cph.id
        FROM public.client_payment_history cph
        LEFT JOIN LATERAL (
            SELECT a.id FROM public.accounts a WHERE a.agency_id = cph.agency_id AND a.type = 'cash' LIMIT 1
        ) acc ON true
        WHERE NOT EXISTS (
            SELECT 1 FROM public.transactions t 
            WHERE t.legacy_source = 'client_payment_history' AND t.legacy_id = cph.id
        );
    END IF;

    -- 7. Backfill Existing B2B Ledger Entries
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b2b_ledger') THEN
        INSERT INTO public.transactions (
            agency_id, date, type, party_id, party_type, account_id, debit, credit, method, reference_no, category, notes, legacy_source, legacy_id
        )
        SELECT
            bl.agency_id,
            COALESCE(bl.entry_date::date, bl.created_at::date, CURRENT_DATE),
            'payment_in',
            bl.agent_id,
            'agent',
            acc.id,
            bl.amount,
            0,
            COALESCE(bl.payment_mode, 'cash'),
            'B2B-' || SUBSTRING(bl.id::text, 1, 6),
            'Agent Payment',
            COALESCE(bl.remarks, 'Agent Payment Migration'),
            'b2b_ledger',
            bl.id
        FROM public.b2b_ledger bl
        LEFT JOIN LATERAL (
            SELECT a.id FROM public.accounts a WHERE a.agency_id = bl.agency_id AND a.type = 'cash' LIMIT 1
        ) acc ON true
        WHERE bl.entry_type IN ('credit', 'payment')
          AND NOT EXISTS (
            SELECT 1 FROM public.transactions t 
            WHERE t.legacy_source = 'b2b_ledger' AND t.legacy_id = bl.id
          );
    END IF;

    -- 8. Backfill Existing Vendor Payment History
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_payment_history') THEN
        INSERT INTO public.transactions (
            agency_id, date, type, party_id, party_type, account_id, debit, credit, method, reference_no, category, notes, legacy_source, legacy_id
        )
        SELECT
            vph.agency_id,
            vph.payment_date,
            'payment_out',
            vph.vendor_id,
            'vendor',
            acc.id,
            0,
            vph.payment_amount,
            'cash',
            'VPAY-' || SUBSTRING(vph.id::text, 1, 6),
            'Vendor Payout',
            COALESCE(vph.notes, 'Vendor Payout Migration'),
            'vendor_payment_history',
            vph.id
        FROM public.vendor_payment_history vph
        LEFT JOIN LATERAL (
            SELECT a.id FROM public.accounts a WHERE a.agency_id = vph.agency_id AND a.type = 'cash' LIMIT 1
        ) acc ON true
        WHERE NOT EXISTS (
            SELECT 1 FROM public.transactions t 
            WHERE t.legacy_source = 'vendor_payment_history' AND t.legacy_id = vph.id
        );
    END IF;

    -- 9. Backfill Existing Expenses
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
        INSERT INTO public.transactions (
            agency_id, date, type, account_id, debit, credit, method, reference_no, category, notes, legacy_source, legacy_id
        )
        SELECT
            e.agency_id,
            e.expense_date,
            'expense',
            acc.id,
            0,
            e.amount,
            'cash',
            'EXP-' || SUBSTRING(e.id::text, 1, 6),
            e.expense_type,
            COALESCE(e.notes, 'Expense Migration'),
            'expenses',
            e.id
        FROM public.expenses e
        LEFT JOIN LATERAL (
            SELECT a.id FROM public.accounts a WHERE a.agency_id = e.agency_id AND a.type = 'cash' LIMIT 1
        ) acc ON true
        WHERE NOT EXISTS (
            SELECT 1 FROM public.transactions t 
            WHERE t.legacy_source = 'expenses' AND t.legacy_id = e.id
        );
    END IF;

    -- 10. Backfill Existing Refunds
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refunds') THEN
        INSERT INTO public.transactions (
            agency_id, date, type, party_id, party_type, booking_id, account_id, debit, credit, method, reference_no, category, notes, legacy_source, legacy_id
        )
        SELECT
            ref.agency_id,
            ref.refund_date,
            'refund',
            ref.client_id,
            'client',
            ref.booking_id,
            acc.id,
            0,
            ref.refund_amount,
            COALESCE(ref.payment_mode, 'cash'),
            'REF-' || SUBSTRING(ref.id::text, 1, 6),
            'Refund',
            COALESCE(ref.notes, ref.reason, 'Refund Migration'),
            'refunds',
            ref.id
        FROM public.refunds ref
        LEFT JOIN LATERAL (
            SELECT a.id FROM public.accounts a WHERE a.agency_id = ref.agency_id AND a.type = 'cash' LIMIT 1
        ) acc ON true
        WHERE NOT EXISTS (
            SELECT 1 FROM public.transactions t 
            WHERE t.legacy_source = 'refunds' AND t.legacy_id = ref.id
        );
    END IF;

END $$;
