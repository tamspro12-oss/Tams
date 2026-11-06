-- Allow users to delete clients in their own agency (needed for cascade delete to work)
DROP POLICY IF EXISTS "Users can delete clients in their agency" ON public.clients;
CREATE POLICY "Users can delete clients in their agency" 
ON public.clients 
FOR DELETE 
USING (
  agency_id IN (
    SELECT profiles.agency_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
);

-- Allow users to delete vendors in their own agency  
DROP POLICY IF EXISTS "Users can delete vendors in their agency" ON public.vendors;
CREATE POLICY "Users can delete vendors in their agency" 
ON public.vendors 
FOR DELETE 
USING (
  agency_id IN (
    SELECT profiles.agency_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
);

-- Keep admin policies for backward compatibility
-- Admin policy for clients
CREATE POLICY "Admins can delete all clients" 
ON public.clients 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin policy for vendors
CREATE POLICY "Admins can delete all vendors" 
ON public.vendors 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));