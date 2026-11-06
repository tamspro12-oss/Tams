import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const CURRENT_PRIVACY_VERSION = '2025-11-25';
const CURRENT_TERMS_VERSION = '2025-11-25';

interface PolicyAcknowledgment {
  id: string;
  user_id: string;
  privacy_policy_version: string;
  terms_version: string;
  acknowledged_at: string;
  created_at: string;
}

export const usePolicyAcknowledgment = () => {
  const { user } = useAuth();
  const [acknowledgment, setAcknowledgment] = useState<PolicyAcknowledgment | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAcknowledgment, setNeedsAcknowledgment] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchAcknowledgment();
  }, [user]);

  const fetchAcknowledgment = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('policy_acknowledgments')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setAcknowledgment(data);

      // Check if acknowledgment is needed (no record or outdated version)
      if (!data) {
        setNeedsAcknowledgment(true);
      } else if (
        data.privacy_policy_version !== CURRENT_PRIVACY_VERSION ||
        data.terms_version !== CURRENT_TERMS_VERSION
      ) {
        setNeedsAcknowledgment(true);
      } else {
        setNeedsAcknowledgment(false);
      }
    } catch (error) {
      console.error('Error fetching policy acknowledgment:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAcknowledgment = async () => {
    if (!user) return false;

    try {
      // Check if acknowledgment exists
      if (acknowledgment) {
        // Update existing
        const { error } = await supabase
          .from('policy_acknowledgments')
          .update({
            privacy_policy_version: CURRENT_PRIVACY_VERSION,
            terms_version: CURRENT_TERMS_VERSION,
            acknowledged_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('policy_acknowledgments')
          .insert({
            user_id: user.id,
            privacy_policy_version: CURRENT_PRIVACY_VERSION,
            terms_version: CURRENT_TERMS_VERSION,
          });

        if (error) throw error;
      }

      // Refresh acknowledgment
      await fetchAcknowledgment();
      return true;
    } catch (error) {
      console.error('Error saving policy acknowledgment:', error);
      return false;
    }
  };

  return {
    acknowledgment,
    loading,
    needsAcknowledgment,
    saveAcknowledgment,
    currentVersions: {
      privacy: CURRENT_PRIVACY_VERSION,
      terms: CURRENT_TERMS_VERSION,
    },
  };
};
