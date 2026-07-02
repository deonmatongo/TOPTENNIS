import { supabase } from '@/services/supabase';

/**
 * Upload chat media (images / voice notes) and return a public URL.
 *
 * Prefers the dedicated `chat-media` bucket. If that bucket hasn't been
 * created yet (the backend migration is pending), falls back to the
 * `profile-pictures` bucket, whose RLS allows authenticated users to write
 * under their own `{userId}/...` folder — so chat media lands in
 * `{userId}/chat/...` there.
 */
export async function uploadChatMedia(
  userId: string,
  localUri: string,
  kind: 'image' | 'voice',
  ext?: string,
): Promise<string> {
  const extension = (ext ?? localUri.split('.').pop()?.split('?')[0] ?? (kind === 'voice' ? 'm4a' : 'jpg')).toLowerCase();
  const contentType = kind === 'voice' ? 'audio/m4a' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  const filename = `${Date.now()}.${extension}`;

  const res = await fetch(localUri);
  const blob = await res.blob();

  // Preferred: chat-media/{kind}s/{userId}/file
  const primaryPath = `${kind === 'voice' ? 'voice' : 'messages'}/${userId}/${filename}`;
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
// URL-only messages from hosts that always serve images (our storage buckets,
// unsplash) count as images even without a file extension in the path.
const IMAGE_HOST_RE = /^https?:\/\/(images\.unsplash\.com\/|\S+\/storage\/v1\/object\/public\/(chat-media|profile-pictures)\/)/i;
const VOICE_PREFIX = '🎤 ';

export function isImageMessage(content: string): boolean {
  const c = content.trim();
  if (/\s/.test(c) || !/^https?:\/\//i.test(c)) return false;
  return IMAGE_EXT_RE.test(c) || IMAGE_HOST_RE.test(c);
}

export function parseVoiceMessage(content: string): string | null {
  if (!content.startsWith(VOICE_PREFIX)) return null;
  const url = content.slice(VOICE_PREFIX.length).trim();
  return /^https?:\/\//.test(url) ? url : null;
}
