import React, { useState, useEffect } from 'react';
import { View, Modal, Pressable, Image, Alert, ScrollView, KeyboardAvoidingView, Platform, ActionSheetIOS, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Camera, X, User as UserIcon, Check, Activity, Heart, Sparkles, Plus, ImageIcon, FileUp, Trash2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { updateProfileThunk, User } from '@/src/features/auth/store/authSlice';
import { SheetGrabHandle } from '@/components/ui/SheetGrabHandle';
import { ThemeToggleSwitch } from '@/components/settings/ThemeToggleSwitch';
import { useSettings } from '@/src/features/settings/hooks/useSettings';
import { getImageUrl } from '@/src/utils/imageUrl';

export interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: User | null;
  userPulse?: any;
  userInterests?: string[];
  masterInterests?: any[];
  onCreatePulse?: () => void;
  onSaveInterests?: (interests: string[]) => void;
  t?: (key: string, fallback?: string) => string;
}

export const EditProfileModal = ({
  visible,
  onClose,
  user,
  userPulse,
  userInterests = [],
  masterInterests = [],
  onCreatePulse,
  onSaveInterests,
  t,
}: EditProfileModalProps) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode } = useSettings();
  const translate = t || ((_, fb) => fb || '');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      const uAny = user as any;
      const initialName = user.name || user.username || uAny.fullName || (user.email ? user.email.split('@')[0] : '');
      const initialEmail = user.email || uAny.emailAddress || '';
      const initialPhone = user.phone || uAny.phoneNumber || uAny.mobile || '';
      const initialAvatar = user.avatar || uAny.avatarUrl || null;

      setUsername(initialName);
      setEmail(initialEmail);
      setPhone(initialPhone);
      setAvatarUri(initialAvatar);
    }
    if (visible && userInterests) {
      setSelectedInterests(userInterests);
    }
  }, [user, userInterests, visible]);

  // Launch Camera to take photo
  const handleTakePhoto = async () => {
    setShowPhotoOptions(false);
    try {
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to take a profile photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Error capturing photo:', err);
    }
  };

  // Choose from Gallery
  const handleChooseFromGallery = async () => {
    setShowPhotoOptions(false);
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Photo library access is needed to select a profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Error picking image:', err);
    }
  };

  // Choose from Device files
  const handlePickDocument = async () => {
    setShowPhotoOptions(false);
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            const objectUrl = URL.createObjectURL(file);
            setAvatarUri(objectUrl);
          }
        };
        input.click();
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Error picking document file:', err);
    }
  };

  // Remove photo and restore default
  const handleRemovePhoto = () => {
    setShowPhotoOptions(false);
    setAvatarUri(null);
  };

  // Show photo source picker
  const handleChangePhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery', 'Upload from device', 'Remove photo'],
          destructiveButtonIndex: 4,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleTakePhoto();
          else if (buttonIndex === 2) handleChooseFromGallery();
          else if (buttonIndex === 3) handlePickDocument();
          else if (buttonIndex === 4) handleRemovePhoto();
        }
      );
    } else {
      setShowPhotoOptions(true);
    }
  };

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter((item) => item !== id));
    } else {
      if (selectedInterests.length >= 5) {
        Alert.alert('Limit Reached', 'You can select up to 5 community interests.');
        return;
      }
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Please enter your name.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await dispatch(
        updateProfileThunk({
          username: username.trim(),
          name: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          avatar: avatarUri || undefined,
          removeAvatar: avatarUri === null,
        }) as any
      );
      if (res.meta?.requestStatus === 'fulfilled') {
        if (onSaveInterests) {
          onSaveInterests(selectedInterests);
        }
        Alert.alert(
          translate('success', 'Success'),
          translate('profile_updated', 'Profile updated successfully!')
        );
        onClose();
      } else {
        const msg = res.payload || 'Failed to update profile';
        Alert.alert(translate('error', 'Error'), String(msg));
      }
    } catch (err: any) {
      Alert.alert(translate('error', 'Error'), err?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent={true} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        className="flex-1 justify-end bg-black/50"
      >
        <Pressable className="absolute inset-0" onPress={onClose} />

        <View className="bg-card rounded-t-3xl overflow-hidden" style={{ maxHeight: '88%' }}>
          {/* Grab Handle */}
          <SheetGrabHandle onClose={onClose} />

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pb-3 border-b border-border">
            <Text className="text-lg font-bold text-foreground">
              {translate('edit_profile', 'Edit Profile')}
            </Text>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 rounded-full bg-muted/60 items-center justify-center"
            >
              <X size={16} className="text-foreground" />
            </Pressable>
          </View>

          {/* Scrollable Form */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar with Camera/Gallery option */}
            <View className="items-center py-5">
              <Pressable onPress={handleChangePhoto} className="relative">
                <View className="h-20 w-20 rounded-full bg-muted/40 border-2 border-primary overflow-hidden items-center justify-center">
                  {avatarUri ? (
                    <Image source={{ uri: getImageUrl(avatarUri) }} className="h-full w-full" />
                  ) : (
                    <UserIcon size={36} className="text-primary" />
                  )}
                </View>
                <View className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-full bg-primary border-2 border-card items-center justify-center">
                  <Camera size={13} className="text-primary-foreground" />
                </View>
              </Pressable>
              <Pressable onPress={handleChangePhoto} className="mt-1.5">
                <Text className="text-xs font-semibold text-primary">
                  {translate('change_photo', 'Change Photo')}
                </Text>
              </Pressable>
            </View>

            {/* Personal Info Fields — iOS-style grouped card */}
            <View className="px-5 gap-4">
              <Text className="text-xs font-bold text-muted-foreground uppercase">
                Personal Information
              </Text>

              <View className="bg-muted/15 rounded-2xl border border-border overflow-hidden">
                {/* Full Name */}
                <View className="px-4 py-3">
                  <Text className="text-[11px] font-semibold text-muted-foreground mb-1">
                    {translate('full_name', 'Full Name')}
                  </Text>
                  <Input
                    value={username}
                    onChangeText={setUsername}
                    placeholder="e.g. Naveen Vijayakumar"
                    className="h-10 bg-transparent border-0 text-foreground px-0 text-sm"
                  />
                </View>
                <View className="h-px bg-border mx-4" />

                {/* Email */}
                <View className="px-4 py-3">
                  <Text className="text-[11px] font-semibold text-muted-foreground mb-1">
                    {translate('email_address', 'Email Address')}
                  </Text>
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="e.g. naveen@atominosconsulting.com"
                    className="h-10 bg-transparent border-0 text-foreground px-0 text-sm"
                  />
                </View>
                <View className="h-px bg-border mx-4" />

                {/* Phone */}
                <View className="px-4 py-3">
                  <Text className="text-[11px] font-semibold text-muted-foreground mb-1">
                    {translate('phone_number', 'Phone Number')}
                  </Text>
                  <Input
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="e.g. +91 9876543210"
                    className="h-10 bg-transparent border-0 text-foreground px-0 text-sm"
                  />
                </View>
              </View>

              {/* Appearance: Theme Mode */}
              <View className="gap-2 pt-1">
                <Text className="text-xs font-bold text-muted-foreground uppercase px-1">
                  {translate('appearance_language', 'Appearance')}
                </Text>
                <ThemeToggleSwitch
                  themeMode={themeMode}
                  onSelectMode={setThemeMode}
                  t={t}
                />
              </View>

              {/* Interest Chips */}
              {masterInterests.length > 0 ? (
                <View className="gap-2 pt-1">
                  <View className="flex-row items-center gap-2">
                    <Heart size={14} className="text-rose-500" />
                    <Text className="text-xs font-bold text-muted-foreground uppercase">
                      Interests ({selectedInterests.length}/5)
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap gap-2">
                    {masterInterests.map((item) => {
                      const isSelected = selectedInterests.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggleInterest(item.id)}
                          className={`flex-row items-center gap-1.5 px-3 py-2 rounded-full border ${
                            isSelected
                              ? 'bg-rose-500/15 border-rose-500'
                              : 'bg-card border-border active:bg-muted/40'
                          }`}
                        >
                          <Text className="text-xs">{item.emoji}</Text>
                          <Text
                            className={`text-xs ${
                              isSelected ? 'font-bold text-rose-500' : 'font-medium text-foreground'
                            }`}
                          >
                            {item.name}
                          </Text>
                          {isSelected && <Check size={10} className="text-rose-500" />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Save Button */}
              <Button
                onPress={handleSave}
                disabled={isSaving}
                className={`h-12 bg-primary rounded-xl flex-row items-center justify-center gap-2 mt-2 ${isSaving ? 'opacity-70' : ''}`}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Check size={18} className="text-primary-foreground" />
                )}
                <Text className="text-primary-foreground font-bold" adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                  {isSaving ? translate('saving', 'Saving...') : translate('save_changes', 'Save Changes')}
                </Text>
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Photo Source Picker Overlay */}
      {showPhotoOptions && (
        <View className="absolute inset-0 bg-black/50 justify-end z-50">
          <Pressable className="absolute inset-0" onPress={() => setShowPhotoOptions(false)} />
          <View className="bg-card rounded-t-3xl overflow-hidden">
            <SheetGrabHandle onClose={() => setShowPhotoOptions(false)} />
            <Text className="text-base font-bold text-foreground text-center py-2">
              Change Profile Photo
            </Text>
            <View className="px-5 pb-4 gap-2">
              <Pressable
                onPress={handleTakePhoto}
                className="flex-row items-center gap-3 px-4 py-3.5 bg-muted/20 rounded-2xl border border-border active:bg-muted/40"
              >
                <View className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center">
                  <Camera size={20} className="text-primary" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">Take Photo</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">Capture with camera</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleChooseFromGallery}
                className="flex-row items-center gap-3 px-4 py-3.5 bg-muted/20 rounded-2xl border border-border active:bg-muted/40"
              >
                <View className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 items-center justify-center">
                  <ImageIcon size={20} className="text-violet-500" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">Choose from Gallery</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">Select from saved photos</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handlePickDocument}
                className="flex-row items-center gap-3 px-4 py-3.5 bg-muted/20 rounded-2xl border border-border active:bg-muted/40"
              >
                <View className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
                  <FileUp size={20} className="text-emerald-500" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">Upload from device</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">Browse image files on device</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleRemovePhoto}
                className="flex-row items-center gap-3 px-4 py-3.5 bg-rose-500/10 rounded-2xl border border-rose-500/20 active:bg-rose-500/20"
              >
                <View className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 items-center justify-center">
                  <Trash2 size={20} className="text-rose-500" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-rose-600 dark:text-rose-400">Remove photo</Text>
                  <Text className="text-xs text-rose-500/80 mt-0.5">Remove custom photo and use default</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setShowPhotoOptions(false)}
                className="items-center py-3 mt-1"
              >
                <Text className="text-sm font-semibold text-muted-foreground">Cancel</Text>
              </Pressable>
            </View>
            <View style={{ height: Math.max(insets.bottom, 8) }} />
          </View>
        </View>
      )}
    </Modal>
  );
};

export default EditProfileModal;
