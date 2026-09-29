import React, { useState } from 'react';
import { View, ScrollView, Modal, Pressable, Alert, Platform, BackHandler, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { SheetGrabHandle } from '@/components/ui/SheetGrabHandle';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  SettingsRow,
  SettingsCard,
  SettingsProfileBlock,
  SettingsNudgeRow,
  SettingsCtaRow,
  LanguageSelector,
  ThemeToggleSwitch,
  AppVersionFooter,
} from '@/components/settings';
import { ResidentDirectoryModal } from '@/components/settings/ResidentDirectoryModal';
import { SettingToggleRow } from '@/src/features/settings/components/SettingToggleRow';
import { useSettings } from '@/src/features/settings/hooks/useSettings';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation, LANGUAGE_OPTIONS } from '@/src/utils/i18n';
import { useCommunityPulse } from '@/src/features/communityPulse/hooks/useCommunityPulse';
import { InterestSelectorModal } from '@/src/features/communityPulse/components/InterestSelectorModal';
import { CreatePulseBottomSheet } from '@/src/features/communityPulse/components/CreatePulseBottomSheet';
import { VillaSwitchModal } from '@/components/navigation/VillaSwitchModal';
import { OrgSwitchModal } from '@/components/navigation/OrgSwitchModal';
import { RoleSwitchModal } from '@/components/navigation/RoleSwitchModal';
import { BottomNavigationBar } from '@/components/navigation/BottomNavigationBar';
import { useBottomNavScroll } from '@/components/navigation/BottomNavScrollContext';
import {
  Bell,
  Check,
  LogOut,
  Trash2,
  Users,
  ChevronLeft,
  Globe,
  UserX,
  HelpCircle,
  Building2,
  Home,
  UserCheck,
  AlertCircle,
} from 'lucide-react-native';
import { getImageUrl } from '@/src/utils/imageUrl';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scrollHandlerProps } = useBottomNavScroll();
  
  // Lazy loading state to prevent navigation stutter
  const [isReady, setIsReady] = React.useState(false);
  React.useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        router.replace('/(resident)/dashboard');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [router])
  );
  const { user, logout, deleteAccount } = useAuth();
  const { t, tRole } = useTranslation();
  const [createPulseOpen, setCreatePulseOpen] = useState(false);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [villaModalVisible, setVillaModalVisible] = useState(false);
  const [orgModalVisible, setOrgModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const userAny = user as any;

  const roleLower = ((user?.role || (Array.isArray(userAny?.roles) ? userAny?.roles[0] : '') || '') as string).toLowerCase();
  const isResidentRole = /resident|tenant|owner|family/i.test(roleLower);
  const isAdminRole = /admin|facility|manager|superadmin|operator|staff/i.test(roleLower);

  // Active villa & community info
  const dynamicUnit = isResidentRole
    ? (userAny?.villaNumber || userAny?.activeVillaNumber || userAny?.unitNumber || '')
    : '';

  const dynamicCommunity = React.useMemo(() => {
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

  const dynamicRole =
    user?.role ||
    (userAny?.roles && userAny?.roles.length > 0 ? userAny?.roles[0] : 'Member');

  // Avatar resolution
  const userAvatar = user?.avatar || userAny?.avatarUrl;
  const resolvedAvatarUrl = userAvatar ? getImageUrl(userAvatar) : null;
  const avatarLetter = React.useMemo(() => {
    if (user?.name) return user.name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  }, [user]);

  const handleOpenPrivacyPolicy = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://managemygate.e3esg.com/privacy-policy');
    } catch (e) {
      console.warn('Could not open privacy policy in browser:', e);
    }
  };

  const handleOpenTerms = async () => {
    try {
      await WebBrowser.openBrowserAsync('https://managemygate.e3esg.com/terms');
    } catch (e) {
      console.warn('Could not open terms in browser:', e);
    }
  };

  const handleOpenSupport = () => {
    if (Platform.OS === 'web') {
      window.alert(t('support_alert', 'Nahom Help Center & 24/7 Security Desk: support@managemygate.com'));
    } else {
      Alert.alert(
        t('support_help', 'Help & Support'),
        t('support_alert', 'Nahom Help Center & 24/7 Security Desk: support@managemygate.com'),
        [{ text: t('close', 'Close'), style: 'cancel' }]
      );
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      const result = await deleteAccount();
      if (result?.meta?.requestStatus === 'rejected') {
        const msg = (result as any)?.payload || t('error', 'Failed to delete account. Please try again.');
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert(t('error', 'Error'), String(msg));
        }
        return;
      }
      setDeleteModalOpen(false);
      router.replace('/(auth)/login');
    } catch (e: any) {
      const msg = e?.message || t('error', 'Failed to delete account. Please try again.');
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(t('error', 'Error'), msg);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const {
    themeMode,
    setThemeMode,
    languageCode,
    setLanguageCode,
    currentLanguageLabel,
    languageModalOpen,
    setLanguageModalOpen,
    preferences,
    updatePreference,
    handleClearCache,
    t: tSettings,
  } = useSettings();

  const {
    activePulses,
    userActivePulse,
    userInterests,
    masterInterests,
    createPulse,
    saveInterests,
  } = useCommunityPulse();

  const handleSignOut = async () => {
    const doLogout = async () => {
      try {
        await logout();
      } catch (e) {}
      router.replace('/(auth)/login');
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        t('confirm_sign_out', 'Are you sure you want to sign out of your account?')
      );
      if (confirmed) {
        await doLogout();
      }
    } else {
      Alert.alert(
        t('sign_out', 'Sign Out'),
        t('confirm_sign_out', 'Are you sure you want to sign out of your account?'),
        [
          { text: t('cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('sign_out', 'Sign Out'),
            style: 'destructive',
            onPress: doLogout,
          },
        ]
      );
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* 1. Header: Back (left), Title (center), Help (right) */}
      <View
        style={{ paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 28 : 20) }}
        className="bg-card border-b border-border shadow-2xs"
      >
        <View className="flex-row items-center justify-between px-4 pb-3 min-h-[48px]">
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(resident)/dashboard' as any);
            }}
            className="p-2 rounded-full active:bg-muted/60 -ms-2"
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('back', 'Back')}
          >
            <Icon as={ChevronLeft} size={22} className="text-foreground" />
          </Pressable>

          <View className="flex-1 items-center">
            <Text className="text-base font-bold text-foreground font-sans">
              {t('settings', 'Settings')}
            </Text>
          </View>

          <Pressable
            onPress={handleOpenSupport}
            className="p-2 rounded-full active:bg-muted/60 -me-2"
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('support_help', 'Help & Support')}
          >
            <Icon as={HelpCircle} size={20} className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 80 }}
        showsVerticalScrollIndicator={false}
        {...scrollHandlerProps}
      >
        {!isReady ? (
          <View className="px-4 pt-4">
            <Skeleton variant="card" />
            <View className="mt-4" />
            <Skeleton variant="listItem" count={4} />
          </View>
        ) : (
          <>
            {/* 2. Profile Block */}
            <SettingsProfileBlock
          name={user?.name || user?.username || (user?.email ? user.email.split('@')[0] : t('logged_in_resident', 'Resident Member'))}
          unitId={dynamicUnit}
          roleLabel={tRole(dynamicRole, dynamicRole)}
          avatarUrl={resolvedAvatarUrl}
          avatarLetter={avatarLetter}
          onPressProfile={() => router.push('/(resident)/profile' as any)}
          onPressQr={() => router.push('/(resident)/visitor' as any)}
        />

        {/* 3. Nudge Row */}
        <SettingsNudgeRow
          title={t('profile_nudge_title', 'Profile Completion')}
          percentage={85}
          description={t('profile_nudge_desc', 'Complete emergency contacts & vehicle info.')}
          actionLabel={t('update_details', 'Update')}
          onActionPress={() => router.push('/(resident)/profile' as any)}
        />

        {/* 4. Update / CTA Row */}
        <SettingsCtaRow
          label={t('workspace_context_cta', 'Active Workspace Context')}
          subLabel={dynamicCommunity}
          buttonLabel={hasMultipleOrgs ? t('switch_context', 'Switch') : undefined}
          onPress={hasMultipleOrgs ? () => setOrgModalVisible(true) : undefined}
        />

        {/* 5. Section Groups */}

        {/* Group A: Household & Access */}
        <SettingsCard title={t('household_group', 'Household & Access')}>
          {hasMultipleOrgs && (
            <SettingsRow
              icon={Building2}
              iconColor="#6366f1"
              iconBgColor="rgba(99, 102, 241, 0.12)"
              title={t('switch_community', 'Switch Community')}
              subtitle={dynamicCommunity}
              onPress={() => setOrgModalVisible(true)}
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
            />
          )}
          <SettingsRow
            icon={Users}
            iconColor="#0ea5e9"
            iconBgColor="rgba(14, 165, 233, 0.12)"
            title={t('community_directory', 'Community Directory')}
            subtitle={t('find_residents_security', 'Find residents, security & staff')}
            onPress={() => router.push('/(resident)/directory' as any)}
            isLast={true}
          />
        </SettingsCard>

        {/* Group B: General Settings & Preferences */}
        <SettingsCard title={t('general_settings_group', 'General Settings & Preferences')}>
          <ThemeToggleSwitch
            themeMode={themeMode}
            onSelectMode={setThemeMode}
            t={t}
          />
          <View className="h-px bg-border/60 mx-4" />
          <LanguageSelector
            currentLanguage={currentLanguageLabel}
            onPress={() => setLanguageModalOpen(true)}
          />
          <View className="px-4 py-1">
            <SettingToggleRow
              label={t('push_notifications', 'Push Notifications')}
              description={t('push_desc', 'Gate arrival & security alerts')}
              icon={Bell}
              value={preferences.gateAlerts}
              onValueChange={(val) => updatePreference('gateAlerts', val)}
              isLastItem={true}
            />
          </View>
        </SettingsCard>

        {/* Group C: Help & Support */}
        <SettingsCard title={t('help_support_group', 'Help & Support')}>
          <SettingsRow
            icon={HelpCircle}
            iconColor="#f59e0b"
            iconBgColor="rgba(245, 158, 11, 0.12)"
            title={t('report_an_issue', 'Report an Issue')}
            subtitle={t('report_an_issue_desc', 'Report a problem or suggest an improvement')}
            onPress={() => router.push('/(resident)/settings/report-issue' as any)}
            isLast={true}
          />
        </SettingsCard>

        {/* Group D: Account Management */}
        <SettingsCard title={t('account_actions_group', 'Account Management')}>
          <SettingsRow
            icon={Trash2}
            iconColor="#d97706"
            iconBgColor="rgba(217, 119, 6, 0.12)"
            title={t('clear_cache', 'Clear Application Cache')}
            subtitle={t('free_storage', 'Free up temporary storage')}
            showChevron={false}
            onPress={handleClearCache}
          />
          <SettingsRow
            icon={LogOut}
            iconColor="#ef4444"
            iconBgColor="rgba(239, 68, 68, 0.12)"
            title={t('sign_out', 'Sign Out')}
            subtitle={t('log_out_desc', 'Log out of your account')}
            isDestructive={true}
            showChevron={false}
            onPress={handleSignOut}
          />
          <SettingsRow
            icon={UserX}
            iconColor="#ef4444"
            iconBgColor="rgba(239, 68, 68, 0.12)"
            title={t('delete_account', 'Delete Account')}
            subtitle={t('delete_account_desc', 'Permanently delete your account & data')}
            isDestructive={true}
            showChevron={false}
            onPress={() => setDeleteModalOpen(true)}
            isLast={true}
          />
        </SettingsCard>

        {/* 7. Footer: App Logo, Legal links, Version */}
        <AppVersionFooter
          onPressPrivacy={handleOpenPrivacyPolicy}
          onPressTerms={handleOpenTerms}
        />
          </>
        )}
      </ScrollView>

      {/* ─── Modals & Bottom Sheets ─── */}

      {/* Language Selection Bottom Sheet */}
      {languageModalOpen ? (
        <Modal
          visible={languageModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setLanguageModalOpen(false)}
        >
          <View className="flex-1 justify-end bg-black/50">
            <Pressable
              className="absolute inset-0"
              onPress={() => setLanguageModalOpen(false)}
            />
            <View className="bg-card rounded-t-3xl overflow-hidden">
              <SheetGrabHandle onClose={() => setLanguageModalOpen(false)} />
              <Text className="text-base font-bold text-foreground text-center py-2 font-sans">
                {t('select_language', 'Select Language')}
              </Text>
              <View className="px-5 pb-6 gap-2">
                {LANGUAGE_OPTIONS.map((item) => {
                  const isSelected = item.code === languageCode;
                  return (
                    <Pressable
                      key={item.code}
                      onPress={() => {
                        setLanguageCode(item.code);
                        setLanguageModalOpen(false);
                      }}
                      className={`flex-row items-center justify-between px-4 py-3.5 rounded-xl ${
                        isSelected
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-muted/30 border border-border active:bg-muted/60'
                      }`}
                    >
                      <Text
                        skipTranslate
                        className={`text-sm font-sans ${
                          isSelected ? 'font-bold text-primary' : 'font-medium text-foreground'
                        }`}
                      >
                        {item.label}
                      </Text>
                      {isSelected && <Icon as={Check} size={18} className="text-primary" />}
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ height: Math.max(insets.bottom, 8) }} />
            </View>
          </View>
        </Modal>
      ) : null}

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

      {/* Community Directory Modal */}
      {directoryOpen ? (
        <ResidentDirectoryModal
          visible={directoryOpen}
          onClose={() => setDirectoryOpen(false)}
          pulses={activePulses}
        />
      ) : null}

      {/* Interests Modal */}
      {interestsOpen ? (
        <InterestSelectorModal
          visible={interestsOpen}
          onClose={() => setInterestsOpen(false)}
          masterInterests={masterInterests}
          selectedInterests={userInterests}
          onSave={(selectedIds) => saveInterests(selectedIds)}
        />
      ) : null}

      {/* Create Pulse Sheet */}
      {createPulseOpen ? (
        <CreatePulseBottomSheet
          visible={createPulseOpen}
          onClose={() => setCreatePulseOpen(false)}
          initialPulse={userActivePulse}
          onSubmit={(text, emoji, category, contextText) =>
            createPulse(text, emoji, category, contextText)
          }
        />
      ) : null}

      {/* Account Deletion Confirmation Modal */}
      <ConfirmationModal
        visible={deleteModalOpen}
        variant="danger"
        title={t('confirm_delete_account_title', 'Delete Account?')}
        message={t(
          'confirm_delete_account_message',
          'Are you sure you want to delete your account? This action cannot be undone.'
        )}
        confirmLabel={t('confirm_delete_account_action', 'Delete Permanently')}
        cancelLabel={t('cancel', 'Cancel')}
        loading={isDeleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteModalOpen(false)}
      />

      <BottomNavigationBar />
    </View>
  );
}
