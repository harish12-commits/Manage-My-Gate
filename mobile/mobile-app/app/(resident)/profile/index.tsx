import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, Pressable, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { SuccessToast } from '@/components/feedback/SuccessToast';
import { SheetGrabHandle } from '@/components/ui/SheetGrabHandle';
import { ProfileHeaderCard, VerifyEmailOtpModal } from '@/src/features/profile/components';
import { RoleSwitchModal, OrgSwitchModal, AssignmentSwitchModal, VillaSwitchModal } from '@/components/navigation';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { useBottomNavScroll } from '@/components/navigation/BottomNavScrollContext';
import authService from '@/src/features/auth/services/authService';
import { updateProfileThunk } from '@/src/features/auth/store/authSlice';
import { useTranslation } from '@/src/utils/i18n';
import { Save, Camera, Image as ImageIcon, FileUp, Trash2, Settings, Building2, ShieldCheck, MapPin, Home, ChevronRight, BriefcaseBusiness, UserRound } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { validateEmail, validatePhone, parseBackendError } from '@/src/utils/validation';

interface SelectedAvatarFile {
  uri: string;
  name?: string;
  type?: string;
  file?: any;
}

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { t, tRole } = useTranslation();
  const {
    user,
    dynamicUnit,
    dynamicCommunity,
    dynamicRole,
    dynamicAssignment,
    isResidentRole,
    isSecurity,
    isFacility,
    hasMultipleOrgs,
    hasMultipleRoles,
    hasMultipleUnits,
    hasMultipleAssignments,
    villaModalOpen,
    setVillaModalOpen,
    roleModalOpen,
    setRoleModalOpen,
    orgModalOpen,
    setOrgModalOpen,
    assignmentModalOpen,
    setAssignmentModalOpen,
  } = useProfile();
  const { scrollHandlerProps } = useBottomNavScroll();

  // Profile editable fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [work, setWork] = useState('');
  const [hometown, setHometown] = useState('');
  const [interestsText, setInterestsText] = useState('');
  const [allowCalls, setAllowCalls] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<SelectedAvatarFile | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; phone?: boolean }>({});

  // Email verification OTP modal state
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [pendingNewEmail, setPendingNewEmail] = useState('');
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);
  const [emailOtpResending, setEmailOtpResending] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState<string | null>(null);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const uAny = user as any;
      setName(user.name || user.username || uAny.fullName || (user.email ? user.email.split('@')[0] : ''));
      setEmail(user.email || uAny.emailAddress || '');
      setPhone(user.phone || uAny.phoneNumber || uAny.mobile || '');
      setBio(uAny.bio || '');
      setWork(uAny.work || '');
      setHometown(uAny.hometown || '');
      setInterestsText(Array.isArray(uAny.interests) ? uAny.interests.join(', ') : '');
      setAllowCalls(uAny.allowIntercomCalls !== false);
      if (user.avatar || uAny.avatarUrl) {
        setAvatarUri(user.avatar || uAny.avatarUrl);
      } else {
        setAvatarUri(null);
      }
    }
  }, [user]);

  // Immediate auto-upload and persistence when photo is chosen
  const uploadAvatarDirectly = async (fileObj: SelectedAvatarFile) => {
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      if (name.trim()) formData.append('name', name.trim());
      if (phone.trim()) formData.append('phone', phone.trim());

      if (Platform.OS === 'web') {
        if (fileObj.file) {
          formData.append('avatar', fileObj.file, fileObj.name || 'avatar.jpg');
        } else {
          try {
            const response = await fetch(fileObj.uri);
            const blob = await response.blob();
            const file = new File([blob], fileObj.name || 'avatar.jpg', {
              type: fileObj.type || blob.type || 'image/jpeg',
            });
            formData.append('avatar', file);
          } catch (fetchErr) {
            console.warn('Fallback web blob append:', fetchErr);
            formData.append('avatar', fileObj.uri);
          }
        }
      } else {
        formData.append('avatar', {
          uri: fileObj.uri,
          name: fileObj.name || `avatar_${Date.now()}.jpg`,
          type: fileObj.type || 'image/jpeg',
        } as any);
      }

      const res = await dispatch(updateProfileThunk(formData) as any);
      if (res.meta.requestStatus === 'fulfilled') {
        setSelectedAvatarFile(null);
        const updatedAvatar = res.payload?.avatar;
        if (updatedAvatar) {
          setAvatarUri(updatedAvatar);
        }
        setProfileSuccess(t('profile_photo_saved', 'Profile photo updated successfully!'));
        setTimeout(() => setProfileSuccess(null), 3500);
      } else {
        const parsed = parseBackendError(res.payload, t('failed_to_save_photo', 'Failed to save profile photo.'));
        Alert.alert(t('error', 'Error'), parsed.userMessage);
      }
    } catch (err: any) {
      console.error('Error auto-uploading avatar:', err);
      const parsed = parseBackendError(err, t('failed_to_save_photo', 'Failed to save profile photo.'));
      Alert.alert(t('error', 'Error'), parsed.userMessage);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePhotoSelected = async (fileObj: SelectedAvatarFile) => {
    setSelectedAvatarFile(fileObj);
    setAvatarUri(fileObj.uri);
    await uploadAvatarDirectly(fileObj);
  };

  // 1. Live Camera Access
  const handleTakePhoto = async () => {
    setShowPhotoOptions(false);
    try {
      if (Platform.OS === 'web') {
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          await handlePhotoSelected({
            uri: asset.uri,
            name: asset.fileName || `camera_${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
            file: (asset as any).file,
          });
        }
        return;
      }

      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert(
          t('permission_required', 'Permission Required'),
          t('camera_perm_desc', 'Camera access is needed to capture a profile photo.')
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await handlePhotoSelected({
          uri: asset.uri,
          name: asset.fileName || `camera_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err) {
      console.warn('Error taking photo with camera:', err);
    }
  };

  // 2. Photo Gallery
  const handleChooseFromGallery = async () => {
    setShowPhotoOptions(false);
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert(
          t('permission_required', 'Permission Required'),
          t('gallery_perm_desc', 'Photo library access is needed to select a profile photo.')
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await handlePhotoSelected({
          uri: asset.uri,
          name: asset.fileName || `avatar_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          file: (asset as any).file,
        });
      }
    } catch (err) {
      console.warn('Error picking image from gallery:', err);
    }
  };

  // 3. Document / File Picker
  const handlePickDocument = async () => {
    setShowPhotoOptions(false);
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            const objectUrl = URL.createObjectURL(file);
            await handlePhotoSelected({
              uri: objectUrl,
              name: file.name,
              type: file.type || 'image/jpeg',
              file: file,
            });
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
        const asset = result.assets[0];
        await handlePhotoSelected({
          uri: asset.uri,
          name: asset.name || `doc_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (err) {
      console.warn('Error picking document file:', err);
    }
  };

  // 4. Remove Photo & Restore Default
  const handleRemovePhoto = async () => {
    setShowPhotoOptions(false);
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('removeAvatar', 'true');
      if (name.trim()) formData.append('name', name.trim());
      if (phone.trim()) formData.append('phone', phone.trim());

      const res = await dispatch(updateProfileThunk(formData) as any);
      if (res.meta.requestStatus === 'fulfilled') {
        setSelectedAvatarFile(null);
        setAvatarUri(null);
        setProfileSuccess(t('profile_photo_removed', 'Profile photo removed. Default avatar restored.'));
        setTimeout(() => setProfileSuccess(null), 3500);
      } else {
        const parsed = parseBackendError(res.payload, t('failed_to_remove_photo', 'Failed to remove profile photo.'));
        Alert.alert(t('error', 'Error'), parsed.userMessage);
      }
    } catch (err: any) {
      console.error('Error removing avatar:', err);
      const parsed = parseBackendError(err, t('failed_to_remove_photo', 'Failed to remove profile photo.'));
      Alert.alert(t('error', 'Error'), parsed.userMessage);
    } finally {
      setAvatarUploading(false);
    }
  };

  const executeProfileUpdate = async (emailToUpdate?: string, emailOtp?: string) => {
    setProfileSaving(true);
    setProfileSuccess(null);
    try {
      const interests = interestsText
        .split(',')
        .map((interest) => interest.trim())
        .filter(Boolean)
        .slice(0, 20);
      let payload: any;
      if (selectedAvatarFile) {
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('phone', phone.trim());
        formData.append('bio', bio.trim());
        formData.append('work', work.trim());
        formData.append('hometown', hometown.trim());
        formData.append('allowIntercomCalls', String(allowCalls));
        formData.append('interests', JSON.stringify(interests));
        if (emailToUpdate && emailOtp) {
          formData.append('email', emailToUpdate);
          formData.append('emailOtp', emailOtp);
        }

        if (Platform.OS === 'web') {
          if (selectedAvatarFile.file) {
            formData.append('avatar', selectedAvatarFile.file, selectedAvatarFile.name || 'avatar.jpg');
          } else if (selectedAvatarFile.uri.startsWith('blob:') || selectedAvatarFile.uri.startsWith('data:')) {
            const response = await fetch(selectedAvatarFile.uri);
            const blob = await response.blob();
            formData.append('avatar', blob, selectedAvatarFile.name || 'avatar.jpg');
          }
        } else {
          formData.append('avatar', {
            uri: selectedAvatarFile.uri,
            name: selectedAvatarFile.name || 'avatar.jpg',
            type: selectedAvatarFile.type || 'image/jpeg',
          } as any);
        }
        payload = formData;
      } else {
        payload = {
          name: name.trim(),
          phone: phone.trim(),
          bio: bio.trim(),
          work: work.trim(),
          hometown: hometown.trim(),
          allowIntercomCalls: allowCalls,
          interests,
          ...(emailToUpdate && emailOtp ? { email: emailToUpdate, emailOtp } : {}),
        };
      }

      const res = await dispatch(updateProfileThunk(payload) as any);
      if (res.meta.requestStatus === 'fulfilled') {
        setProfileSuccess(
          emailToUpdate
            ? t('profile_and_email_updated', 'Profile & email updated successfully!')
            : t('profile_updated', 'Profile updated successfully!')
        );
        setSelectedAvatarFile(null);
        if (emailToUpdate) {
          setShowEmailOtpModal(false);
          setPendingNewEmail('');
          setEmailOtpError(null);
        }
        setTimeout(() => setProfileSuccess(null), 3500);
        return true;
      } else {
        const parsed = parseBackendError(res.payload, t('failed_to_update_profile', 'Failed to update profile'));
        const err = parsed.userMessage;
        if (emailToUpdate) {
          setEmailOtpError(err);
        } else {
          const lower = err.toLowerCase();
          if (lower.includes('email')) {
            setFieldErrors((prev) => ({ ...prev, email: err }));
          } else if (lower.includes('phone') || lower.includes('mobile')) {
            setFieldErrors((prev) => ({ ...prev, phone: err }));
          } else {
            Alert.alert(t('error', 'Error'), err);
          }
        }
        return false;
      }
    } catch (error: any) {
      const parsed = parseBackendError(error, t('failed_to_update_profile', 'Failed to update profile'));
      const msg = parsed.userMessage;
      if (emailToUpdate) {
        setEmailOtpError(msg);
      } else {
        const lower = msg.toLowerCase();
        if (lower.includes('email')) {
          setFieldErrors((prev) => ({ ...prev, email: msg }));
        } else if (lower.includes('phone') || lower.includes('mobile')) {
          setFieldErrors((prev) => ({ ...prev, phone: msg }));
        } else {
          Alert.alert(t('error', 'Error'), msg);
        }
      }
      return false;
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setTouched({ name: true, email: true, phone: true });
    setFieldErrors({});

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldErrors((prev) => ({ ...prev, name: t('name_required', 'Please enter your name.') }));
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const currentEmail = (user?.email || '').trim().toLowerCase();

    // Check email format if provided
    if (trimmedEmail) {
      const emailRes = validateEmail(trimmedEmail);
      if (emailRes.status === 'invalid' || emailRes.status === 'incomplete') {
        setFieldErrors((prev) => ({ ...prev, email: emailRes.message || t('invalid_email', 'Please enter a valid email address.') }));
        return;
      }
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      const phoneRes = validatePhone(trimmedPhone, 'IN');
      if (phoneRes.status === 'invalid') {
        setFieldErrors((prev) => ({ ...prev, phone: phoneRes.message }));
        return;
      }
    }

    // If user has changed their email address, request verification OTP
    if (trimmedEmail && trimmedEmail !== currentEmail) {
      setProfileSaving(true);
      setEmailOtpError(null);
      try {
        const otpRes = await authService.requestEmailChangeOtp(trimmedEmail);
        const data = (otpRes as any)?.data || (otpRes as any)?.data?.data || otpRes;
        if (data?.devCode) {
          setDevOtpCode(data.devCode);
        } else {
          setDevOtpCode(null);
        }
        setPendingNewEmail(trimmedEmail);
        setShowEmailOtpModal(true);
      } catch (err: any) {
        const errorMsg = parseBackendError(err, t('failed_send_otp', 'Failed to send verification OTP')).userMessage;
        if (errorMsg.toLowerCase().includes('email')) {
          setFieldErrors((prev) => ({ ...prev, email: errorMsg }));
        } else {
          Alert.alert(t('error', 'Error'), errorMsg);
        }
      } finally {
        setProfileSaving(false);
      }
      return;
    }

    // Email unchanged, update other fields directly
    await executeProfileUpdate();
  };

  const handleVerifyEmailOtp = async (otp: string) => {
    setEmailOtpLoading(true);
    setEmailOtpError(null);
    try {
      await executeProfileUpdate(pendingNewEmail, otp);
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    setEmailOtpResending(true);
    setEmailOtpError(null);
    try {
      const otpRes = await authService.requestEmailChangeOtp(pendingNewEmail);
      const data = (otpRes as any)?.data || (otpRes as any)?.data?.data || otpRes;
      if (data?.devCode) {
        setDevOtpCode(data.devCode);
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || t('failed_send_otp', 'Failed to resend OTP');
      setEmailOtpError(errorMsg);
    } finally {
      setEmailOtpResending(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(resident)/dashboard' as any);
    }
  };

  const displayName = name || user?.name || (user?.email ? user.email.split('@')[0] : t('logged_in_resident', 'Resident User'));

  return (
    <ScreenShell
      title={t('profile', 'Profile')}
      subtitle={t('edit_profile_subtitle', 'Update personal details & profile photo')}
      iconName="User"
      scrollable={false}
      showBackButton={true}
      onBackPress={handleBack}
      headerRight={
        <Pressable
          onPress={() => router.push('/(resident)/settings' as any)}
          className="size-10 rounded-full bg-secondary/80 dark:bg-secondary/60 border border-border/70 items-center justify-center active:bg-secondary shadow-2xs"
          accessibilityRole="button"
          accessibilityLabel={t('app_settings', 'Settings')}
        >
          <Settings size={17} className="text-foreground" strokeWidth={2.2} />
        </Pressable>
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-4 pb-36"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...scrollHandlerProps}
      >
        {/* Profile Hero Header Card with Avatar & Live Camera / Photo Trigger */}
        <ProfileHeaderCard
          name={displayName}
          email={email || user?.email}
          phone={phone || user?.phone}
          unitName={isResidentRole ? dynamicUnit : undefined}
          roleName={dynamicRole}
          communityName={dynamicCommunity}
          avatarUrl={avatarUri}
          showCameraBadge={true}
          isAvatarLoading={avatarUploading}
          onAvatarPress={() => setShowPhotoOptions(true)}
          onUnitPress={isResidentRole ? () => setVillaModalOpen(true) : undefined}
          allowCalls={allowCalls}
          onAllowCallsChange={setAllowCalls}
        />

        {/* Section: Organisation, Role & Villa Switching */}
        <View className="gap-2.5">
          <Text className="text-[12px] font-bold font-sans text-muted-foreground uppercase px-1 tracking-wider">
            {t('workspace_context', 'Organisation, Role & Villa')}
          </Text>

          <View className="bg-card border border-border/70 rounded-3xl p-5 shadow-2xs gap-4">
            {/* Current Organisation */}
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="size-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center">
                  <Building2 size={18} color="#6366f1" />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('current_organisation', 'Current Organisation')}
                  </Text>
                  <Text className="text-base font-bold text-foreground mt-0.5" numberOfLines={1}>
                    {dynamicCommunity}
                  </Text>
                </View>
              </View>
            </View>

            {/* Current Role */}
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="size-10 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                  <ShieldCheck size={18} color="#03A9F4" />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('current_role', 'Current Role')}
                  </Text>
                  <Text className="text-base font-bold text-foreground mt-0.5" numberOfLines={1}>
                    {tRole(dynamicRole, dynamicRole)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Current Property Unit (Resident roles only) */}
            {isResidentRole ? (
              <Pressable
                onPress={() => setVillaModalOpen(true)}
                className="flex-row items-center justify-between gap-3 p-2 -m-2 rounded-2xl active:bg-secondary/60"
                accessibilityRole="button"
                accessibilityLabel={t('switch_unit', 'Switch Villa Unit')}
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="size-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
                    <Home size={18} color="#10b981" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('current_unit', 'Current Property Unit')}
                    </Text>
                    <Text className="text-base font-bold text-foreground mt-0.5" numberOfLines={1}>
                      {dynamicUnit ? `Unit ${dynamicUnit}` : t('no_unit_assigned', 'No Unit Assigned')}
                    </Text>
                  </View>
                </View>

                {/* Explicit Switch Unit trigger button */}
                <View className="flex-row items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {t('switch', 'Switch')}
                  </Text>
                  <ChevronRight size={14} color="#10b981" />
                </View>
              </Pressable>
            ) : null}

            {/* Current Assignment (Security / Facility roles only) */}
            {(isSecurity || isFacility) && dynamicAssignment ? (
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="size-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 items-center justify-center">
                    <MapPin size={18} color="#0ea5e9" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('current_assignment', 'Current Assignment')}
                    </Text>
                    <Text className="text-base font-bold text-foreground mt-0.5" numberOfLines={1}>
                      {dynamicAssignment}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Action Buttons (Rendered if multiple switchable options exist) */}
            {(hasMultipleOrgs || hasMultipleRoles || (isResidentRole && hasMultipleUnits) || hasMultipleAssignments) && (
              <View className="flex-row flex-wrap gap-2.5 pt-2 border-t border-border/50">
                {hasMultipleOrgs && (
                  <Button
                    variant="outline"
                    size="default"
                    className="flex-1 min-w-[130px] h-11 rounded-2xl border-indigo-500/40 bg-indigo-500/5 active:bg-indigo-500/10"
                    onPress={() => setOrgModalOpen(true)}
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <Building2 size={15} color="#6366f1" />
                      <Text className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {t('switch_organisation', 'Switch Organisation')}
                      </Text>
                    </View>
                  </Button>
                )}

                {hasMultipleRoles && (
                  <Button
                    variant="outline"
                    size="default"
                    className="flex-1 min-w-[130px] h-11 rounded-2xl border-primary/40 bg-primary/5 active:bg-primary/10"
                    onPress={() => setRoleModalOpen(true)}
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <ShieldCheck size={15} color="#03A9F4" />
                      <Text className="text-xs font-bold text-primary">
                        {t('switch_role', 'Switch Role')}
                      </Text>
                    </View>
                  </Button>
                )}

                {isResidentRole && hasMultipleUnits && (
                  <Button
                    variant="outline"
                    size="default"
                    className="flex-1 min-w-[130px] h-11 rounded-2xl border-emerald-500/40 bg-emerald-500/5 active:bg-emerald-500/10"
                    onPress={() => setVillaModalOpen(true)}
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <Home size={15} color="#10b981" />
                      <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {t('switch_unit', 'Switch Villa Unit')}
                      </Text>
                    </View>
                  </Button>
                )}

                {hasMultipleAssignments && (
                  <Button
                    variant="outline"
                    size="default"
                    className="w-full h-11 rounded-2xl border-sky-500/40 bg-sky-500/5 active:bg-sky-500/10 mt-1"
                    onPress={() => setAssignmentModalOpen(true)}
                  >
                    <View className="flex-row items-center justify-center gap-2">
                      <MapPin size={15} color="#0ea5e9" />
                      <Text className="text-xs font-bold text-sky-600 dark:text-sky-400">
                        {t('switch_assignment', 'Switch Assignment / Scope')}
                      </Text>
                    </View>
                  </Button>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Section: Personal Details & Edit Form */}
        <View className="gap-2.5">
          <Text className="text-[12px] font-bold font-sans text-muted-foreground uppercase px-1 tracking-wider">
            {t('personal_details', 'Personal Details')}
          </Text>

          <View className="bg-card border border-border/70 rounded-3xl p-5 shadow-2xs gap-4">
            <TextInput
              label={t('full_name', 'Full Name')}
              required
              placeholder={t('full_name_placeholder', 'e.g. Jane Doe')}
              value={name}
              onChangeText={(val) => {
                setName(val);
                if (touched.name && !val.trim()) {
                  setFieldErrors((prev) => ({ ...prev, name: t('name_required', 'Please enter your name.') }));
                } else if (fieldErrors.name) {
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
              status={fieldErrors.name ? 'invalid' : touched.name && name.trim() ? 'valid' : 'idle'}
              error={fieldErrors.name}
              clearable
              onClear={() => {
                setName('');
                setTouched((prev) => ({ ...prev, name: true }));
                setFieldErrors((prev) => ({ ...prev, name: t('name_required', 'Please enter your name.') }));
              }}
            />

            <TextInput
              label={t('email_address', 'Email Address')}
              placeholder={t('email_placeholder', 'e.g. user@example.com')}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              status={
                fieldErrors.email
                  ? 'invalid'
                  : email.trim()
                  ? validateEmail(email).status === 'valid'
                    ? 'valid'
                    : validateEmail(email).status === 'incomplete' && touched.email
                    ? 'incomplete'
                    : 'idle'
                  : 'idle'
              }
              helperText={
                !fieldErrors.email && email.trim() && touched.email && validateEmail(email).status === 'incomplete'
                  ? validateEmail(email).message
                  : undefined
              }
              error={fieldErrors.email}
              clearable
              onClear={() => {
                setEmail('');
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
            />

            <TextInput
              label={t('phone_number', 'Phone Number')}
              placeholder={t('phone_placeholder', 'e.g. +91 9876543210')}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(val) => {
                setPhone(val);
                if (fieldErrors.phone) {
                  setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
              status={
                fieldErrors.phone
                  ? 'invalid'
                  : phone.trim()
                  ? validatePhone(phone, 'IN').status === 'valid'
                    ? 'valid'
                    : validatePhone(phone, 'IN').status === 'incomplete' && touched.phone
                    ? 'incomplete'
                    : 'idle'
                  : 'idle'
              }
              helperText={
                !fieldErrors.phone && phone.trim() && touched.phone
                  ? validatePhone(phone, 'IN').message
                  : undefined
              }
              error={fieldErrors.phone}
              clearable
              onClear={() => {
                setPhone('');
                setFieldErrors((prev) => ({ ...prev, phone: undefined }));
              }}
            />

            <View className="h-px bg-border/70" />

            <TextInput
              label={t('bio', 'Bio')}
              placeholder={t('bio_placeholder', 'Tell your neighbours about yourself')}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
              leftIcon={UserRound}
            />

            <View className="flex-row gap-3">
              <TextInput
                containerClassName="flex-1"
                label={t('work', 'Work')}
                placeholder={t('add_work', 'Add work')}
                value={work}
                onChangeText={setWork}
                maxLength={120}
                leftIcon={BriefcaseBusiness}
              />
              <TextInput
                containerClassName="flex-1"
                label={t('hometown', 'Hometown')}
                placeholder={t('add_hometown', 'Add hometown')}
                value={hometown}
                onChangeText={setHometown}
                maxLength={120}
                leftIcon={MapPin}
              />
            </View>

            <TextInput
              label={t('interests', 'Interests')}
              placeholder={t('interests_placeholder', 'Add interests, separated by commas')}
              helperText={t('interests_help', 'Choose up to 20 interests')}
              value={interestsText}
              onChangeText={setInterestsText}
              maxLength={1200}
            />

            {profileSuccess && <SuccessToast message={profileSuccess} />}

            <Button
              variant="default"
              size="default"
              loading={profileSaving}
              leftIcon={Save}
              onPress={handleSaveProfile}
              className="mt-2 h-12 rounded-2xl shadow-2xs"
              textClassName="font-bold text-sm"
            >
              {t('save_profile_changes', 'Save Profile Changes')}
            </Button>
          </View>
        </View>
      </ScrollView>

      {/* Photo Picker Options Bottom Sheet Modal */}
      <Modal
        visible={showPhotoOptions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="absolute inset-0" onPress={() => setShowPhotoOptions(false)} />
          <View className="bg-card rounded-t-3xl overflow-hidden border-t border-border">
            <SheetGrabHandle onClose={() => setShowPhotoOptions(false)} />
            <Text className="text-base font-bold text-foreground text-center py-2">
              {t('profile_photo_options', 'Update Profile Photo')}
            </Text>
            <View className="px-5 pb-5 gap-2.5">
              {/* Option 1: Live Camera */}
              <Pressable
                onPress={handleTakePhoto}
                className="flex-row items-center gap-3 px-4 py-3.5 bg-muted/20 rounded-2xl border border-border active:bg-muted/40"
              >
                <View className="size-11 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center">
                  <Camera size={20} className="text-primary" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {t('take_photo', 'Take photo')}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {t('take_photo_desc', 'Capture an image with live camera')}
                  </Text>
                </View>
              </Pressable>

              {/* Option 2: Gallery */}
              <Pressable
                onPress={handleChooseFromGallery}
                className="flex-row items-center gap-3 px-4 py-3.5 bg-muted/20 rounded-2xl border border-border active:bg-muted/40"
              >
                <View className="size-11 rounded-xl bg-violet-500/10 border border-violet-500/20 items-center justify-center">
                  <ImageIcon size={20} className="text-violet-500" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {t('choose_from_gallery', 'Choose from Gallery')}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {t('choose_from_gallery_desc', 'Select an existing image from your device')}
                  </Text>
                </View>
              </Pressable>

              {/* Option 3: Upload from device */}
              <Pressable
                onPress={handlePickDocument}
                className="flex-row items-center gap-3 px-4 py-3.5 bg-muted/20 rounded-2xl border border-border active:bg-muted/40"
              >
                <View className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
                  <FileUp size={20} className="text-emerald-500" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {t('upload_from_device', 'Upload from device')}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {t('upload_from_device_desc', 'Browse image files on device')}
                  </Text>
                </View>
              </Pressable>

              {/* Option 4: Remove photo (Restore Default) */}
              <Pressable
                onPress={handleRemovePhoto}
                className="flex-row items-center gap-3 px-4 py-3.5 bg-rose-500/10 rounded-2xl border border-rose-500/20 active:bg-rose-500/20"
              >
                <View className="size-11 rounded-xl bg-rose-500/15 border border-rose-500/30 items-center justify-center">
                  <Trash2 size={20} className="text-rose-500" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {t('remove_photo', 'Remove photo')}
                  </Text>
                  <Text className="text-xs text-rose-500/80 mt-0.5">
                    {t('remove_photo_desc', 'Remove custom photo and use default avatar')}
                  </Text>
                </View>
              </Pressable>

              {/* Cancel */}
              <Pressable
                onPress={() => setShowPhotoOptions(false)}
                className="items-center py-3 mt-1"
              >
                <Text className="text-sm font-semibold text-muted-foreground">
                  {t('cancel', 'Cancel')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Email Verification OTP Modal */}
      <VerifyEmailOtpModal
        visible={showEmailOtpModal}
        email={pendingNewEmail}
        onClose={() => {
          setShowEmailOtpModal(false);
          setEmailOtpError(null);
        }}
        onVerify={handleVerifyEmailOtp}
        onResend={handleResendEmailOtp}
        loading={emailOtpLoading}
        resending={emailOtpResending}
        errorMessage={emailOtpError}
        devCode={devOtpCode}
      />

      {/* Role Switch Modal */}
      <RoleSwitchModal
        visible={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
      />

      {/* Organisation Switch Modal */}
      <OrgSwitchModal
        visible={orgModalOpen}
        onClose={() => setOrgModalOpen(false)}
        activeCommunity={dynamicCommunity}
        onSelectCommunity={() => {}}
      />

      {/* Villa Switch Modal */}
      <VillaSwitchModal
        visible={villaModalOpen}
        onClose={() => setVillaModalOpen(false)}
        activeVilla={dynamicUnit}
        onSelectVilla={() => {}}
      />

      {/* Assignment Switch Modal */}
      <AssignmentSwitchModal
        visible={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
      />
    </ScreenShell>
  );
}
