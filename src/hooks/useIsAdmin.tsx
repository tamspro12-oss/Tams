import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isMasterAdminEmail, verifyMasterAdminStatus } from '@/lib/adminAuth';

export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAdminRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || !isMounted) {
          if (isMounted) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        // Strict Master Admin Email Whitelist check (usmn4u@gmail.com)
        if (isMasterAdminEmail(user.email)) {
          if (isMounted) {
            setIsAdmin(true);
            setLoading(false);
          }
          return;
        }

        // Database role verification check (is_super_admin / has_role)
        const isMaster = await verifyMasterAdminStatus(user);
        if (isMounted) {
          setIsAdmin(isMaster);
        }
      } catch (error) {
        console.error('Error in admin check:', error);
        if (isMounted) {
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAdminRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (!session?.user) {
        setIsAdmin(false);
        setLoading(false);
      } else {
        checkAdminRole();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, isMasterAdmin: isAdmin, loading };
};
