-- Add imkaantravels@gmail.com as admin
INSERT INTO public.user_roles (user_id, role) 
VALUES ('b9ef759f-41c8-49bc-884c-da40fb63e57e', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

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