// Single source of truth: lightweight files → Supabase only
import { supabase } from '@/integrations/supabase/client';
import { getAuthenticatedAgencyId } from '@/lib/agencyContext';

/**
 * Upload lightweight files (≤5MB) to Supabase private agency-files bucket
 * Scoped under ${agencyId}/ so storage RLS strictly isolates agencies.
 * @param file - File to upload
 * @param userId - User ID metadata for filename prefixing under agencyId
 * @returns Short-lived signed URL of uploaded file
 */
export async function uploadLight(file: File, userId: string): Promise<string> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('You are offline. Cannot upload files without an active connection.');
  }

  const agencyId = await getAuthenticatedAgencyId();
  if (!agencyId) {
    throw new Error('Unable to resolve authenticated agency for file upload.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${agencyId}/${userId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from('agency-files')
    .upload(path, file);

  if (error) throw error;

  const { data, error: signError } = await supabase.storage
    .from('agency-files')
    .createSignedUrl(path, 3600);

  if (signError || !data?.signedUrl) {
    throw signError || new Error('Failed to generate signed URL for uploaded file.');
  }

  return data.signedUrl;
}

/**
 * Safe upload returning structured error instead of throwing (no silent local caching)
 */
export async function uploadLightSafe(
  file: File,
  userId: string
): Promise<{ url?: string; offline?: boolean; error?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      offline: true,
      error: 'You are offline. Connect to the internet to upload files.',
    };
  }
  try {
    const url = await uploadLight(file, userId);
    return { url };
  } catch (error: any) {
    console.error('Cloud upload failed:', error);
    return {
      offline: false,
      error: error.message || 'Cloud upload failed',
    };
  }
}
