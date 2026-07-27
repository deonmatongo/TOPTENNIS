import { supabase } from '@/services/supabase';

export async function uploadChatMedia(
  userId: string,
  localUri: string,
  ext?: string,
): Promise<string> {
  const extension = (ext ?? localUri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase();
  const contentType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  const filename = `${Date.now()}.${extension}`;

  const res = await fetch(localUri);
  const blob = await res.blob();

  // Preferred: chat-media/messages/{userId}/file
  const primaryPath = `messages/${userId}/${filename}`;
  const primary = await supabase.storage
    .from('chat-media')
    .upload(primaryPath, blob, { contentType, upsert: false });

  if (!primary.error) {
    return supabase.storage.from('chat-media').getPublicUrl(primaryPath).data.publicUrl;
  }

  const msg = String(primary.error.message || '').toLowerCase();
  if (!msg.includes('bucket')) throw primary.error;

  // Fallback: profile-pictures/{userId}/chat/file (policy: first folder = uid)
  const fallbackPath = `${userId}/chat/${filename}`;
  const fallback = await supabase.storage
    .from('profile-pictures')
    .upload(fallbackPath, blob, { contentType, upsert: false });
  if (fallback.error) throw fallback.error;

  return supabase.storage.from('profile-pictures').getPublicUrl(fallbackPath).data.publicUrl;
}

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic)(\?\S*)?$/i;
const IMAGE_HOST_RE = /^https?:\/\/(images\.unsplash\.com\/|\S+\/storage\/v1\/object\/public\/(chat-media|profile-pictures)\/)/i;

export function isImageMessage(content: string): boolean {
  const c = content.trim();
  if (/\s/.test(c) || !/^https?:\/\//i.test(c)) return false;
  return IMAGE_EXT_RE.test(c) || IMAGE_HOST_RE.test(c);
}
