-- Allow admins to view all agencies
CREATE POLICY "Admins can view all agencies"
ON public.agencies FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update all agencies
CREATE POLICY "Admins can update all agencies"
ON public.agencies FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));