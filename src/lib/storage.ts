import { supabase } from '@/integrations/supabase/client';

export interface UploadOptions {
  bucket: string;
  folder?: string;
  file: File;
  onProgress?: (progress: number) => void;
  signedUrl?: boolean;
}

export interface UploadResult {
  url: string;
  path: string;
  fullPath: string;
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  const { bucket, folder, file, signedUrl = false } = options;

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = signedUrl
    ? await supabase.storage.from(bucket).createSignedUrl(filePath, 3600)
    : supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    url: signedUrl ? urlData.signedUrl : urlData.publicUrl,
    path: filePath,
    fullPath: data.path,
  };
}

/**
 * Upload multiple files
 */
export async function uploadMultipleFiles(
  bucket: string,
  files: File[],
  folder?: string
): Promise<UploadResult[]> {
  return Promise.all(files.map((file) => uploadFile({ bucket, folder, file })));
}

/**
 * Delete file from storage
 */
export async function deleteFile(bucket: string, path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error('Delete error:', error);
    return false;
  }
  return true;
}

/**
 * Get signed URL for private files
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * List files in a folder
 */
export async function listFiles(bucket: string, folder?: string) {
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) throw error;
  return data;
}
