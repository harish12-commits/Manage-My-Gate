import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from '@/src/utils/i18n';
import { useNoticeBoard } from '../hooks/useNoticeBoard';

const ALL_NAV_ITEMS = [
  { id: 'dashboard', name: 'Dashboard', route: '/(resident)/notices/dashboard' },
  { id: 'active_notice', name: 'Active Notice', route: '/(resident)/notices' },
  { id: 'manage_notices', name: 'Manage Notices', route: '/(resident)/notices/manage', requiresManage: true },
  { id: 'polls', name: 'Polls', route: '/(resident)/polls' },
  { id: 'engagement_hub', name: 'Engagement Hub', route: '/(resident)/community-engagement' },
];

export function NoticeBoardTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { canManage, isAdmin } = useNoticeBoard();

  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.requiresManage) {
      return canManage || isAdmin;
    }
    return true;
  });

  return (
    <View className="border-b border-border/40 px-2 pb-0 bg-card">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-2">
        {navItems.map((item) => {
          const routeEnd = item.route.split('/').pop();
          const isIndex = routeEnd === 'notices';
          let isActive = false;
          if (isIndex) {
            isActive = pathname.endsWith('/notices') || pathname.endsWith('/notices/');
          } else {
            isActive = pathname.endsWith(`/${routeEnd}`);
          }

          const displayName = t(item.id, item.name);

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.navigate(item.route)}
              className={`px-4 py-3 me-2 border-b-2 ${isActive ? 'border-primary' : 'border-transparent'}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={item.name}
            >
              <Text className={`text-sm font-bold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {displayName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default NoticeBoardTopNav;
