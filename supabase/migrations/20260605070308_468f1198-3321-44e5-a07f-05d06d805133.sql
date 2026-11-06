-- 1. Block sub-users from modifying financial tables (b2b_ledger, cash_bank_entries, opening_balances, refunds)
-- b2b_ledger
DROP POLICY IF EXISTS "Users can insert ledger in their agency" ON public.b2b_ledger;
DROP POLICY IF EXISTS "Users can update ledger in their agency" ON public.b2b_ledger;
DROP POLICY IF EXISTS "Users can delete ledger in their agency" ON public.b2b_ledger;

CREATE POLICY "Users can insert ledger in their agency" ON public.b2b_ledger
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users can update ledger in their agency" ON public.b2b_ledger
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users can delete ledger in their agency" ON public.b2b_ledger
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));

-- cash_bank_entries
DROP POLICY IF EXISTS "Users can insert their agency cash_bank_entries" ON public.cash_bank_entries;
DROP POLICY IF EXISTS "Users can update their agency cash_bank_entries" ON public.cash_bank_entries;
DROP POLICY IF EXISTS "Users can delete their agency cash_bank_entries" ON public.cash_bank_entries;

CREATE POLICY "Users can insert their agency cash_bank_entries" ON public.cash_bank_entries
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users can update their agency cash_bank_entries" ON public.cash_bank_entries
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users can delete their agency cash_bank_entries" ON public.cash_bank_entries
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));

-- opening_balances
DROP POLICY IF EXISTS "Users insert opening balances in their agency" ON public.opening_balances;
DROP POLICY IF EXISTS "Users update opening balances in their agency" ON public.opening_balances;
DROP POLICY IF EXISTS "Users delete opening balances in their agency" ON public.opening_balances;

CREATE POLICY "Users insert opening balances in their agency" ON public.opening_balances
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users update opening balances in their agency" ON public.opening_balances
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users delete opening balances in their agency" ON public.opening_balances
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));

-- refunds
DROP POLICY IF EXISTS "Users insert refunds in their agency" ON public.refunds;
DROP POLICY IF EXISTS "Users update refunds in their agency" ON public.refunds;
DROP POLICY IF EXISTS "Users delete refunds in their agency" ON public.refunds;

CREATE POLICY "Users insert refunds in their agency" ON public.refunds
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users update refunds in their agency" ON public.refunds
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users delete refunds in their agency" ON public.refunds
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));

-- 2. Revoke EXECUTE on backend-only SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_active_session_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_active_sessions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_user_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_all_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_sub_users(uuid) FROM PUBLIC, anon, authenticated;

-- Also tighten anon access on RLS helpers (only authenticated needs them)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_agency_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_sub_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_main_user_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_upload_file(uuid, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_agency_storage_usage(uuid) FROM PUBLIC, anon;

-- 3. Remove column-level read access on agencies.email_password from regular users
-- Keep service_role full access (edge functions). Admins retain ALL via existing role.
REVOKE SELECT (email_password) ON public.agencies FROM anon, authenticated;
