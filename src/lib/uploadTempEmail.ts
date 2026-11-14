// Temporary PDF storage for email (24h TTL)
import { supabase } from '@/integrations/supabase/client';
import { getAuthenticatedAgencyId } from '@/lib/agencyContext';

function extractTempEmailStoragePath(fileUrl: string): string | null {
  try {
    const cleanUrl = fileUrl.split('?')[0];
    const markers = [
      '/storage/v1/object/sign/tams-temp-email/',
      '/storage/v1/object/public/tams-temp-email/',
      '/storage/v1/object/authenticated/tams-temp-email/',
    ];
    for (const marker of markers) {
      const idx = cleanUrl.indexOf(marker);
      if (idx !== -1) {
        return decodeURIComponent(cleanUrl.slice(idx + marker.length));
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Upload temporary PDF for email attachment (auto-deletes after 24h)
 * Path is prefixed with ${agencyId}/ so storage RLS strictly isolates agencies.
 */
export async function uploadTempEmail(file: File | Blob, userId: string): Promise<string> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('You are offline. Cannot upload temporary email attachment.');
  }

  const agencyId = await getAuthenticatedAgencyId();
  if (!agencyId) {
    throw new Error('Unable to resolve authenticated agency for temporary upload.');
  }

  const path = `${agencyId}/${userId}/temp-email/${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('tams-temp-email')
    .upload(path, file);

  if (uploadError) throw uploadError;

  const { data, error: signError } = await supabase.storage
    .from('tams-temp-email')
    .createSignedUrl(path, 3600);

  if (signError || !data?.signedUrl) {
    throw signError || new Error('Failed to create signed URL for temporary email PDF.');
  }

  return data.signedUrl;
}

/**
 * Delete temporary email file after sending
 * @param fileUrl - Signed or storage URL of the file to delete
 */
export async function deleteTempEmail(fileUrl: string): Promise<void> {
  try {
    const path = extractTempEmailStoragePath(fileUrl);
    if (!path) return;

    const { error } = await supabase.storage
      .from('tams-temp-email')
      .remove([path]);

    if (error) {
      console.error('Failed to delete temp file:', error);
    }
  } catch (error) {
    console.error('Error deleting temp file:', error);
  }
}

/**
 * Check if temporary file exists before use
 * @param fileUrl - Signed or storage URL to check
 * @returns boolean indicating if file exists
 */
export async function checkTempFileExists(fileUrl: string): Promise<boolean> {
  try {
    const path = extractTempEmailStoragePath(fileUrl);
    if (!path) return false;

    const { data, error } = await supabase.storage
      .from('tams-temp-email')
      .list(path.split('/').slice(0, -1).join('/'));

    if (error) return false;

    const fileName = path.split('/').pop();
    return data?.some(f => f.name === fileName) ?? false;
  } catch {
    return false;
  }
}
