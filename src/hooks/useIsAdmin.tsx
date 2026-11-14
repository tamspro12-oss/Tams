import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { verifySuperAdminStatus } from '@/lib/adminAuth';

export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAdminRole = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user || !isMounted) {
          if (isMounted) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        const isSuperAdmin = await verifySuperAdminStatus(user.id);
        if (isMounted) {
          setIsAdmin(isSuperAdmin);
        }
      } catch (error) {
        console.error('[useIsAdmin] Role verification failed:', error);
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
        setLoading(true);
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
