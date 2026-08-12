import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

// iOS often returns HEIC/HEIF. The bucket allows only common web formats,
// so we normalise anything unrecognised to JPEG before uploading.
function normaliseMime(raw: string | undefined): { mime: string; ext: string } {
  if (raw && ALLOWED_MIME.has(raw)) {
    const ext = raw === 'image/jpg' ? 'jpg' : raw.split('/')[1];
    return { mime: raw, ext };
  }
  return { mime: 'image/jpeg', ext: 'jpg' };
}

export function useProfilePicture() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const { mime, ext } = normaliseMime(asset.mimeType);
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    // arrayBuffer() is more reliable than blob() in React Native's fetch polyfill.
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error(`Could not read image (status ${response.status})`);
    const arrayBuffer = await response.arrayBuffer();

    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .upload(fileName, arrayBuffer, {
        contentType: mime,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(data.path);

    // Append a bust param so React Native's image cache never reuses
    // a previous render for this account's avatar slot.
    const url = `${publicUrl}?t=${Date.now()}`;

    // Update profiles directly — doesn't require the player row to be loaded
    // in a separate hook instance, which can race against the upload.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ profile_picture_url: url })
      .eq('id', user.id);
    if (profileError) throw profileError;

    return url;
  };

  const pickAndUpload = async (): Promise<string | null> => {
    if (!user) return null;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to upload a profile picture.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];

    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('File too large', 'Please choose an image smaller than 5MB.');
      return null;
    }

    setUploading(true);
    try {
      return await uploadAsset(asset);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not upload image. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const takeAndUpload = async (): Promise<string | null> => {
    if (!user) return null;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to take a profile photo.');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];
    setUploading(true);
    try {
      return await uploadAsset(asset);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not upload image. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const showPicker = (onDone?: (url: string) => void) => {
    Alert.alert('Profile Photo', 'Choose a photo source', [
      {
        text: 'Camera',
        onPress: async () => {
          const url = await takeAndUpload();
          if (url) onDone?.(url);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const url = await pickAndUpload();
          if (url) onDone?.(url);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return { uploading, showPicker, pickAndUpload, takeAndUpload };
}
