-- Add critical performance indexes for scalability

-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_flight_date ON public.clients(flight_date);
CREATE INDEX IF NOT EXISTS idx_clients_payment_status ON public.clients(payment_status);
CREATE INDEX IF NOT EXISTS idx_clients_agency_id_flight_date ON public.clients(agency_id, flight_date);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at);

-- Bookings table indexes
CREATE INDEX IF NOT EXISTS idx_bookings_flight_date ON public.bookings(flight_date);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_agency_id_flight_date ON public.bookings(agency_id, flight_date);

-- Queries table indexes
CREATE INDEX IF NOT EXISTS idx_queries_status ON public.queries(status);
CREATE INDEX IF NOT EXISTS idx_queries_priority ON public.queries(priority);
CREATE INDEX IF NOT EXISTS idx_queries_agency_id_status ON public.queries(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_queries_due_date ON public.queries(due_date);

-- Expenses table indexes
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_type ON public.expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_agency_id_date ON public.expenses(agency_id, expense_date);

-- Vendors table indexes
CREATE INDEX IF NOT EXISTS idx_vendors_payment_status ON public.vendors(payment_status);
CREATE INDEX IF NOT EXISTS idx_vendors_service_type ON public.vendors(service_type);
CREATE INDEX IF NOT EXISTS idx_vendors_agency_id_payment_status ON public.vendors(agency_id, payment_status);

-- Payment history indexes
CREATE INDEX IF NOT EXISTS idx_client_payment_history_payment_date ON public.client_payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_client_payment_history_client_id_date ON public.client_payment_history(client_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_history_payment_date ON public.vendor_payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_history_vendor_id_date ON public.vendor_payment_history(vendor_id, payment_date);

-- Comment explaining the performance impact
COMMENT ON INDEX idx_clients_flight_date IS 'Speeds up dashboard queries filtering by flight date';
COMMENT ON INDEX idx_queries_status IS 'Optimizes active/pending queries filtering';
COMMENT ON INDEX idx_expenses_expense_date IS 'Improves date range queries in reports';