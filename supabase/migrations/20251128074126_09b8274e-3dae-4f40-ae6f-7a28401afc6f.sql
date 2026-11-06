-- Performance Indexes for TAMS
-- These indexes dramatically speed up searches and filtering

-- Index for PNR searches (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_pnr ON clients(pnr);

-- Index for passport searches (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_passport ON clients(passport_number);

-- Index for name searches - case insensitive (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_name_lower ON clients(LOWER(name));

-- Index for phone searches (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(contact_number);

-- Index for flight date filtering (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_flight_date ON clients(flight_date);

-- Index for vendor relationships (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_vendor_id ON clients(vendor_id);

-- Index for agency_id on all tables (for RLS optimization)
CREATE INDEX IF NOT EXISTS idx_clients_agency ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_vendors_agency ON vendors(agency_id);
CREATE INDEX IF NOT EXISTS idx_expenses_agency ON expenses(agency_id);
CREATE INDEX IF NOT EXISTS idx_queries_agency ON queries(agency_id);
CREATE INDEX IF NOT EXISTS idx_bookings_agency ON bookings(agency_id);

-- Index for vendor name searches - case insensitive
CREATE INDEX IF NOT EXISTS idx_vendors_name_lower ON vendors(LOWER(name));

-- Index for expense date filtering
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- Index for expense type filtering
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);

-- Index for query status filtering
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);

-- Index for query priority filtering
CREATE INDEX IF NOT EXISTS idx_queries_priority ON queries(priority);

-- Index for booking PNR searches
CREATE INDEX IF NOT EXISTS idx_bookings_pnr ON bookings(pnr);

-- Index for booking flight date
CREATE INDEX IF NOT EXISTS idx_bookings_flight_date ON bookings(flight_date);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_clients_agency_flight_date ON clients(agency_id, flight_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendors_agency_booking_date ON vendors(agency_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_agency_date ON expenses(agency_id, expense_date DESC);