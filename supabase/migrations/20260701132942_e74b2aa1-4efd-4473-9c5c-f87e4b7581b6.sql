
-- Files: agency-scoped DELETE and UPDATE for regular users
CREATE POLICY "Agency members can delete their agency files"
ON public.files
FOR DELETE
TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Agency members can update their agency files"
ON public.files
FOR UPDATE
TO authenticated
USING (agency_id = public.current_user_agency_id())
WITH CHECK (agency_id = public.current_user_agency_id());

-- Invoices: UPDATE policy mirroring INSERT permission check
CREATE POLICY "Agency members with write permission can update invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  AND public.has_module_permission(auth.uid(), 'invoices', 'write')
)
WITH CHECK (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  AND public.has_module_permission(auth.uid(), 'invoices', 'write')
);
