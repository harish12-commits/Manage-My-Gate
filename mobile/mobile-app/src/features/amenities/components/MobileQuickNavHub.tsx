import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { ActionGrid, type ActionGridItem } from '@/components/ui/ActionGrid';
export interface QuickNavItem extends ActionGridItem {}
import { useAmenityDashboard } from '../hooks/useAmenityDashboard';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';

export interface MobileQuickNavHubProps {
  searchQuery?: string;
}

export function MobileQuickNavHub({ searchQuery = '' }: MobileQuickNavHubProps) {
  const { user } = useAuth();
  const { dashboardStats } = useAmenityDashboard();

  const walletState = useSelector((state: RootState) => (state as any).wallet);
  const myBookingsState = useSelector((state: RootState) => (state as any).amenityBookings);
  const securityLogsState = useSelector((state: RootState) => (state as any).securityLogs);

  // Dynamic real-time metrics extraction from backend store & Socket listeners
  const totalAmenities =
    dashboardStats?.amenityKpis?.activeAmenities ??
    dashboardStats?.amenityKpis?.totalAmenities ??
    dashboardStats?.kpis?.totalAmenities ??
    0;

  const upcomingBookings =
    dashboardStats?.bookingKpis?.upcomingBookings ??
    dashboardStats?.bookingKpis?.todayBookings ??
    0;

  const monthlyRevenue =
    dashboardStats?.revenue?.monthlyRevenue ??
    dashboardStats?.revenue?.dailyRevenue ??
    0;

  const activeMaintenance =
    dashboardStats?.amenityKpis?.underMaintenance ??
    dashboardStats?.kpis?.activeMaintenance ??
    0;

  const myBookingsCount =
    myBookingsState?.myBookings?.length ??
    dashboardStats?.bookingKpis?.totalBookings ??
    0;

  const walletBalance = walletState?.balance ?? 0;

  const securityLogsCount =
    securityLogsState?.totalCount ??
    securityLogsState?.securityLogs?.length ??
    0;

  const formatRevenueBadge = (amount: number): string => {
    if (!amount) return '₹0';
    if (amount >= 1000000) return `₹${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₹${Math.round(amount / 1000)}k`;
    return `₹${amount}`;
  };

  const dynamicNavItems: (ActionGridItem & { permission?: string })[] = [
    {
      id: 'amenities_master',
      name: 'Amenity Master',
      route: '/(resident)/amenities/admin-master',
      iconName: 'SlidersHorizontal',
      colorBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      colorIcon: '#EA8A00',
      badge: totalAmenities > 0 ? String(totalAmenities) : undefined,
      badgeColor: 'bg-amber-500',
      permission: 'amenities:amenities',
    },
    {
      id: 'amenities_admin_calendar',
      name: 'Admin Calendar',
      route: '/(resident)/amenities/admin-calendar',
      iconName: 'CalendarCog',
      colorBg: 'bg-purple-500/10 dark:bg-purple-500/20',
      colorIcon: '#7C3AED',
      badge: upcomingBookings > 0 ? String(upcomingBookings) : undefined,
      badgeColor: 'bg-purple-500',
      permission: 'amenities:admin_calander',
    },
    {
      id: 'amenities_ledgers',
      name: 'Ledgers',
      route: '/(resident)/amenities/ledgers',
      iconName: 'BookOpenCheck',
      colorBg: 'bg-pink-500/10 dark:bg-pink-500/20',
      colorIcon: '#C0267A',
      badge: monthlyRevenue > 0 ? formatRevenueBadge(monthlyRevenue) : undefined,
      badgeColor: 'bg-pink-500',
      permission: 'amenities:ledgers',
    },
    {
      id: 'amenities_maintenance',
      name: 'Maintenance',
      route: '/(resident)/amenities/maintenance',
      iconName: 'Wrench',
      colorBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      colorIcon: '#EA8A00',
      badge: activeMaintenance > 0 ? String(activeMaintenance) : undefined,
      badgeColor: 'bg-amber-500',
      permission: 'amenities:maintenance',
    },
    {
      id: 'amenities_discover',
      name: 'Discover',
      route: '/(resident)/amenities/discover',
      iconName: 'Compass',
      colorBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      colorIcon: '#6366F1',
      permission: 'amenities:discover',
    },
    {
      id: 'amenities_my_booking',
      name: 'My Bookings',
      route: '/(resident)/amenities/my-bookings',
      iconName: 'CalendarCheck',
      colorBg: 'bg-blue-500/10 dark:bg-blue-500/20',
      colorIcon: '#2563EB',
      badge: myBookingsCount > 0 ? String(myBookingsCount) : undefined,
      badgeColor: 'bg-blue-500',
      permission: 'amenities:my_booking',
    },
    {
      id: 'amenities_scanner',
      name: 'Security Scanner',
      route: '/(resident)/amenities/scanner',
      iconName: 'ScanQrCode',
      colorBg: 'bg-teal-500/10 dark:bg-teal-500/20',
      colorIcon: '#0F9F8F',
      badge: 'LIVE',
      badgeColor: 'bg-teal-600',
      permission: 'amenities:scanner',
    },
    {
      id: 'amenities_security_logs',
      name: 'Security Logs',
      route: '/(resident)/amenities/security-logs',
      iconName: 'ClipboardList',
      colorBg: 'bg-slate-500/10 dark:bg-slate-500/20',
      colorIcon: '#475569',
      badge: securityLogsCount > 0 ? String(securityLogsCount) : undefined,
      badgeColor: 'bg-slate-600',
      permission: 'amenities:security_logs',
    },
  ];

  const permittedItems = dynamicNavItems.filter((item) =>
    user ? isFeatureAllowedForUser({ id: item.id, permission: item.permission }, user) : true
  );

  return (
    <ActionGrid
      title="Quick Actions"
      items={permittedItems}
      searchQuery={searchQuery}
    />
  );
}

export default MobileQuickNavHub;
