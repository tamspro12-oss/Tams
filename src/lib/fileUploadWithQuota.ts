import { supabase } from "@/integrations/supabase/client";

export interface UploadFileOptions {
  file: File;
  path: string;
  isTemporary?: boolean;
  expiresInHours?: number;
}

export interface UploadFileResult {
  success: boolean;
  path?: string;
  fileId?: string;
  error?: string;
}

/**
 * Upload file with quota checking and metadata tracking
 */
export async function uploadFileWithQuota(
  options: UploadFileOptions
): Promise<UploadFileResult> {
  const { file, path, isTemporary = false, expiresInHours = 1 } = options;

  try {
    // Get current user and agency
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .single();

    if (!profile?.agency_id) {
      return { success: false, error: "Agency not found" };
    }

    // Check quota
    const { data: canUpload, error: quotaError } = await supabase.rpc('can_upload_file', {
      p_agency_id: profile.agency_id,
      p_file_size: file.size
    });

    if (quotaError) {
      console.error("Quota check error:", quotaError);
      return { success: false, error: "Failed to check storage quota" };
    }

    if (!canUpload) {
      return { 
        success: false, 
        error: "Storage quota exceeded. Please delete old files or upgrade your plan." 
      };
    }

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('agency-files')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { success: false, error: uploadError.message };
    }

    // Calculate expiration time for temporary files
    const expiresAt = isTemporary 
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    // Insert metadata into files table
    const { data: fileRecord, error: metadataError } = await supabase
      .from("files")
      .insert({
        agency_id: profile.agency_id,
        path: uploadData.path,
        filename: file.name,
        size_bytes: file.size,
        uploaded_by: user.id,
        is_temporary: isTemporary,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (metadataError) {
      console.error("Metadata error:", metadataError);
      // Delete uploaded file if metadata insert fails
      await supabase.storage.from('agency-files').remove([uploadData.path]);
      return { success: false, error: "Failed to save file metadata" };
    }

    return {
      success: true,
      path: uploadData.path,
      fileId: fileRecord.id
    };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: error.message || "Upload failed" };
  }
}

/**
 * Delete file and its metadata
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  try {
    // Get file metadata
    const { data: file, error: fetchError } = await supabase
      .from("files")
      .select("path")
      .eq("id", fileId)
      .single();

    if (fetchError || !file) {
      console.error("Fetch error:", fetchError);
      return false;
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('agency-files')
      .remove([file.path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      return false;
    }

    // Delete metadata
    const { error: metadataError } = await supabase
      .from("files")
      .delete()
      .eq("id", fileId);

    if (metadataError) {
      console.error("Metadata delete error:", metadataError);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Delete error:", error);
    return false;
  }
}

/**
 * Get signed URL for file download
 */
export async function getFileDownloadUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('agency-files')
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error("Signed URL error:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Get URL error:", error);
    return null;
  }
}