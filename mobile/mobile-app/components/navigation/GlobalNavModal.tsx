import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { SearchBar } from '@/components/forms/SearchBar';
import { useTranslation } from '@/src/utils/i18n';
import {
  Compass,
  X,
  Wrench,
  Building2,
  Receipt,
  ShieldCheck,
  Calendar,
  Search,
  PlusCircle,
  Users,
  Wallet,
  QrCode,
  Sliders,
  Home,
  Settings,
  Sparkles,
  Megaphone,
  AlertCircle,
  ClipboardCheck,
} from 'lucide-react-native';

import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';

export interface GlobalNavItem {
  id: string;
  labelKey: string;
  defaultLabel: string;
  route: string;
  icon: any;
  color: string;
  badge?: string;
  permission?: string;
}

export interface GlobalNavCategory {
  titleKey: string;
  defaultTitle: string;
  items: GlobalNavItem[];
}

interface GlobalNavModalProps {
  visible: boolean;
  onClose: () => void;
}

export const GlobalNavModal: React.FC<GlobalNavModalProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation();

  const rawCategories: GlobalNavCategory[] = [
    {
      titleKey: 'nav_dashboard_overview',
      defaultTitle: 'DASHBOARD & OVERVIEW',
      items: [
        { id: 'dash-main', labelKey: 'home', defaultLabel: 'Home Dashboard', route: '/(resident)/dashboard', icon: Home, color: '#3b82f6' },
        { id: 'dash-comp', labelKey: 'complaints_dashboard', defaultLabel: 'Complaints Dashboard', route: '/(resident)/complaints/dashboard', icon: Wrench, color: '#f59e0b' },
      ],
    },
    {
      titleKey: 'nav_community_directory',
      defaultTitle: 'COMMUNITY & DIRECTORY',
      items: [
        { id: 'cd-engagement', labelKey: 'community_engagement', defaultLabel: 'Community Engagement', route: '/(resident)/community-engagement', icon: Megaphone, color: '#6366f1', badge: 'NEW', permission: 'notices:polls' },
        { id: 'cd-directory', labelKey: 'community_directory', defaultLabel: 'Community Directory', route: '/(resident)/directory/index', icon: Users, color: '#10b981' },
        { id: 'cd-notes', labelKey: 'all_community_notes', defaultLabel: 'All Community Notes', route: '/(resident)/notes/index', icon: Sparkles, color: '#ec4899', badge: '24h' },
      ],
    },
    {
      titleKey: 'nav_complaints_maintenance',
      defaultTitle: 'COMPLAINTS & MAINTENANCE',
      items: [
        { id: 'c-raise', labelKey: 'feature_complaints_raise_ticket_name', defaultLabel: 'Raise Ticket', route: '/(resident)/complaints/raise-ticket', icon: PlusCircle, color: '#3b82f6' },
        { id: 'c-my', labelKey: 'feature_complaints_track_requests_name', defaultLabel: 'Track My Tickets', route: '/(resident)/complaints/my-tickets', icon: Search, color: '#f59e0b' },
        { id: 'c-manage', labelKey: 'feature_complaints_complaint_management_name', defaultLabel: 'Management Board', route: '/(resident)/complaints/manage', icon: Sliders, color: '#6366f1' },
        { id: 'c-staff', labelKey: 'feature_complaints_staff_name', defaultLabel: 'Staff Directory', route: '/(resident)/complaints/staff', icon: Users, color: '#10b981' },
        { id: 'c-issues', labelKey: 'issue_reports', defaultLabel: 'App Issue Reports', route: '/(resident)/complaints/issue-reports', icon: AlertCircle, color: '#f43f5e' },
      ],
    },
    {
      titleKey: 'nav_amenities_bookings',
      defaultTitle: 'AMENITIES & BOOKINGS',
      items: [
        { id: 'a-discover', labelKey: 'feature_amenities_discover_name', defaultLabel: 'Discover Amenities', route: '/(resident)/amenities/discover', icon: Building2, color: '#14b8a6', permission: 'amenities:discover' },
        { id: 'a-bookings', labelKey: 'feature_amenities_my_booking_name', defaultLabel: 'My Booking Passes', route: '/(resident)/amenities/my-bookings', icon: Calendar, color: '#6366f1', permission: 'amenities:my_booking' },
        { id: 'a-scanner', labelKey: 'feature_amenities_scanner_name', defaultLabel: 'QR Scanner', route: '/(resident)/amenities/scanner', icon: QrCode, color: '#a855f7', permission: 'amenities:scanner' },
        { id: 'a-settings', labelKey: 'feature_amenities_settings_name', defaultLabel: 'Amenity Settings', route: '/(resident)/amenities/settings', icon: Settings, color: '#6366f1', permission: 'amenities:settings' },
        { id: 'a-dashboard', labelKey: 'feature_amenities_dashboard_name', defaultLabel: 'Amenity Dashboard', route: '/(resident)/amenities/dashboard', icon: Sliders, color: '#2563eb', permission: 'amenities:dashboard' },
        { id: 'a-queue', labelKey: 'feature_amenities_admin_bookings_name', defaultLabel: 'Booking Queue', route: '/(resident)/amenities/admin-bookings', icon: ClipboardCheck, color: '#d97706', permission: 'amenities:admin_calander' },
        { id: 'a-calendar', labelKey: 'feature_amenities_admin_calendar_name', defaultLabel: 'Admin Calendar', route: '/(resident)/amenities/admin-calendar', icon: Calendar, color: '#7c3aed', permission: 'amenities:admin_calander' },
        { id: 'a-master', labelKey: 'feature_amenities_master_name', defaultLabel: 'Amenity Master', route: '/(resident)/amenities/admin-master', icon: Sliders, color: '#ea580c', permission: 'amenities:amenities' },
        { id: 'a-maintenance', labelKey: 'feature_amenities_maintenance_name', defaultLabel: 'Maintenance Scheduler', route: '/(resident)/amenities/maintenance', icon: Wrench, color: '#f59e0b', permission: 'amenities:maintenance' },
        { id: 'a-ledgers', labelKey: 'feature_amenities_ledgers_name', defaultLabel: 'Amenity Ledgers', route: '/(resident)/amenities/ledgers', icon: Receipt, color: '#0d9488', permission: 'amenities:ledgers' },
      ],
    },
    {
      titleKey: 'nav_digital_wallet',
      defaultTitle: 'DIGITAL WALLET & LEDGER',
      items: [
        { id: 'billing_wallet', labelKey: 'feature_billing_wallet_name', defaultLabel: 'Digital Wallet', route: '/(resident)/billing/wallet', icon: Wallet, color: '#10b981', permission: 'billing:action_center' },
        { id: 'financial_history', labelKey: 'financial_history', defaultLabel: 'Financial History', route: '/(resident)/billing/history', icon: Receipt, color: '#0d9488', permission: 'billing:action_center' },
      ],
    },
    {
      titleKey: 'nav_billing_invoices',
      defaultTitle: 'BILLING & INVOICES',
      items: [
        { id: 'b-main', labelKey: 'feature_billing_dashboard_name', defaultLabel: 'Billing Center', route: '/(resident)/billing', icon: Receipt, color: '#10b981' },
        { id: 'b-dues', labelKey: 'feature_billing_my_dues_name', defaultLabel: 'My Outstanding Dues', route: '/(resident)/billing/my-dues', icon: Receipt, color: '#f43f5e' },
      ],
    },
    {
      titleKey: 'nav_visitors_security',
      defaultTitle: 'VISITORS & SECURITY',
      items: [
        { id: 'v-main', labelKey: 'feature_visitor_resident_passes_name', defaultLabel: 'Visitor Pass Hub', route: '/(resident)/visitor', icon: ShieldCheck, color: '#8b5cf6', permission: 'visitor:resident' },
        { id: 'v-gate-console', labelKey: 'feature_visitor_gate_console_name', defaultLabel: 'Gate Console', route: '/(resident)/visitor/gate-console', icon: QrCode, color: '#10b981', permission: 'visitor:resident' },
      ],
    },
    {
      titleKey: 'nav_preferences_settings',
      defaultTitle: 'PREFERENCES & SETTINGS',
      items: [
        { id: 's-app', labelKey: 'app_settings', defaultLabel: 'App Settings', route: '/(resident)/settings', icon: Settings, color: '#64748b' },
        { id: 's-workspace', labelKey: 'feature_admin_workspace_settings_name', defaultLabel: 'Workspace Settings', route: '/(resident)/admin/workspace-settings', icon: Sliders, color: '#475569' },
      ],
    },
  ];

  const handleNavigate = (route: string) => {
    onClose();
    router.push(route as any);
  };

  const { user } = useAuth();

  const filteredCategories = rawCategories
    .map((cat) => {
      const localizedTitle = t(cat.titleKey, cat.defaultTitle);
      const localizedItems = cat.items
        .filter((item) => {
          if (!item.permission) return true;
          return user ? isFeatureAllowedForUser({ id: item.id, permission: item.permission }, user) : true;
        })
        .map((item) => ({
          ...item,
          label: t(item.labelKey, item.defaultLabel),
        }))
        .filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      return {
        title: localizedTitle,
        items: localizedItems,
      };
    })
    .filter((cat) => cat.items.length > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-card border-t border-border rounded-t-3xl h-[85%] p-4 shadow-2xl gap-3">
          {/* Header Bar */}
          <View className="flex-row items-center justify-between pb-3 border-b border-border/80">
            <View className="flex-row items-center gap-2">
              <View className="bg-primary/15 p-2 rounded-xl border border-primary/25">
                <Icon as={Compass} size={20} className="text-primary" />
              </View>
              <View>
                <Text className="text-base font-bold text-foreground">{t('global_navigation', 'Global Easy Navigation')}</Text>
                <Text className="text-xs text-muted-foreground">{t('jump_to_feature', 'Jump to any module or feature instantly')}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="h-11 w-11 items-center justify-center rounded-full bg-secondary border border-border/60 active:bg-muted"
              accessibilityRole="button"
              accessibilityLabel={t('close', 'Close')}
            >
              <Icon as={X} size={17} className="text-foreground" />
            </TouchableOpacity>
          </View>

          {/* Search Filter Bar */}
          <View className="my-1">
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('search_placeholder', 'Search features, tools & services...')}
            />
          </View>

          {/* Categorized Navigation List */}
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {filteredCategories.length > 0 ? (
              filteredCategories.map((category, catIdx) => (
                <View key={catIdx} className="mb-5">
                  <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5 px-1">
                    {category.title}
                  </Text>

                  <View className="flex-row flex-wrap justify-between gap-y-2.5">
                    {category.items.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => handleNavigate(item.route)}
                        className="w-[48.5%] bg-card p-3 rounded-2xl border border-border/80 flex-row items-center justify-between active:bg-secondary/50 shadow-xs relative"
                      >
                        {item.badge ? (
                          <View className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 bg-primary rounded-full z-10">
                            <Text className="text-[9px] font-bold text-primary-foreground">{item.badge}</Text>
                          </View>
                        ) : null}

                        <View className="flex-row items-center flex-1 me-1">
                          <View className="w-8 h-8 rounded-xl bg-secondary border border-border/50 items-center justify-center me-2.5 shrink-0">
                            <Icon as={item.icon} size={16} color={item.color} />
                          </View>
                          <Text className="text-xs font-bold text-foreground flex-1 text-start" numberOfLines={1}>
                            {item.label}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <View className="p-8 items-center justify-center bg-card rounded-2xl border border-border mt-4">
                <Text className="text-xs font-semibold text-muted-foreground">
                  {t('no_matching_feature', 'No matching feature found for')} "{searchQuery}"
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default GlobalNavModal;
