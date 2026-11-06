-- Security Hardening: Add sub-user permission enforcement to RLS policies
-- This ensures sub-users can only perform actions they have explicit permissions for

-- =====================================================
-- CLIENTS TABLE - Permission-based policies
-- =====================================================

-- Update INSERT policy to require write permission
DROP POLICY IF EXISTS "Users can insert clients in their agency" ON public.clients;
CREATE POLICY "Users can insert clients in their agency" 
ON public.clients FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'write')
);

-- Update UPDATE policy to require write permission
DROP POLICY IF EXISTS "Users can update clients in their agency" ON public.clients;
CREATE POLICY "Users can update clients in their agency" 
ON public.clients FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'write')
);

-- Update DELETE policy to require delete permission (non-admin)
DROP POLICY IF EXISTS "Users can delete clients in their agency" ON public.clients;
CREATE POLICY "Users can delete clients in their agency" 
ON public.clients FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'delete')
);

-- =====================================================
-- VENDORS TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert vendors in their agency" ON public.vendors;
CREATE POLICY "Users can insert vendors in their agency" 
ON public.vendors FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'write')
);

DROP POLICY IF EXISTS "Users can update vendors in their agency" ON public.vendors;
CREATE POLICY "Users can update vendors in their agency" 
ON public.vendors FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'write')
);

DROP POLICY IF EXISTS "Users can delete vendors in their agency" ON public.vendors;
CREATE POLICY "Users can delete vendors in their agency" 
ON public.vendors FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'delete')
);

-- =====================================================
-- BOOKINGS TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert bookings in their agency" ON public.bookings;
CREATE POLICY "Users can insert bookings in their agency" 
ON public.bookings FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'bookings', 'write')
);

DROP POLICY IF EXISTS "Users can update bookings in their agency" ON public.bookings;
CREATE POLICY "Users can update bookings in their agency" 
ON public.bookings FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'bookings', 'write')
);

-- Add DELETE policy for bookings (requires delete permission)
CREATE POLICY "Users can delete bookings in their agency" 
ON public.bookings FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'bookings', 'delete')
);

-- =====================================================
-- EXPENSES TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert expenses in their agency" ON public.expenses;
CREATE POLICY "Users can insert expenses in their agency" 
ON public.expenses FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'expenses', 'write')
);

DROP POLICY IF EXISTS "Users can update expenses in their agency" ON public.expenses;
CREATE POLICY "Users can update expenses in their agency" 
ON public.expenses FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'expenses', 'write')
);

-- Add DELETE policy for expenses (requires delete permission)
CREATE POLICY "Users can delete expenses in their agency" 
ON public.expenses FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'expenses', 'delete')
);

-- =====================================================
-- QUERIES TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert queries in their agency" ON public.queries;
CREATE POLICY "Users can insert queries in their agency" 
ON public.queries FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'queries', 'write')
);

DROP POLICY IF EXISTS "Users can update queries in their agency" ON public.queries;
CREATE POLICY "Users can update queries in their agency" 
ON public.queries FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'queries', 'write')
);

DROP POLICY IF EXISTS "Users can delete queries in their agency" ON public.queries;
CREATE POLICY "Users can delete queries in their agency" 
ON public.queries FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'queries', 'delete')
);

-- =====================================================
-- CLIENT PAYMENT HISTORY - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert payment history in their agency" ON public.client_payment_history;
CREATE POLICY "Users can insert payment history in their agency" 
ON public.client_payment_history FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'write')
);

DROP POLICY IF EXISTS "Users can update payment history in their agency" ON public.client_payment_history;
CREATE POLICY "Users can update payment history in their agency" 
ON public.client_payment_history FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'write')
);

-- =====================================================
-- VENDOR PAYMENT HISTORY - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert vendor payment history in their agency" ON public.vendor_payment_history;
CREATE POLICY "Users can insert vendor payment history in their agency" 
ON public.vendor_payment_history FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'write')
);

DROP POLICY IF EXISTS "Users can update vendor payment history in their agency" ON public.vendor_payment_history;
CREATE POLICY "Users can update vendor payment history in their agency" 
ON public.vendor_payment_history FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'write')
);

-- =====================================================
-- INVOICES TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert invoices in their agency" ON public.invoices;
CREATE POLICY "Users can insert invoices in their agency" 
ON public.invoices FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND generated_by = auth.uid()
  AND has_module_permission(auth.uid(), 'invoices', 'write')
);