import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity, Alert, Linking } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { HeaderActionButton } from '@/components/ui/HeaderActionButton';
import { InviteStaffVendorSheet } from '../components/InviteStaffVendorSheet';
import { Users, Phone, MessageSquare, Edit3, Trash2, UserPlus, Shield, Wrench } from 'lucide-react-native';
import { technicianService, TechnicianData } from '../services/technicianService';
import { getStatusTabStyle } from '@/components/ui/statusTabColors';

const DEFAULT_DIRECTORY: TechnicianData[] = [
  {
    _id: 'tech_1',
    name: 'Ravi Kumar',
    phone: '+91 98765 43210',
    email: 'ravi.plumber@community.com',
    department: 'Plumbing',
    specialization: 'Plumber',
    type: 'In-House Staff',
    status: 'Active',
    activeJobsCount: 0,
  },
  {
    _id: 'tech_2',
    name: 'Suresh Verma',
    phone: '+91 98765 43211',
    email: 'suresh.electric@community.com',
    department: 'Electrical',
    specialization: 'Electrician',
    type: 'In-House Staff',
    status: 'Active',
    activeJobsCount: 1,
  },
  {
    _id: 'tech_3',
    name: 'Apex Electrical Solutions',
    phone: '+91 98765 43299',
    email: 'contact@apexelectrical.com',
    department: 'Electrical',
    specialization: 'High Voltage & HVAC',
    type: 'External Vendor',
    status: 'Active',
    activeJobsCount: 0,
  },
  {
    _id: 'tech_4',
    name: 'Amit Carpenter',
    phone: '+91 98765 43212',
    department: 'Carpentry',
    specialization: 'Carpenter',
    type: 'In-House Staff',
    status: 'Pending',
    activeJobsCount: 0,
  },
];

export function StaffVendorDirectoryScreen() {
  const [technicians, setTechnicians] = useState<TechnicianData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedTypeTab, setSelectedTypeTab] = useState<'ALL' | 'IN_HOUSE' | 'VENDOR'>('ALL');

  const [editingTechnician, setEditingTechnician] = useState<TechnicianData | null>(null);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [deletingTechnician, setDeletingTechnician] = useState<TechnicianData | null>(null);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setError(null);
    technicianService
      .getAll()
      .then((res: any) => {
        const list = res?.data || res || [];
        if (Array.isArray(list)) {
          setTechnicians(list);
        }
      })
      .catch((err: any) => {
        console.log('[StaffDirectory] Technician fetch failed:', err);
        setTechnicians([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute Count Metrics for Filter Pills
  const counts = useMemo(() => {
    const total = technicians.length;
    const inHouse = technicians.filter((t) => t.type === 'In-House Staff').length;
    const vendors = technicians.filter((t) => t.type === 'External Vendor').length;
    return { total, inHouse, vendors };
  }, [technicians]);

  // Filtered Technicians
  const filteredTechnicians = useMemo(() => {
    return technicians.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesPhone = item.phone?.toLowerCase().includes(q);
        const matchesDept = item.department?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesDept) return false;
      }

      // 2. Department Filter
      if (selectedDepartment !== 'All Departments' && item.department !== selectedDepartment) {
        return false;
      }

      // 3. Category Type Filter
      if (selectedTypeTab === 'IN_HOUSE' && item.type !== 'In-House Staff') return false;
      if (selectedTypeTab === 'VENDOR' && item.type !== 'External Vendor') return false;

      return true;
    });
  }, [technicians, searchQuery, selectedDepartment, selectedTypeTab]);

  const handleCall = (phone?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  const handleWhatsApp = (phone?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  const handleSaveTechnician = async (data: TechnicianData) => {
    if (data._id) {
      // Edit
      await technicianService.update(data._id, data);
    } else {
      // Create
      await technicianService.create(data);
    }
    loadData();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTechnician?._id) return;
    try {
      await technicianService.delete(deletingTechnician._id);
      setDeletingTechnician(null);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete technician.');
    }
  };

  const departmentTabs = [
    'All Departments',
    'Electrical',
    'Plumbing',
    'Housekeeping',
    'Security',
    'Carpentry',
    'Elevators',
    'AC & HVAC',
    'Others',
  ];

  return (
    <ScreenShell
      title="Staff & Vendors Directory"
      subtitle="Manage technicians and active staff accounts"
      iconName="Users"
      loading={isLoading && technicians.length === 0}
      headerRight={
        <HeaderActionButton
          icon={UserPlus}
          label="Add Staff"
          onPress={() => {
            setEditingTechnician(null);
            setShowInviteSheet(true);
          }}
          accessibilityLabel="Add Staff"
        />
      }
    >
      <View className="flex-1 bg-background">
        {error ? (
          <View className="px-4 pt-3">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </View>
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} tintColor="#6366f1" />}
        >
          {/* TOP SEARCH BAR & CANONICAL TYPE FILTER PILLS */}
          <View className="px-4 pt-3 pb-1">
            <SearchFilterBar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search name, phone, trade..."
              sortOptions={[
                { label: `All Staff (${counts.total})`, value: 'ALL' },
                { label: `In-House (${counts.inHouse})`, value: 'IN_HOUSE' },
                { label: `Vendors (${counts.vendors})`, value: 'VENDOR' },
              ]}
              currentSort={selectedTypeTab}
              onSortChange={(val) => setSelectedTypeTab(val as any)}
              variant="default"
              className="px-0 py-0 border-0"
            />
          </View>

          {/* HORIZONTAL DEPARTMENT FILTER CHIPS */}
          <View className="px-4 py-1.5">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 py-1">
              {departmentTabs.map((dept) => {
                const isActive = selectedDepartment === dept;
                const statusStyle = getStatusTabStyle(dept, isActive);
                return (
                  <TouchableOpacity
                    key={dept}
                    activeOpacity={0.8}
                    onPress={() => setSelectedDepartment(dept)}
                    className={`px-3 py-1.5 rounded-full border me-1.5 ${statusStyle.containerClass}`}
                  >
                    <Text className={`text-xs ${statusStyle.textClass}`}>
                      {dept}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* STAFF & VENDORS LIST FEED */}
          <View className="px-4 pt-1 gap-2.5">
            {filteredTechnicians.length === 0 ? (
              <View className="pt-6">
                <EmptyState
                  icon={Users}
                  title="No Staff Found"
                  description="No technicians or vendors match your search criteria."
                />
              </View>
            ) : (
              filteredTechnicians.map((tech) => {
                const isVendor = tech.type === 'External Vendor';
                const isBusy = (tech.activeJobsCount || 0) > 0;

                return (
                  <View
                    key={tech._id}
                    className="bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs gap-2.5"
                  >
                    {/* Header Row: Avatar, Name, Specialization & Badges */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1 me-2">
                        <View
                          style={{
                            backgroundColor: isVendor ? '#f5f3ff' : '#eff6ff',
                            borderColor: isVendor ? '#ddd6fe' : '#bfdbfe',
                            borderWidth: 1,
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 10,
                          }}
                        >
                          <Icon as={isVendor ? Shield : Wrench} size={20} color={isVendor ? '#8b5cf6' : '#2563eb'} />
                        </View>

                        <View className="flex-1">
                          <Text className="text-sm font-extrabold text-foreground">{tech.name}</Text>
                          <Text className="text-xs font-medium text-muted-foreground">
                            {tech.specialization || tech.department} • {tech.type}
                          </Text>
                        </View>
                      </View>

                      <View className="items-end gap-1">
                        <StatusBadge
                          label={tech.status}
                          variant={tech.status === 'Active' ? 'success' : tech.status === 'Pending' ? 'warning' : 'neutral'}
                        />
                        <StatusBadge
                          label={isBusy ? `Busy (${tech.activeJobsCount})` : 'Available'}
                          variant={isBusy ? 'warning' : 'info'}
                          dot
                        />
                      </View>
                    </View>

                    {/* Contact Details */}
                    <View className="pt-2 border-t border-border/40 flex-row items-center justify-between">
                      <View className="flex-1 me-2">
                        <Text className="text-xs font-semibold text-foreground">{tech.phone}</Text>
                        {tech.email ? (
                          <Text className="text-[11px] text-muted-foreground">{tech.email}</Text>
                        ) : null}
                      </View>

                      {/* QUICK ACTION BUTTONS (CALL, WHATSAPP, EDIT, DELETE) */}
                      <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleCall(tech.phone)}
                          style={{
                            backgroundColor: '#ecfdf5',
                            borderColor: '#a7f3d0',
                            borderWidth: 1,
                            padding: 8,
                            borderRadius: 10,
                          }}
                        >
                          <Icon as={Phone} size={15} color="#059669" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleWhatsApp(tech.phone)}
                          style={{
                            backgroundColor: '#f0fdf4',
                            borderColor: '#bbf7d0',
                            borderWidth: 1,
                            padding: 8,
                            borderRadius: 10,
                          }}
                        >
                          <Icon as={MessageSquare} size={15} color="#16a34a" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setEditingTechnician(tech);
                            setShowInviteSheet(true);
                          }}
                          style={{
                            backgroundColor: '#f8fafc',
                            borderColor: '#cbd5e1',
                            borderWidth: 1,
                            padding: 8,
                            borderRadius: 10,
                          }}
                        >
                          <Icon as={Edit3} size={15} color="#475569" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => setDeletingTechnician(tech)}
                          style={{
                            backgroundColor: '#fef2f2',
                            borderColor: '#fecdd3',
                            borderWidth: 1,
                            padding: 8,
                            borderRadius: 10,
                          }}
                        >
                          <Icon as={Trash2} size={15} color="#e11d48" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* INVITE / EDIT SHEET */}
        <InviteStaffVendorSheet
          visible={showInviteSheet}
          technician={editingTechnician}
          onClose={() => {
            setShowInviteSheet(false);
            setEditingTechnician(null);
          }}
          onSave={handleSaveTechnician}
        />

        {/* DELETE CONFIRMATION MODAL */}
        <ConfirmationModal
          visible={!!deletingTechnician}
          title={`Remove ${deletingTechnician?.name}?`}
          message="Are you sure you want to remove this staff member or external vendor from the directory?"
          confirmLabel="Yes, Remove"
          cancelLabel="Cancel"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingTechnician(null)}
        />
      </View>
    </ScreenShell>
  );
}

export default StaffVendorDirectoryScreen;
