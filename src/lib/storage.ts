import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();

/** Get a temporary signed URL for a private storage path. Cached for 45 min. */
export async function getSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path; // external URLs (Open Library, etc.)
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expires > now) return cached.url;
  const { data, error } = await supabase.storage
    .from("tomelo-media")
    .createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, expires: now + 45 * 60 * 1000 });
  return data.signedUrl;
}

/** Upload a file to the current user's folder in tomelo-media. Returns storage path. */
export async function uploadUserMedia(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("tomelo-media")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}
