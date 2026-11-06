// Single source of truth: lightweight files → Supabase only
import { supabase } from '@/integrations/supabase/client';

/**
 * Upload lightweight files (≤5MB) to Supabase storage
 * @param file - File to upload
 * @param userId - User ID for path isolation
 * @returns Public URL of uploaded file
 */
export async function uploadLight(file: File, userId: string): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
  
  const { error } = await supabase.storage
    .from('agency-files')
    .upload(path, file);
  
  if (error) throw error;
  
  const { data } = supabase.storage
    .from('agency-files')
    .getPublicUrl(path);
  
  return data.publicUrl;
}

/**
 * Safe upload with offline fallback
 * @param file - File to upload
 * @param userId - User ID for path isolation
 * @returns Promise with upload result
 */
export async function uploadLightSafe(
  file: File, 
  userId: string
): Promise<{ url?: string; offline?: boolean; error?: string }> {
  try {
    const url = await uploadLight(file, userId);
    return { url };
  } catch (error: any) {
    console.error('Cloud upload failed:', error);
    return { 
      offline: true, 
      error: error.message || 'Upload failed - will retry when online' 
    };
  }
}
