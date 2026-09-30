import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { ScreenShell } from '@/components/ui/ScreenShell';
import { ScrollContainer } from '@/components/layout/ScrollContainer';
import { TextInput } from '@/components/forms/TextInput';
import { ToggleSwitch } from '@/components/forms/ToggleSwitch';
import { DatePicker } from '@/components/common/DatePicker';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { AttachmentPicker } from '@/components/ui/AttachmentPicker';
import { getStatusTabStyle } from '@/components/ui/statusTabColors';

import { useNoticeBoard } from '../hooks/useNoticeBoard';
import { ErrorBoundary } from '../components';
import { fetchRoles } from '@/src/features/roleBuilder/services/roleService';
import { fetchUsers } from '@/src/features/userManagement/services/userService';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import {
  FileText,
  Tag,
  Calendar,
  ShieldAlert,
  Paperclip,
  Users,
  User,
  Briefcase,
  Building,
} from 'lucide-react-native';

const CATEGORY_OPTIONS = [
  { label: 'General', value: 'General' },
  { label: 'Maintenance', value: 'Maintenance' },
  { label: 'Events', value: 'Events' },
  { label: 'Emergency', value: 'Emergency' },
  { label: 'Meetings', value: 'Meetings' },
];

const PRIORITY_OPTIONS = [
  { label: 'Low', value: 'Low' },
  { label: 'Medium', value: 'Medium' },
  { label: 'High', value: 'High' },
];

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'Draft' },
  { label: 'Published', value: 'Published' },
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'Archived', value: 'Archived' },
];

// Validation Schema using Yup
const schema = yup.object().shape({
  title: yup.string().trim().required('Title is required').max(100, 'Title is too long'),
  description: yup.string().trim().required('Announcement details are required'),
  category: yup.string().required('Category is required'),
  priority: yup.string().required('Priority level is required'),
  status: yup.string().required('Publish status is required'),
  isPinned: yup.boolean(),
  allowComments: yup.boolean().default(true),
  allowReactions: yup.boolean().default(true),
  expiryDate: yup.date().required('Expiry date is required'),
  scheduleDate: yup.date().when('status', {
    is: 'Scheduled',
    then: (s) => s.required('Schedule date is required').min(new Date(Date.now() - 60000), 'Schedule date must be in the future'),
    otherwise: (s) => s.notRequired(),
  }),
  targetType: yup.string().default('ALL'),
  selectedResidentType: yup.string().default('Resident'),
  selectedRoleId: yup.string().nullable().optional(),
  selectedUserId: yup.string().nullable().optional(),
});

export default function CreateEditNoticeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isEditMode = !!id;

  const {
    selectedNotice,
    loading,
    error,
    success,
    loadNoticeById,
    submitNotice,
    modifyNotice,
    clearNoticeSuccess,
    clearNoticeErrors,
    resetFilters,
  } = useNoticeBoard();

  const [images, setImages] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);

  // Fetch roles and users for audience selection
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const rolesRes = await fetchRoles({ page: 1, limit: 100 });
        const rolesData = rolesRes?.data?.data || rolesRes?.data || [];
        if (isMounted) setAvailableRoles(rolesData);
      } catch (e) {
        console.warn('Could not fetch roles for audience:', e);
      }
      try {
        const usersRes = await fetchUsers({ page: 1, limit: 100 });
        const usersData = usersRes?.data || usersRes || [];
        if (isMounted && Array.isArray(usersData)) setAvailableUsers(usersData);
      } catch (e) {
        console.warn('Could not fetch users for audience:', e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      category: 'General',
      priority: 'Medium',
      status: 'Published',
      isPinned: false,
      allowComments: true,
      allowReactions: true,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      scheduleDate: new Date(),
      targetType: 'ALL',
      selectedResidentType: 'Resident',
      selectedRoleId: '',
      selectedUserId: '',
    },
  });

  const selectedStatus = watch('status');
  const watchTargetType = watch('targetType');

  // Load notice details on mount if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      loadNoticeById(id);
    }
    return () => {
      clearNoticeErrors();
    };
  }, [id, isEditMode]);

  // Sync notice details to react-hook-form on load
  useEffect(() => {
    if (isEditMode && selectedNotice && selectedNotice._id === id) {
      const aud = selectedNotice.targetAudience || {};
      let initialTargetType = aud.targetType || 'ALL';
      let initialResidentType = 'Resident';
      let initialRoleId = '';
      let initialUserId = '';

      if (initialTargetType === 'ROLES' && Array.isArray(aud.targetRoles) && aud.targetRoles.length > 0) {
        const r = aud.targetRoles[0];
        initialRoleId = typeof r === 'string' ? r : r._id || r.id || '';
      } else if (initialTargetType === 'RESIDENCY_TYPES' && Array.isArray(aud.targetResidencyTypes) && aud.targetResidencyTypes.length > 0) {
        const rt = aud.targetResidencyTypes[0];
        if (rt === 'Owner' || rt === 'Resident Owner') {
          initialTargetType = 'OWNERS';
          initialResidentType = rt;
        } else {
          initialResidentType = rt;
        }
      } else if (initialTargetType === 'CUSTOM' && Array.isArray(aud.targetUsers) && aud.targetUsers.length > 0) {
        const u = aud.targetUsers[0];
        initialUserId = typeof u === 'string' ? u : u._id || u.id || '';
      }

      reset({
        title: selectedNotice.title || '',
        description: selectedNotice.description || '',
        category: selectedNotice.category || 'General',
        priority: selectedNotice.priority || 'Medium',
        status: selectedNotice.status || 'Published',
        isPinned: selectedNotice.isPinned || false,
        allowComments: selectedNotice.allowComments !== false,
        allowReactions: selectedNotice.allowReactions !== false,
        expiryDate: selectedNotice.expiryDate ? new Date(selectedNotice.expiryDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scheduleDate: selectedNotice.scheduleDate ? new Date(selectedNotice.scheduleDate) : new Date(),
        targetType: initialTargetType,
        selectedResidentType: initialResidentType,
        selectedRoleId: initialRoleId,
        selectedUserId: initialUserId,
      });

      if (selectedNotice.images && Array.isArray(selectedNotice.images)) {
        setImages(
          selectedNotice.images.map((img) => ({
            id: img._id || img.url,
            uri: img.url,
            name: img.url.split('/').pop() || 'Remote_Image.jpg',
            type: 'image/jpeg',
            isRemote: true,
          }))
        );
      }
    }
  }, [selectedNotice, isEditMode, id, reset]);

  // Navigate back on successful save
  useEffect(() => {
    if (success === 'createSuccess' || success === 'updateSuccess') {
      clearNoticeSuccess();
      resetFilters();
      router.navigate('/(resident)/notices/manage');
    }
  }, [success, clearNoticeSuccess, resetFilters, router]);

  // AttachmentPicker Handlers
  const handleAddAttachments = useCallback((newFiles) => {
    const formatted = newFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      uri: file.uri,
      name: file.name || `photo_${Date.now()}.jpg`,
      type: file.type || 'image/jpeg',
      isRemote: false,
      file: file.file, // Keep the raw File object for web uploading
    }));
    setImages((prev) => {
      const combined = [...prev, ...formatted];
      return combined.slice(0, 5); // Enforce max 5 attachments
    });
  }, []);

  const handleRemoveAttachment = useCallback((index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onSubmit = async (data) => {
    const formData = new FormData();
    formData.append('title', data.title.trim());
    formData.append('description', data.description.trim());
    formData.append('category', data.category);
    formData.append('isCritical', 'false');
    formData.append('priority', data.priority || 'Medium');
    formData.append('status', data.status);
    formData.append('expiryDate', data.expiryDate.toISOString());
    formData.append('isPinned', data.isPinned ? 'true' : 'false');
    formData.append('allowComments', data.allowComments !== false ? 'true' : 'false');
    formData.append('allowReactions', data.allowReactions !== false ? 'true' : 'false');
    formData.append('requiresAcknowledgement', 'false');

    if (data.status === 'Scheduled' && data.scheduleDate) {
      formData.append('scheduleDate', data.scheduleDate.toISOString());
    }

    // Build targetAudience payload based on selected audience type
    let targetAudience = { targetType: 'ALL' };
    if (data.targetType === 'STAFF_ONLY') {
      // Find staff/security roles
      const staffRoleIds = availableRoles
        .filter((r) => {
          const n = (r.name || '').toLowerCase();
          return n.includes('staff') || n.includes('security') || n.includes('guard') || n.includes('technician');
        })
        .map((r) => r._id || r.id);
      
      if (staffRoleIds.length > 0) {
        targetAudience = {
          targetType: 'ROLES',
          targetRoles: staffRoleIds,
        };
      } else {
        targetAudience = {
          targetType: 'RESIDENCY_TYPES',
          targetResidencyTypes: ['Staff'],
        };
      }
    } else if (data.targetType === 'OWNERS_ONLY') {
      targetAudience = {
        targetType: 'RESIDENCY_TYPES',
        targetResidencyTypes: ['Owner', 'Resident Owner', 'Non-Resident Owner'],
      };
    } else if (data.targetType === 'SPECIFIC_RESIDENT') {
      if (data.selectedUserId) {
        targetAudience = {
          targetType: 'CUSTOM',
          targetUsers: [data.selectedUserId],
        };
      } else {
        targetAudience = {
          targetType: 'RESIDENCY_TYPES',
          targetResidencyTypes: ['Resident', 'Tenant', 'Family Member'],
        };
      }
    } else if (data.targetType === 'SPECIFIC_ROLE') {
      if (data.selectedRoleId) {
        targetAudience = {
          targetType: 'ROLES',
          targetRoles: [data.selectedRoleId],
        };
      }
    }
    formData.append('targetAudience', JSON.stringify(targetAudience));

    // Append local files to FormData
    const localImages = images.filter((img) => !img.isRemote);
    localImages.forEach((img) => {
      if (img.file) {
        formData.append('images', img.file);
      } else {
        formData.append('images', {
          uri: img.uri,
          name: img.name,
          type: img.type,
        });
      }
    });

    // Retain remote files to prevent deletion on PUT
    const remoteImages = images.filter((img) => img.isRemote).map((img) => {
      let relativeUrl = img.uri;
      if (relativeUrl.includes('/public/uploads/notices/')) {
        relativeUrl = '/public/uploads/notices/' + relativeUrl.split('/public/uploads/notices/').pop();
      }
      return {
        url: relativeUrl,
        filename: img.name,
      };
    });
    formData.append('existingImages', JSON.stringify(remoteImages));

    if (isEditMode) {
      await modifyNotice(id, formData);
    } else {
      await submitNotice(formData);
    }
  };

  return (
    <ErrorBoundary>
      <ScreenShell
        title={isEditMode ? 'Edit Community Notice' : 'Create Community Notice'}
        subtitle={isEditMode ? 'Update notice lifecycle, priorities & distribution' : 'Compose announcements, schedule releases & notify residents'}
      >
        <ScrollContainer contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {/* API Save Errors */}
          {error && (
            <View className="bg-destructive/15 border border-destructive/30 p-3 rounded-2xl mb-4">
              <Text className="text-destructive font-medium text-start text-xs">{error}</Text>
            </View>
          )}

          {/* Section 1: Notice Content Details */}
          <View className="bg-card border border-border rounded-2xl p-4 gap-4 mb-4 shadow-2xs">
            <View className="flex-row items-center gap-2 border-b border-border/60 pb-3">
              <FileText size={18} className="text-primary" />
              <View className="flex-1">
                <Text variant="large" className="font-bold text-foreground">
                  Notice Content
                </Text>
                <Text variant="muted" className="text-xs">
                  Title and announcement description
                </Text>
              </View>
            </View>

            {/* Title Input */}
            <View>
              <Controller
                control={control}
                name="title"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    label="Notice Title *"
                    value={value}
                    onChangeText={onChange}
                    placeholder="e.g. Scheduled Water Maintenance"
                    error={errors.title?.message}
                  />
                )}
              />
            </View>

            {/* Description Input */}
            <View>
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    label="Announcement Details *"
                    value={value}
                    onChangeText={onChange}
                    placeholder="Type announcement details, schedules, affected areas..."
                    multiline
                    numberOfLines={5}
                    error={errors.description?.message}
                    style={{ minHeight: 110, textAlignVertical: 'top' }}
                  />
                )}
              />
            </View>
          </View>

          {/* Section 2: Classification & Urgency (Pill Selectors matching Visitor Management) */}
          <View className="bg-card border border-border rounded-2xl p-4 gap-4 mb-4 shadow-2xs">
            <View className="flex-row items-center gap-2 border-b border-border/60 pb-3">
              <Tag size={18} className="text-primary" />
              <View className="flex-1">
                <Text variant="large" className="font-bold text-foreground">
                  Classification & Urgency
                </Text>
                <Text variant="muted" className="text-xs">
                  Category tag and broadcast priority level
                </Text>
              </View>
            </View>

            {/* Category Selector (Horizontal Pill Buttons) */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">
                Category *
              </Text>
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                    >
                      {CATEGORY_OPTIONS.map((option) => {
                        const isSelected = value === option.value;
                        const statusStyle = getStatusTabStyle(option.value, isSelected);
                        return (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() => onChange(option.value)}
                            activeOpacity={0.8}
                            className={`flex-row items-center px-4 py-2 rounded-full border ${statusStyle.containerClass}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                          >
                            <Text className={`text-xs font-bold ${statusStyle.textClass}`}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    {errors.category?.message && (
                      <Text className="text-xs text-destructive mt-1">{errors.category?.message}</Text>
                    )}
                  </View>
                )}
              />
            </View>

            {/* Priority Selector (Horizontal Pill Buttons) */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">
                Priority Level *
              </Text>
              <Controller
                control={control}
                name="priority"
                render={({ field: { onChange, value } }) => (
                  <View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                    >
                      {PRIORITY_OPTIONS.map((option) => {
                        const isSelected = value === option.value || (option.value === 'Critical' && value === 'Urgent');
                        const statusStyle = getStatusTabStyle(option.label, isSelected);
                        return (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() => {
                              onChange(option.value);
                            }}
                            activeOpacity={0.8}
                            className={`flex-row items-center px-4 py-2 rounded-full border ${statusStyle.containerClass}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                          >
                            <Text className={`text-xs font-bold ${statusStyle.textClass}`}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    {errors.priority?.message && (
                      <Text className="text-xs text-destructive mt-1">{errors.priority?.message}</Text>
                    )}
                  </View>
                )}
              />
            </View>
          </View>

          {/* Section 3: Target Audience (Everyone, All Staff, Owners Only, Specific Resident, Specific Role) */}
          <View className="bg-card border border-border rounded-2xl p-4 gap-4 mb-4 shadow-2xs">
            <View className="flex-row items-center gap-2 border-b border-border/60 pb-3">
              <Users size={18} className="text-primary" />
              <View className="flex-1">
                <Text variant="large" className="font-bold text-foreground">
                  Target Audience & Recipients
                </Text>
                <Text variant="muted" className="text-xs">
                  Choose who can view and receive this notice
                </Text>
              </View>
            </View>

            {/* Audience Type Selection Pills */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">
                Notice Visibility *
              </Text>
              <Controller
                control={control}
                name="targetType"
                render={({ field: { onChange, value } }) => {
                  const audienceTabs = [
                    { label: 'Everyone (All)', value: 'ALL', icon: Users },
                    { label: 'All Staff & Guards Only', value: 'STAFF_ONLY', icon: Briefcase },
                    { label: 'Owners Only', value: 'OWNERS_ONLY', icon: Building },
                    { label: 'Specific Resident', value: 'SPECIFIC_RESIDENT', icon: User },
                    { label: 'Specific Role', value: 'SPECIFIC_ROLE', icon: Tag },
                  ];

                  return (
                    <View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                      >
                        {audienceTabs.map((tab) => {
                          const isSelected = value === tab.value;
                          const TabIcon = tab.icon;
                          return (
                            <TouchableOpacity
                              key={tab.value}
                              onPress={() => onChange(tab.value)}
                              activeOpacity={0.8}
                              className={`flex-row items-center px-4 py-2 rounded-full border ${
                                isSelected
                                  ? 'bg-primary border-primary'
                                  : 'bg-muted/40 border-border'
                              }`}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isSelected }}
                            >
                              <TabIcon
                                size={14}
                                color={isSelected ? '#ffffff' : '#737373'}
                                className="me-1.5"
                              />
                              <Text
                                className={`text-xs font-bold ${
                                  isSelected ? 'text-primary-foreground font-extrabold' : 'text-foreground'
                                }`}
                              >
                                {tab.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  );
                }}
              />
            </View>

            {/* If Specific Resident chosen: dropdown to pick the resident */}
            {watchTargetType === 'SPECIFIC_RESIDENT' && (
              <View className="mt-1 bg-muted/20 border border-border/80 rounded-xl p-3 gap-2">
                <Text className="text-xs font-semibold text-foreground">
                  Select Resident / Community Member *
                </Text>
                <Controller
                  control={control}
                  name="selectedUserId"
                  render={({ field: { onChange, value } }) => {
                    const userOptions = availableUsers.map((u) => ({
                      label: `${u.name || u.username} (${u.role || 'Resident'}${u.phone ? ` • ${u.phone}` : ''})`,
                      value: u._id || u.id,
                    }));

                    return (
                      <DropdownSelect
                        options={userOptions}
                        value={value || null}
                        onValueChange={onChange}
                        placeholder="Choose a specific resident or staff member..."
                      />
                    );
                  }}
                />
              </View>
            )}

            {/* If Specific Role chosen: dropdown to pick from available community roles */}
            {watchTargetType === 'SPECIFIC_ROLE' && (
              <View className="mt-1 bg-muted/20 border border-border/80 rounded-xl p-3 gap-2">
                <Text className="text-xs font-semibold text-foreground">
                  Select Target Role *
                </Text>
                <Controller
                  control={control}
                  name="selectedRoleId"
                  render={({ field: { onChange, value } }) => {
                    const roleOptions = availableRoles.map((r) => ({
                      label: r.name,
                      value: r._id || r.id,
                    }));

                    return (
                      <DropdownSelect
                        options={roleOptions}
                        value={value || null}
                        onValueChange={onChange}
                        placeholder="Choose a community role..."
                      />
                    );
                  }}
                />
              </View>
            )}

            {/* Helpful description banner */}
            <View className="bg-primary/5 border border-primary/20 rounded-xl p-2.5">
              <Text className="text-xs text-primary/90 font-medium">
                {watchTargetType === 'ALL' && '📢 Broadcast to all community residents, owners, staff, and guards.'}
                {watchTargetType === 'STAFF_ONLY' && '🛡️ Only staff, technicians, and security guards will see this notice.'}
                {watchTargetType === 'OWNERS_ONLY' && '🏠 Only villa & property owners will see this notice.'}
                {watchTargetType === 'SPECIFIC_RESIDENT' && '👤 Confidential notice visible only to the selected member and admins.'}
                {watchTargetType === 'SPECIFIC_ROLE' && '🎯 Targeted notice visible only to members assigned to the chosen role.'}
              </Text>
            </View>
          </View>

          {/* Section 4: Publishing & Schedule (Status Pills & Date Controls) */}
          <View className="bg-card border border-border rounded-2xl p-4 gap-4 mb-4 shadow-2xs">
            <View className="flex-row items-center gap-2 border-b border-border/60 pb-3">
              <Calendar size={18} className="text-primary" />
              <View className="flex-1">
                <Text variant="large" className="font-bold text-foreground">
                  Publishing & Lifecycle
                </Text>
                <Text variant="muted" className="text-xs">
                  Notice status, scheduled broadcast and expiry dates
                </Text>
              </View>
            </View>

            {/* Status Selector (Horizontal Pill Buttons) */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">
                Publish Status *
              </Text>
              <Controller
                control={control}
                name="status"
                render={({ field: { onChange, value } }) => (
                  <View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                    >
                      {STATUS_OPTIONS.map((option) => {
                        const isSelected = value === option.value;
                        const statusStyle = getStatusTabStyle(option.value, isSelected);
                        return (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() => onChange(option.value)}
                            activeOpacity={0.8}
                            className={`flex-row items-center px-4 py-2 rounded-full border ${statusStyle.containerClass}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                          >
                            <Text className={`text-xs font-bold ${statusStyle.textClass}`}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    {errors.status?.message && (
                      <Text className="text-xs text-destructive mt-1">{errors.status?.message}</Text>
                    )}
                  </View>
                )}
              />
            </View>

            {/* Scheduled Start Date Picker */}
            {selectedStatus === 'Scheduled' && (
              <View>
                <Controller
                  control={control}
                  name="scheduleDate"
                  render={({ field: { onChange, value } }) => (
                    <DatePicker
                      label="Scheduled Publish Date & Time *"
                      value={value}
                      onChange={onChange}
                      error={errors.scheduleDate?.message}
                    />
                  )}
                />
              </View>
            )}

            {/* Expiry Date Picker */}
            <View>
              <Controller
                control={control}
                name="expiryDate"
                render={({ field: { onChange, value } }) => (
                  <DatePicker
                    label="Announcement Expiry *"
                    value={value}
                    onChange={onChange}
                    error={errors.expiryDate?.message}
                  />
                )}
              />
            </View>
          </View>

          {/* Section 4: Security & Compliance */}
          <View className="bg-card border border-border rounded-2xl p-4 gap-4 mb-4 shadow-2xs">
            <View className="flex-row items-center gap-2 border-b border-border/60 pb-3">
              <ShieldAlert size={18} className="text-primary" />
              <View className="flex-1">
                <Text variant="large" className="font-bold text-foreground">
                  Security & Interaction
                </Text>
                <Text variant="muted" className="text-xs">
                  Pin to top and interaction permissions
                </Text>
              </View>
            </View>

            {/* Pinned Switch */}
            <Controller
              control={control}
              name="isPinned"
              render={({ field: { onChange, value } }) => (
                <ToggleSwitch
                  label="Pin Notice to Top"
                  description="Keep this announcement pinned at the top of the community board."
                  value={value}
                  onValueChange={onChange}
                  className="bg-muted/20 border border-border px-4 py-2.5 rounded-xl"
                />
              )}
            />

            {/* Allow Resident Comments Switch */}
            <Controller
              control={control}
              name="allowComments"
              render={({ field: { onChange, value } }) => (
                <ToggleSwitch
                  label="Allow Comments"
                  description="Permit residents, staff, and owners to post questions and discussions."
                  value={value}
                  onValueChange={onChange}
                  className="bg-muted/20 border border-border px-4 py-2.5 rounded-xl"
                />
              )}
            />

            {/* Allow Likes & Reactions Switch */}
            <Controller
              control={control}
              name="allowReactions"
              render={({ field: { onChange, value } }) => (
                <ToggleSwitch
                  label="Allow Likes & Reactions"
                  description="Permit community members to like and react to this announcement."
                  value={value}
                  onValueChange={onChange}
                  className="bg-muted/20 border border-border px-4 py-2.5 rounded-xl"
                />
              )}
            />
          </View>

          {/* Section 5: Media Attachments */}
          <View className="bg-card border border-border rounded-2xl p-4 gap-4 mb-4 shadow-2xs">
            <View className="flex-row items-center gap-2 border-b border-border/60 pb-3">
              <Paperclip size={18} className="text-primary" />
              <View className="flex-1">
                <Text variant="large" className="font-bold text-foreground">
                  Media Attachments
                </Text>
                <Text variant="muted" className="text-xs">
                  Upload photos, notices or memos (Max 5 images)
                </Text>
              </View>
            </View>

            <AttachmentPicker
              attachments={images}
              onAdd={handleAddAttachments}
              onRemove={handleRemoveAttachment}
              maxFiles={5}
              accept="images"
            />
          </View>

          {/* Action Row */}
          <View className="flex-row gap-3 pt-2 pb-6">
            <View className="flex-1">
              <Button variant="outline" onPress={() => router.back()}>
                Cancel
              </Button>
            </View>
            <View className="flex-1">
              <Button onPress={handleSubmit(onSubmit)} loading={loading}>
                {isEditMode
                  ? 'Update Notice'
                  : selectedStatus === 'Draft'
                  ? 'Save as Draft'
                  : selectedStatus === 'Scheduled'
                  ? 'Schedule Notice'
                  : 'Publish Notice'}
              </Button>
            </View>
          </View>
        </ScrollContainer>
      </ScreenShell>
    </ErrorBoundary>
  );
}
