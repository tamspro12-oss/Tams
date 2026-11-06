-- Migration: Leads & Quotes Redesign: manual numbering index and booking linkage
-- Safe, additive migration that maintains full backward compatibility

DO $$
BEGIN
    -- 1. Ensure booking_id column exists on quotations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'booking_id'
    ) THEN
        ALTER TABLE public.quotations ADD COLUMN booking_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;

    -- Sync converted_booking_id to booking_id if converted_booking_id already exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'converted_booking_id'
    ) THEN
        UPDATE public.quotations 
        SET booking_id = converted_booking_id 
        WHERE booking_id IS NULL AND converted_booking_id IS NOT NULL;
    END IF;

    -- 2. Ensure converted_booking_id exists on queries as well
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'queries' AND column_name = 'converted_booking_id'
    ) THEN
        ALTER TABLE public.queries ADD COLUMN converted_booking_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;

    -- 3. Safe index on quotations per agency
    -- Check if duplicates already exist within any agency before creating unique index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename = 'quotations' 
          AND indexname = 'idx_quotations_agency_quotation_number_unique'
    ) THEN
        IF NOT EXISTS (
            SELECT agency_id, quotation_number, COUNT(*)
            FROM public.quotations
            GROUP BY agency_id, quotation_number
            HAVING COUNT(*) > 1
        ) THEN
            CREATE UNIQUE INDEX idx_quotations_agency_quotation_number_unique 
            ON public.quotations (agency_id, quotation_number);
        ELSE
            CREATE INDEX IF NOT EXISTS idx_quotations_agency_quotation_number 
            ON public.quotations (agency_id, quotation_number);
        END IF;
    END IF;
END $$;
