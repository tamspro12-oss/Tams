-- ==============================================================================
-- TAMS PRO — STAGE 3, 5, 6 ADDITIVE ENGINE: NOTIFICATIONS, WHATSAPP & ATOMIC RPCS
-- ==============================================================================
-- Safe additive migration. Does NOT drop or alter any existing columns/tables.
-- Scoped 100% to authenticated agency with strict RLS policies.

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'all', -- 'all', 'travel', 'accounts', 'reminders', 'system', 'b2b'
    category TEXT DEFAULT 'general', -- 'departure', 'payment_overdue', 'vendor_due', 'booking', 'voucher', 'expense'
    link TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    snoozed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop previous policies if re-running
DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies can view their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Agencies can insert their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Agencies can update their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Agencies can delete their own notifications" ON public.notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies can view their own notifications"
    ON public.notifications FOR SELECT
    USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Agencies can insert their own notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (agency_id = public.current_user_agency_id());

CREATE POLICY "Agencies can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());

CREATE POLICY "Agencies can delete their own notifications"
    ON public.notifications FOR DELETE
    USING (agency_id = public.current_user_agency_id());

CREATE INDEX IF NOT EXISTS idx_notifications_agency_unread 
    ON public.notifications (agency_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_agency_type 
    ON public.notifications (agency_id, type, created_at DESC);


-- 2. AGENCY WHATSAPP SETTINGS TABLE (Per-Agency WhatsApp Credentials)
CREATE TABLE IF NOT EXISTS public.agency_whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL UNIQUE REFERENCES public.agencies(id) ON DELETE CASCADE,
    phone_number_id TEXT,
    waba_id TEXT,
    access_token TEXT,
    sender_phone_number TEXT,
    template_namespace TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_whatsapp_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Agencies manage their own whatsapp settings" ON public.agency_whatsapp_settings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies manage their own whatsapp settings"
    ON public.agency_whatsapp_settings FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());


-- 3. ADD CONVERTED_FROM COLUMNS (Additive tracking for 1-Click Conversions)
DO $$
BEGIN
    -- Track source query or quote on bookings (table is public.queries)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'converted_from_query_id'
    ) THEN
        ALTER TABLE public.clients ADD COLUMN converted_from_query_id UUID REFERENCES public.queries(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'converted_from_quote_id'
    ) THEN
        ALTER TABLE public.clients ADD COLUMN converted_from_quote_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL;
    END IF;

    -- Track booking conversion status on queries & quotations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'queries' AND column_name = 'converted_booking_id'
    ) THEN
        ALTER TABLE public.queries ADD COLUMN converted_booking_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'converted_booking_id'
    ) THEN
        ALTER TABLE public.quotations ADD COLUMN converted_booking_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 4. ATOMIC FUNCTION: CREATE NOTIFICATION (Internal helper for triggers & RPCs)
CREATE OR REPLACE FUNCTION public.create_agency_notification(
    p_agency_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'all',
    p_category TEXT DEFAULT 'general',
    p_link TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notif_id UUID;
BEGIN
    INSERT INTO public.notifications (
        agency_id,
        title,
        message,
        type,
        category,
        link,
        metadata,
        is_read,
        created_at,
        updated_at
    ) VALUES (
        p_agency_id,
        p_title,
        p_message,
        COALESCE(p_type, 'all'),
        COALESCE(p_category, 'general'),
        p_link,
        COALESCE(p_metadata, '{}'::jsonb),
        false,
        now(),
        now()
    )
    RETURNING id INTO v_notif_id;

    RETURN v_notif_id;
END;
$$;


-- 5. ATOMIC FUNCTION: RECORD CLIENT PAYMENT ATOMIC
CREATE OR REPLACE FUNCTION public.record_client_payment_atomic(
    p_client_id UUID,
    p_amount NUMERIC,
    p_payment_mode TEXT, -- 'cash' or 'bank'
    p_bank_name TEXT DEFAULT NULL,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_client RECORD;
    v_new_amount_paid NUMERIC;
    v_payment_status TEXT;
    v_history_id UUID;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    SELECT * INTO v_client
    FROM public.clients
    WHERE id = p_client_id AND agency_id = v_agency_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client booking not found or access denied';
    END IF;

    v_new_amount_paid := COALESCE(v_client.amount_paid, 0) + p_amount;
    
    IF v_client.payment_amount IS NOT NULL AND v_client.payment_amount > 0 THEN
        IF v_new_amount_paid >= v_client.payment_amount THEN
            v_payment_status := 'Paid';
        ELSE
            v_payment_status := 'Partial';
        END IF;
    ELSE
        v_payment_status := 'Paid';
    END IF;

    UPDATE public.clients
    SET amount_paid = v_new_amount_paid,
        payment_status = v_payment_status,
        updated_at = now()
    WHERE id = p_client_id AND agency_id = v_agency_id;

    INSERT INTO public.client_payment_history (
        client_id,
        agency_id,
        payment_amount,
        payment_type,
        payment_date,
        payment_mode,
        bank_name,
        notes
    ) VALUES (
        p_client_id,
        v_agency_id,
        p_amount,
        CASE WHEN v_new_amount_paid >= COALESCE(v_client.payment_amount, 0) THEN 'full' ELSE 'partial' END,
        COALESCE(p_payment_date, CURRENT_DATE),
        p_payment_mode,
        p_bank_name,
        COALESCE(p_notes, 'Payment received')
    )
    RETURNING id INTO v_history_id;

    PERFORM public.create_agency_notification(
        v_agency_id,
        'Payment Received: ' || v_client.name,
        'Recorded ' || p_payment_mode || ' payment of ₨' || TO_CHAR(p_amount, 'FM999,999,999') || ' for booking #' || COALESCE(v_client.pnr, v_client.name),
        'accounts',
        'payment',
        '/app/bookings?tab=clients',
        jsonb_build_object('client_id', p_client_id, 'amount', p_amount, 'payment_mode', p_payment_mode)
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_history_id,
        'client_id', p_client_id,
        'total_paid', v_new_amount_paid,
        'payment_status', v_payment_status
    );
END;
$$;


-- 6. ATOMIC FUNCTION: RECORD VENDOR PAYOUT ATOMIC
CREATE OR REPLACE FUNCTION public.record_vendor_payout_atomic(
    p_vendor_id UUID,
    p_amount NUMERIC,
    p_payment_mode TEXT, -- 'cash' or 'bank'
    p_bank_name TEXT DEFAULT NULL,
    p_payment_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_vendor RECORD;
    v_new_amount_paid NUMERIC;
    v_payment_status TEXT;
    v_history_id UUID;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    SELECT * INTO v_vendor
    FROM public.vendors
    WHERE id = p_vendor_id AND agency_id = v_agency_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vendor not found or access denied';
    END IF;

    v_new_amount_paid := COALESCE(v_vendor.amount_paid, 0) + p_amount;
    
    IF v_vendor.payment_amount IS NOT NULL AND v_vendor.payment_amount > 0 THEN
        IF v_new_amount_paid >= v_vendor.payment_amount THEN
            v_payment_status := 'Paid';
        ELSE
            v_payment_status := 'Partial';
        END IF;
    ELSE
        v_payment_status := 'Paid';
    END IF;

    UPDATE public.vendors
    SET amount_paid = v_new_amount_paid,
        payment_status = v_payment_status,
        updated_at = now()
    WHERE id = p_vendor_id AND agency_id = v_agency_id;

    INSERT INTO public.vendor_payment_history (
        vendor_id,
        agency_id,
        payment_amount,
        payment_type,
        payment_date,
        payment_mode,
        bank_name,
        notes
    ) VALUES (
        p_vendor_id,
        v_agency_id,
        p_amount,
        CASE WHEN v_new_amount_paid >= COALESCE(v_vendor.payment_amount, 0) THEN 'full' ELSE 'partial' END,
        COALESCE(p_payment_date, CURRENT_DATE),
        p_payment_mode,
        p_bank_name,
        COALESCE(p_notes, 'Payout disbursed')
    )
    RETURNING id INTO v_history_id;

    PERFORM public.create_agency_notification(
        v_agency_id,
        'Vendor Payout: ' || v_vendor.name,
        'Disbursed ' || p_payment_mode || ' payment of ₨' || TO_CHAR(p_amount, 'FM999,999,999') || ' to ' || v_vendor.name,
        'accounts',
        'vendor_due',
        '/app/bookings?tab=vendors',
        jsonb_build_object('vendor_id', p_vendor_id, 'amount', p_amount)
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_history_id,
        'vendor_id', p_vendor_id,
        'total_paid', v_new_amount_paid,
        'payment_status', v_payment_status
    );
END;
$$;


-- 7. ATOMIC FUNCTION: 1-CLICK QUERY TO BOOKING CONVERSION
CREATE OR REPLACE FUNCTION public.convert_query_to_booking_atomic(
    p_query_id UUID,
    p_selling_price NUMERIC DEFAULT NULL,
    p_amount_paid NUMERIC DEFAULT 0,
    p_payment_mode TEXT DEFAULT 'cash',
    p_vendor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_query RECORD;
    v_booking_id UUID;
    v_selling_amount NUMERIC;
BEGIN
    v_agency_id := public.current_user_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    -- Query table is public.queries
    SELECT * INTO v_query
    FROM public.queries
    WHERE id = p_query_id AND agency_id = v_agency_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Query not found or access denied';
    END IF;

    -- Check idempotency: If already converted, return existing booking
    IF v_query.converted_booking_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_converted', true,
            'booking_id', v_query.converted_booking_id
        );
    END IF;

    v_selling_amount := COALESCE(p_selling_price, 0);

    -- Insert new booking into clients table
    INSERT INTO public.clients (
        agency_id,
        name,
        contact_number,
        travel_type,
        destination,
        flight_date,
        payment_amount,
        amount_paid,
        payment_status,
        vendor_id,
        converted_from_query_id,
        notes,
        created_at,
        updated_at
    ) VALUES (
        v_agency_id,
        v_query.client_name,
        v_query.contact_number,
        'Ticket',
        NULL,
        v_query.due_date,
        v_selling_amount,
        COALESCE(p_amount_paid, 0),
        CASE 
            WHEN COALESCE(p_amount_paid, 0) >= v_selling_amount AND v_selling_amount > 0 THEN 'Paid'
            WHEN COALESCE(p_amount_paid, 0) > 0 THEN 'Partial'
            ELSE 'Pending'
        END,
        p_vendor_id,
        p_query_id,
        'Converted from Query #' || SUBSTRING(p_query_id::text, 1, 8) || COALESCE(E'\n' || v_query.query_text, '') || COALESCE(E'\n' || v_query.notes, ''),
        now(),
        now()
    )
    RETURNING id INTO v_booking_id;

    -- Update query status to completed & set converted_booking_id
    UPDATE public.queries
    SET status = 'completed',
        completed_at = now(),
        converted_booking_id = v_booking_id,
        updated_at = now()
    WHERE id = p_query_id AND agency_id = v_agency_id;

    -- If initial payment was made, record payment history
    IF COALESCE(p_amount_paid, 0) > 0 THEN
        INSERT INTO public.client_payment_history (
            client_id,
            agency_id,
            payment_amount,
            payment_type,
            payment_date,
            payment_mode,
            notes
        ) VALUES (
            v_booking_id,
            v_agency_id,
            p_amount_paid,
            CASE WHEN p_amount_paid >= v_selling_amount THEN 'full' ELSE 'partial' END,
            CURRENT_DATE,
            p_payment_mode,
            'Initial payment on query conversion'
        );
    END IF;

    -- Create notification
    PERFORM public.create_agency_notification(
        v_agency_id,
        'Query Converted to Booking',
        'Query for ' || v_query.client_name || ' was converted into Booking #' || SUBSTRING(v_booking_id::text, 1, 8),
        'travel',
        'booking',
        '/app/bookings?tab=clients',
        jsonb_build_object('booking_id', v_booking_id, 'query_id', p_query_id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'already_converted', false,
        'booking_id', v_booking_id,
        'client_name', v_query.client_name
    );
END;
$$;
