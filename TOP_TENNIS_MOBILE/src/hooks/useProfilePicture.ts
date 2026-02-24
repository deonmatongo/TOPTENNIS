import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';

export function useProfilePicture() {
  const { user } = useAuth();
  const { updatePlayerProfile } = usePlayerProfile();
  const [uploading, setUploading] = useState(false);

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
      const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, blob, {
          contentType: asset.mimeType || `image/${ext}`,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(data.path);

      await updatePlayerProfile({ profile_picture_url: publicUrl });
      await supabase.from('profiles').update({ profile_picture_url: publicUrl }).eq('id', user.id);

      return publicUrl;
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
      const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, blob, {
          contentType: asset.mimeType || `image/${ext}`,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(data.path);

      await updatePlayerProfile({ profile_picture_url: publicUrl });
      await supabase.from('profiles').update({ profile_picture_url: publicUrl }).eq('id', user.id);

      return publicUrl;
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
