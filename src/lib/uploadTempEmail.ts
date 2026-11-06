// Temporary PDF storage for email (24h TTL)
import { supabase } from '@/integrations/supabase/client';

/**
 * Upload temporary PDF for email attachment (auto-deletes after 24h)
 * @param file - PDF file to upload
 * @param userId - User ID for path isolation
 * @returns Public URL of uploaded file
 */
export async function uploadTempEmail(file: File | Blob, userId: string): Promise<string> {
  const path = `${userId}/temp-email/${crypto.randomUUID()}.pdf`;
  
  const { error: uploadError } = await supabase.storage
    .from('tams-temp-email')
    .upload(path, file);
  
  if (uploadError) throw uploadError;
  
  const { data } = supabase.storage
    .from('tams-temp-email')
    .getPublicUrl(path);
  
  return data.publicUrl;
}

/**
 * Delete temporary email file after sending
 * @param fileUrl - Public URL of the file to delete
 */
export async function deleteTempEmail(fileUrl: string): Promise<void> {
  try {
    // Extract path from URL
    const urlParts = fileUrl.split('/storage/v1/object/public/tams-temp-email/');
    if (urlParts.length !== 2) return;
    
    const path = urlParts[1];
    
    const { error } = await supabase.storage
      .from('tams-temp-email')
      .remove([path]);
    
    if (error) {
      console.error('Failed to delete temp file:', error);
      // Log for admin cleanup but don't throw
    }
  } catch (error) {
    console.error('Error deleting temp file:', error);
  }
}

/**
 * Check if temporary file exists before use
 * @param fileUrl - Public URL to check
 * @returns boolean indicating if file exists
 */
export async function checkTempFileExists(fileUrl: string): Promise<boolean> {
  try {
    const urlParts = fileUrl.split('/storage/v1/object/public/tams-temp-email/');
    if (urlParts.length !== 2) return false;
    
    const path = urlParts[1];
    
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
