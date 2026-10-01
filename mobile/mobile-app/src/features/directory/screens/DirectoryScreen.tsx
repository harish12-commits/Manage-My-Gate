import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { DirectorySearch } from '../components/DirectorySearch';
import { DirectoryCategoryTabs } from '../components/DirectoryCategoryTabs';
import { DirectoryContactCard } from '../components/DirectoryContactCard';
import { useDirectory } from '../hooks/useDirectory';
import { useDirectorySocket } from '../hooks/useDirectorySocket';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useTranslation } from '@/src/utils/i18n';
import { DirectoryMember } from '../types/directoryTypes';

export function DirectoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // Real-time Socket Event Listener for messaging
  useDirectorySocket();

  const { user } = useAuth();
  const currentUserId = (user as any)?.id || (user as any)?._id || (user as any)?.userId;

  const {
    members,
    pagination,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    loading,
    refreshing,
    onRefresh,
    onLoadMore,
    onCall,
  } = useDirectory();

  const handleBack = () => {
    router.replace({ pathname: '/(resident)/dashboard', params: { openProfile: 'true' } } as any);
  };

  const renderHeader = (
    <View className="gap-3 pb-3">
      {/* Search Bar */}
      <DirectorySearch
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('search_residents', 'Search by name, unit, phone, or role...')}
      />

      {/* Category Tabs */}
      <DirectoryCategoryTabs activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );

  return (
    <ScreenShell
      title={t('community_directory', 'Community Directory')}
      subtitle={t('nav_community_directory_sub', 'Find and contact residents, security & community staff')}
      iconName="Users"
      showBackButton={true}
>
      <View className="flex-1 bg-background">
        <PaginatedList<DirectoryMember>
          data={members}
          renderItem={(member) => (
            <DirectoryContactCard
              key={member.id || member.userId}
              member={member}
              currentUserId={currentUserId}
              onCall={onCall}
            />
          )}
          keyExtractor={(member) => member.id || member.userId}
          pagination={pagination}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onLoadMore={onLoadMore}
          ListHeaderComponent={renderHeader}
          emptyIcon="Users"
          emptyTitle={t('no_members_found', 'No Directory Members Found')}
          emptySubtitle={t('no_members_sub', 'No community records match your current search or filter.')}
          contentContainerClassName="px-4 pt-3 pb-28"
        />
      </View>
    </ScreenShell>
  );
}

export default DirectoryScreen;

