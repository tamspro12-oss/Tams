# Supabase Migrations — Important Safety Instructions (DO NOT RE-RUN OLD FILES)

> **CRITICAL WARNING:** This folder contains historical migrations already applied to the live TAMS Pro production database. **NEVER re-run old migration files** on the live database!

## Dangerous Files to NEVER Re-Run on Production
Re-running certain historical files would overwrite newer security patches, re-enable email auto-confirmation bypasses, or weaken Row Level Security (RLS):

1. **`20261111_auth_email_verification_and_activation.sql`** (and `20261112_COMPLETE_ALL_IN_ONE_FIX.sql`)
   - Contains the old `trg_auto_confirm_agency_signup` trigger on `auth.users` that **bypasses email verification**, plus an `anon`-accessible `verify_agency_account_fallback` signature that was later restricted in `20261114_01` and `20261116_01`.
2. **`20261111_strict_master_admin_rbac.sql` / `20261111_admin_registered_users_and_lifetime_access.sql`**
   - Replaced by `20261114_00_add_super_admin_enum.sql` and `20261114_01_rbac_and_strict_agency_isolation.sql`. Re-running them restores legacy role checks.
3. **`20261114_01_rbac_and_strict_agency_isolation.sql`**
   - Re-running `20261114_01` after `20261115_01` / `20261116_01` **undoes later security fixes**:
     - It resets `agencies_update_own_or_super_admin` back to allowing any agency member (not just owner/admin) to update `agencies`.
     - It recreates older versions of helpers replaced in `20261115_01` and `20261116_01`.
4. **`../archive_do_not_run/combined_migrations.sql`**
   - Historical snapshot from early November; lacks `20261107`–`20261116` unification and hardening migrations. Only kept in `archive_do_not_run/` for reference.

## Safe Chronological Migration Order (For a Fresh Database Only)
On an existing production database, **only run newly added files** (such as `20261116_01_safe_fixes.sql`).

For reference on a brand-new database:
1. `20251101*` through `20260823*` (core tables, multi-agency base, column-level email/license revokes)
2. `20261106*` through `20261109*` (B2B tables, vouchers/reminders, unified accounting schema & numbering base)
3. `20261111*` and `20261112*` (historical patches — superseded below)
4. `20261114_00_add_super_admin_enum.sql` *(must commit in its own transaction before `20261114_01` uses the `'super_admin'` enum value)*
5. `20261114_01_rbac_and_strict_agency_isolation.sql`
6. `20261114_02_accounting_unification_rpcs_and_realtime.sql`
7. `20261114_03_signup_agency_email.sql`
8. `20261115_01_hardening_all_forms_and_atomic_numbering.sql`
9. **`20261116_01_safe_fixes.sql`** *(current additive hardening migration)*
