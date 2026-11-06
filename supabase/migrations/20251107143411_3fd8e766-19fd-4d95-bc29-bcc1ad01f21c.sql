-- Enable full row tracking for realtime updates
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.vendors REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.client_payment_history REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_payment_history REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;