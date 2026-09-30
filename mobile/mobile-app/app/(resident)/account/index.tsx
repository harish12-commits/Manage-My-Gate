import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, Image, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import {
  Home,
  Settings,
  Mail,
  Building2,
  Users,
  Sparkles,
  LogOut,
  Edit3,
} from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import {
  ThemeToggleSwitch,
  SettingsCard,
  SettingsRow,
} from '@/components/settings';
import { useBottomNavScroll } from '@/components/navigation/BottomNavScrollContext';
import { VillaSwitchModal } from '@/components/navigation/VillaSwitchModal';
import { OrgSwitchModal } from '@/components/navigation/OrgSwitchModal';
import { RoleSwitchModal } from '@/components/navigation/RoleSwitchModal';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useSettings } from '@/src/features/settings/hooks/useSettings';
import { useTranslation } from '@/src/utils/i18n';
import { getImageUrl } from '@/src/utils/imageUrl';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { t, tRole } = useTranslation();
  const { themeMode, setThemeMode } = useSettings();
  const { handleScroll } = useBottomNavScroll();

  const userAny = user as any;

  const roleLower = ((user?.role || (Array.isArray(userAny?.roles) ? userAny?.roles[0] : '') || '') as string).toLowerCase();
  const isResidentRole = /resident|tenant|owner|family/i.test(roleLower);

  // Active villa & community info strictly scoped to role
  const dynamicUnit = isResidentRole
    ? (userAny?.villaNumber || userAny?.activeVillaNumber || userAny?.unitNumber || '')
    : '';

  const dynamicCommunity = useMemo(() => {
    const userOrg =
      userAny?.organizationName ||
      userAny?.activeOrganizationName ||
      userAny?.orgName ||
      userAny?.communityName ||
      userAny?.communityOrg ||
      userAny?.organization?.name;

    if (userOrg) return userOrg;

    const workspaces = userAny?.availableWorkspaces || [];
    if (Array.isArray(workspaces) && workspaces.length > 0 && workspaces[0]?.name) {
      return workspaces[0].name;
    }

    return t('community_workspace', 'Community Workspace');
  }, [userAny, t]);

  const workspaces = (userAny?.availableWorkspaces || []) as any[];
  const hasMultipleOrgs = Array.isArray(workspaces) && workspaces.length > 1;

  const accessibleUnits = isResidentRole && Array.isArray(userAny?.accessibleUnits) ? userAny.accessibleUnits : [];
  const hasMultipleUnits = isResidentRole && accessibleUnits.length > 1;

  const hasAnyContextSwitcher = hasMultipleOrgs || hasMultipleUnits;

  const dynamicRole =
    user?.role ||
    (userAny?.roles && userAny?.roles.length > 0 ? userAny?.roles[0] : 'Member');

  // Avatar resolution
  const userAvatar = user?.avatar || userAny?.avatarUrl;
  const resolvedAvatarUrl = userAvatar ? getImageUrl(userAvatar) : null;

  const avatarLetter = useMemo(() => {
    if (user?.name) return user.name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  }, [user]);

  // Modal states
  const [villaModalVisible, setVillaModalVisible] = useState(false);
  const [orgModalVisible, setOrgModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Scroll animations for bottom navigation bar
  const scrollY = useSharedValue(0);
  const lastScrollTime = React.useRef(0);

  const throttledHandleScroll = React.useCallback(
    (y: number) => {
      const now = Date.now();
      if (now - lastScrollTime.current > 120) {
        lastScrollTime.current = now;
        handleScroll(y);
      }
    },
    [handleScroll]
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
      runOnJS(throttledHandleScroll)(event.contentOffset.y);
    },
  });

  // Handle hardware back
  React.useEffect(() => {
    const onHardwareBack = () => {
      if (villaModalVisible) {
        setVillaModalVisible(false);
        return true;
      }
      if (orgModalVisible) {
        setOrgModalVisible(false);
        return true;
      }
      if (roleModalVisible) {
        setRoleModalVisible(false);
        return true;
      }
      if (logoutModalOpen) {
        setLogoutModalOpen(false);
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      router.replace('/(resident)/dashboard' as any);
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => subscription.remove();
  }, [villaModalVisible, orgModalVisible, roleModalVisible, logoutModalOpen, router]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(resident)/dashboard' as any);
    }
  };

  const handleConfirmSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/(auth)/login' as any);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
      setLogoutModalOpen(false);
    }
  };

  return (
    <ScreenShell
      title={t('account', 'Account')}
      subtitle={t('account_subtitle', 'Manage preferences, context & workspaces')}
      iconName="User"
      scrollable={false}
      showBackButton={true}
      onBackPress={handleBack}
    >
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        className="flex-1 px-4 pt-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 120 }}
      >
        <View className="gap-2 max-w-md mx-auto w-full pt-2">
          {/* 1. User Profile Header Hero Card */}
          <TouchableOpacity
            onPress={() => router.navigate('/(resident)/profile' as any)}
            activeOpacity={0.82}
            className="items-center bg-card border border-border rounded-3xl p-5 gap-2 shadow-xs active:bg-secondary/40 relative overflow-hidden"
            accessibilityRole="button"
            accessibilityLabel={t('edit_profile', 'Edit Profile')}
          >
            {/* Top Right Edit Hint Pill */}
            <View className="absolute top-3 right-3 flex-row items-center gap-1 bg-primary/10 border border-primary/25 px-2 py-0.5 rounded-full">
              <Edit3 size={10} color="#FF6A00" strokeWidth={2.4} />
              <Text className="text-[10.5px] font-bold text-primary font-sans">
                {t('edit_profile', 'Edit Profile')}
              </Text>
            </View>

            {/* Avatar */}
            <View className="relative mt-1">
              {resolvedAvatarUrl ? (
                <Image
                  source={{ uri: resolvedAvatarUrl }}
                  className="size-16 rounded-full border-2 border-primary/40 shadow-xs"
                />
              ) : (
                <View className="size-16 rounded-full bg-primary/20 items-center justify-center border-2 border-primary/40 shadow-xs">
                  <Text className="text-primary font-black text-xl font-sans">{avatarLetter}</Text>
                </View>
              )}
            </View>

            {/* User Name & Details */}
            <View className="items-center mt-0.5">
              <Text className="text-xl font-extrabold text-foreground font-sans text-center">
                {user?.name || (user?.email ? user.email.split('@')[0] : t('logged_in_resident', 'Resident'))}
              </Text>
              <Text className="text-xs font-semibold text-primary font-sans text-center mt-0.5">
                {dynamicCommunity}
              </Text>
            </View>

            {user?.email ? (
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <Mail size={13} className="text-muted-foreground" />
                <Text className="text-xs text-muted-foreground font-sans text-center">
                  {user.email}
                </Text>
              </View>
            ) : null}

            {/* Unit & Role Pills */}
            <View className="flex-row flex-wrap justify-center gap-2 mt-2">
              {isResidentRole && dynamicUnit ? (
                <View className="bg-primary/15 px-3 py-1 rounded-full border border-primary/30">
                  <Text className="text-primary text-[11px] font-bold font-sans">
                    {dynamicUnit}
                  </Text>
                </View>
              ) : null}
              <View className="bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/25">
                <Text className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold font-sans">
                  {tRole(dynamicRole, dynamicRole)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 2. Theme Mode Section */}
          <SettingsCard containerClassName="mx-0 mt-3">
            <ThemeToggleSwitch
              themeMode={themeMode}
              onSelectMode={setThemeMode}
              t={t}
            />
          </SettingsCard>

          {/* 3. Context Switchers Section (Only if multiple orgs or units exist) */}
          {hasAnyContextSwitcher && (
            <SettingsCard
              title={t('context_switchers', 'Context Switchers')}
              containerClassName="mx-0 mt-3"
            >
              {hasMultipleOrgs && (
                <SettingsRow
                  icon={Building2}
                  iconColor="#6366f1"
                  iconBgColor="rgba(99, 102, 241, 0.12)"
                  title={t('switch_community', 'Switch Community')}
                  subtitle={dynamicCommunity}
                  onPress={() => setOrgModalVisible(true)}
                  isLast={!hasMultipleUnits}
                />
              )}
              {hasMultipleUnits && (
                <SettingsRow
                  icon={Home}
                  iconColor="#10b981"
                  iconBgColor="rgba(16, 185, 129, 0.12)"
                  title={t('switch_unit', 'Switch Villa Unit')}
                  subtitle={dynamicUnit}
                  onPress={() => setVillaModalVisible(true)}
                  isLast={true}
                />
              )}
            </SettingsCard>
          )}

          {/* 4. Community & Directory Section */}
          <SettingsCard
            title={t('community_directory', 'Community & Directory')}
            containerClassName="mx-0 mt-3"
          >
            <SettingsRow
              icon={Users}
              iconColor="#0ea5e9"
              iconBgColor="rgba(14, 165, 233, 0.12)"
              title={t('community_directory', 'Community Directory')}
              subtitle={t('find_residents_security', 'Find residents, security & staff')}
              onPress={() => router.navigate('/(resident)/directory' as any)}
            />
            <SettingsRow
              icon={Sparkles}
              iconColor="#ec4899"
              iconBgColor="rgba(236, 72, 153, 0.12)"
              title={t('all_community_notes', 'All Community Notes')}
              subtitle={t('view_24h_notes', 'View 24h status notes & publish')}
              onPress={() => router.navigate('/(resident)/notes' as any)}
              isLast={true}
            />
          </SettingsCard>

          {/* 5. Preferences Section */}
          <SettingsCard
            title={t('preferences', 'Preferences')}
            containerClassName="mx-0 mt-3"
          >
            <SettingsRow
              icon={Settings}
              title={t('app_settings', 'App Settings')}
              subtitle={t('notifications_lang_security', 'Notifications, language & security')}
              onPress={() => router.navigate('/(resident)/settings' as any)}
              isLast={true}
            />
          </SettingsCard>

          {/* 6. Account Sign Out Section */}
          <View className="pt-2">
            <TouchableOpacity
              onPress={() => setLogoutModalOpen(true)}
              activeOpacity={0.75}
              className="bg-destructive/10 border border-destructive/25 rounded-2xl p-4 flex-row items-center justify-center gap-2.5 active:bg-destructive/20 shadow-xs"
              accessibilityRole="button"
              accessibilityLabel={t('sign_out', 'Sign Out')}
            >
              <LogOut size={18} className="text-destructive" />
              <Text className="text-sm font-bold text-destructive font-sans">
                {t('sign_out', 'Sign Out')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Interactive Villa Switcher Modal */}
      {villaModalVisible && (
        <VillaSwitchModal
          visible={villaModalVisible}
          onClose={() => setVillaModalVisible(false)}
          activeVilla={dynamicUnit}
          onSelectVilla={(_villaNum) => setVillaModalVisible(false)}
          communityName={dynamicCommunity}
          onOpenOrgModal={() => setOrgModalVisible(true)}
        />
      )}

      {/* Interactive Organization / Community Switcher Modal */}
      {orgModalVisible && (
        <OrgSwitchModal
          visible={orgModalVisible}
          onClose={() => setOrgModalVisible(false)}
          activeCommunity={dynamicCommunity}
          onSelectCommunity={(_orgName) => setOrgModalVisible(false)}
        />
      )}

      {/* Interactive Role Switcher Modal */}
      {roleModalVisible && (
        <RoleSwitchModal
          visible={roleModalVisible}
          onClose={() => setRoleModalVisible(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        visible={logoutModalOpen}
        title={t('sign_out', 'Sign Out')}
        message={t('confirm_sign_out', 'Are you sure you want to sign out of your account?')}
        confirmLabel={t('sign_out', 'Sign Out')}
        cancelLabel={t('cancel', 'Cancel')}
        variant="danger"
        loading={isLoggingOut}
        onConfirm={handleConfirmSignOut}
        onCancel={() => setLogoutModalOpen(false)}
      />
    </ScreenShell>
  );
}
