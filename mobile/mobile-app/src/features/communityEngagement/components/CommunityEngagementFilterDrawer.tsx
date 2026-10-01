import React, { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Chip } from '@/components/common/Chip';
import { GlobalFilterPanel, FilterCategoryConfig } from '@/components/ui/GlobalFilterPanel';
import { DatePicker } from '@/components/common/DatePicker';
import { formatDateString } from '@/components/common/DatePickerModal';
import {
  Calendar,
  AlertCircle,
  Tag,
  Users,
  CheckSquare,
  BarChart3,
  Search,
  Shield,
  KeyRound,
  Building2,
} from 'lucide-react-native';
import {
  CommunityEngagementFilterValues,
  NoticePriority,
  NoticeCategory,
  LedgerDatePreset,
} from '../types/communityEngagement.types';
import { fetchRoles } from '@/src/features/roleBuilder/services/roleService';
import { useTranslation } from '@/src/utils/i18n';

export interface CommunityEngagementFilterDrawerProps {
  visible: boolean;
  onClose: () => void;
  filters: CommunityEngagementFilterValues;
  onApply: (newFilters: CommunityEngagementFilterValues) => void;
  onReset: () => void;
  activeTypeFilter?: 'ALL' | 'NOTICES' | 'POLLS';
}

export const CommunityEngagementFilterDrawer: React.FC<CommunityEngagementFilterDrawerProps> = ({
  visible,
  onClose,
  filters,
  onApply,
  onReset,
  activeTypeFilter = 'ALL',
}) => {
  const { t } = useTranslation();

  const [datePreset, setDatePreset] = useState<LedgerDatePreset>(filters.datePreset);
  const [startDate, setStartDate] = useState<string>(filters.startDate || '');
  const [endDate, setEndDate] = useState<string>(filters.endDate || '');
  const [priorities, setPriorities] = useState<NoticePriority[]>(filters.priorities || []);
  const [categories, setCategories] = useState<NoticeCategory[]>(filters.categories || []);
  const [audienceScope, setAudienceScope] = useState<any>(filters.audienceScope || 'ALL');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(filters.selectedRoleIds || []);
  const [pollVotingModes, setPollVotingModes] = useState<('PUBLIC' | 'ANONYMOUS')[]>(
    filters.pollVotingModes || []
  );
  const [pollChoiceTypes, setPollChoiceTypes] = useState<('SINGLE_CHOICE' | 'MULTIPLE_CHOICE')[]>(
    filters.pollChoiceTypes || []
  );
  const [isPinnedOnly, setIsPinnedOnly] = useState<boolean>(filters.isPinnedOnly || false);
  const [requiresAcknowledgementOnly, setRequiresAcknowledgementOnly] = useState<boolean>(
    filters.requiresAcknowledgementOnly || false
  );

  const [roleSearch, setRoleSearch] = useState<string>('');
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);

  const datePresets = useMemo<{ id: LedgerDatePreset; label: string }[]>(
    () => [
      { id: 'ALL_TIME', label: t('all_time') },
      { id: 'THIS_WEEK', label: t('this_week') },
      { id: 'THIS_MONTH', label: t('this_month') },
      { id: 'PAST_30_DAYS', label: t('past_30_days') },
      { id: 'CUSTOM', label: t('custom_range') },
    ],
    [t]
  );

  const prioritiesOptions = useMemo<{ id: NoticePriority; label: string }[]>(
    () => [
      { id: 'Critical', label: t('priority_critical', 'Critical') },
      { id: 'High', label: t('priority_high', 'High Priority') },
      { id: 'Medium', label: t('priority_medium', 'Medium') },
      { id: 'Low', label: t('priority_low', 'Low') },
    ],
    [t]
  );

  const categoriesOptions = useMemo<{ id: NoticeCategory; label: string }[]>(
    () => [
      { id: 'General', label: t('cat_general', 'General') },
      { id: 'Maintenance', label: t('cat_maintenance', 'Maintenance') },
      { id: 'Events', label: t('cat_events', 'Events') },
      { id: 'Emergency', label: t('cat_emergency', 'Emergency') },
      { id: 'Meetings', label: t('cat_meetings', 'Meetings') },
      { id: 'Rules', label: t('cat_rules', 'Rules') },
    ],
    [t]
  );

  const audienceScopes = useMemo(
    () => [
      { id: 'ALL', label: t('all_community'), icon: Users },
      { id: 'OWNERS_ONLY', label: t('owners_only'), icon: KeyRound },
      { id: 'STAFF_ONLY', label: t('staff_security'), icon: Shield },
      { id: 'SPECIFIC_ROLE', label: t('by_specific_role'), icon: Building2 },
    ],
    [t]
  );

  useEffect(() => {
    if (visible) {
      setDatePreset(filters.datePreset || 'ALL_TIME');
      setStartDate(filters.startDate || '');
      setEndDate(filters.endDate || '');
      setPriorities(filters.priorities || []);
      setCategories(filters.categories || []);
      setAudienceScope(filters.audienceScope || 'ALL');
      setSelectedRoleIds(filters.selectedRoleIds || []);
      setPollVotingModes(filters.pollVotingModes || []);
      setPollChoiceTypes(filters.pollChoiceTypes || []);
      setIsPinnedOnly(filters.isPinnedOnly || false);
      setRequiresAcknowledgementOnly(filters.requiresAcknowledgementOnly || false);

      fetchRoles()
        .then((res: any) => {
          const list = res?.data?.data || res?.data || res || [];
          setAvailableRoles(
            list
              .map((r: any) => ({
                id: r._id || r.id,
                name: r.name || r.roleName || 'Unnamed Role',
              }))
              .filter((r: any) => Boolean(r.id) && Boolean(r.name))
          );
        })
        .catch(() => {});
    }
  }, [visible, filters]);

  const handleSelectDatePreset = (presetId: LedgerDatePreset) => {
    setDatePreset(presetId);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (presetId === 'ALL_TIME') {
      setStartDate('');
      setEndDate('');
    } else if (presetId === 'THIS_WEEK') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diff));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setStartDate(formatDateString(mon));
      setEndDate(formatDateString(sun));
    } else if (presetId === 'THIS_MONTH') {
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);
      setStartDate(formatDateString(firstDay));
      setEndDate(formatDateString(lastDay));
    } else if (presetId === 'PAST_30_DAYS') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setStartDate(formatDateString(thirtyDaysAgo));
      setEndDate(formatDateString(new Date()));
    }
  };

  const toggleCategory = (catId: string) => {
    const cat = catId as NoticeCategory;
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const togglePriority = (prioId: string) => {
    const prio = prioId as NoticePriority;
    setPriorities((prev) =>
      prev.includes(prio) ? prev.filter((p) => p !== prio) : [...prev, prio]
    );
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleApply = () => {
    onApply({
      datePreset,
      startDate,
      endDate,
      priorities,
      categories,
      audienceScope,
      selectedRoleIds: audienceScope === 'SPECIFIC_ROLE' ? selectedRoleIds : [],
      pollVotingModes,
      pollChoiceTypes,
      isPinnedOnly,
      requiresAcknowledgementOnly,
    });
    onClose();
  };

  const handleReset = () => {
    setDatePreset('ALL_TIME');
    setStartDate('');
    setEndDate('');
    setPriorities([]);
    setCategories([]);
    setAudienceScope('ALL');
    setSelectedRoleIds([]);
    setPollVotingModes([]);
    setPollChoiceTypes([]);
    setIsPinnedOnly(false);
    setRequiresAcknowledgementOnly(false);
    onReset();
    onClose();
  };

  const totalActiveCount =
    categories.length +
    priorities.length +
    (audienceScope !== 'ALL' ? (audienceScope === 'SPECIFIC_ROLE' ? selectedRoleIds.length || 1 : 1) : 0) +
    (isPinnedOnly ? 1 : 0) +
    (requiresAcknowledgementOnly ? 1 : 0) +
    pollVotingModes.length +
    pollChoiceTypes.length +
    (datePreset !== 'ALL_TIME' || startDate || endDate ? 1 : 0);

  const renderAudienceSection = () => (
    <View className="gap-3 pt-1">
      <View className="gap-2">
        {audienceScopes.map((scope) => {
          const isSelected = audienceScope === scope.id;
          const ScopeIcon = scope.icon;
          return (
            <TouchableOpacity
              key={scope.id}
              onPress={() => setAudienceScope(scope.id)}
              activeOpacity={0.7}
              className={`flex-row items-center justify-between p-3 rounded-xl border ${
                isSelected ? 'bg-primary/10 border-primary' : 'bg-card border-border/70'
              }`}
            >
              <View className="flex-row items-center gap-2.5">
                <View className="w-4 h-4 rounded-full border items-center justify-center">
                  {isSelected && <View className="w-2 h-2 rounded-full bg-primary" />}
                </View>
                <ScopeIcon size={14} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                <Text className={`text-xs font-sans ${isSelected ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                  {scope.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {audienceScope === 'SPECIFIC_ROLE' && (
        <View className="pt-2 border-t border-border/40 gap-2">
          <View className="rounded-2xl border border-border/40 bg-card p-2 shadow-sm">
            <View className="h-11 flex-row items-center rounded-xl border border-border/80 bg-background/70 px-3.5 shadow-2xs">
              <Icon as={Search} size={18} className="text-muted-foreground me-2.5 shrink-0" />
              <RNTextInput
                value={roleSearch}
                onChangeText={setRoleSearch}
                placeholder={t('search_roles')}
                placeholderTextColor="#9ca3af"
                className="h-full min-w-0 flex-1 p-0 font-sans text-[13px] font-medium text-foreground"
              />
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5 max-h-40">
            {availableRoles
              .filter((r) => !roleSearch || r.name.toLowerCase().includes(roleSearch.toLowerCase()))
              .map((r) => {
                const isSelected = selectedRoleIds.includes(r.id);
                return (
                  <Chip
                    key={r.id}
                    label={r.name}
                    selected={isSelected}
                    onPress={() => toggleRole(r.id)}
                    className="py-1 px-2.5"
                  />
                );
              })}
          </View>
        </View>
      )}
    </View>
  );

  const renderDateSection = () => (
    <View className="gap-3 pt-1">
      <View className="flex-row flex-wrap gap-2">
        {datePresets.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            selected={datePreset === p.id}
            onPress={() => handleSelectDatePreset(p.id)}
            className="py-1.5 px-3"
          />
        ))}
      </View>

      {datePreset === 'CUSTOM' || startDate || endDate ? (
        <View className="gap-3 pt-2 border-t border-border/40">
          <DatePicker
            label={t('start_date', 'Start Date')}
            value={startDate ? new Date(`${startDate}T00:00:00`) : null}
            onChange={(d) => {
              setStartDate(formatDateString(d));
              setDatePreset('CUSTOM');
            }}
            placeholder={t('start_date', 'Start Date')}
          />
          <DatePicker
            label={t('end_date', 'End Date')}
            value={endDate ? new Date(`${endDate}T00:00:00`) : null}
            onChange={(d) => {
              setEndDate(formatDateString(d));
              setDatePreset('CUSTOM');
            }}
            placeholder={t('end_date', 'End Date')}
          />
        </View>
      ) : null}
    </View>
  );

  const categoryConfigs: FilterCategoryConfig[] = useMemo(() => {
    const configs: FilterCategoryConfig[] = [
      {
        id: 'category',
        label: t('category', 'Category'),
        icon: Tag,
        type: 'checkbox',
        options: categoriesOptions,
        selectedValues: categories,
        selectedCount: categories.length,
        onOptionToggle: toggleCategory,
      },
      {
        id: 'priority',
        label: t('urgency_priority', 'Urgency & Priority'),
        icon: AlertCircle,
        type: 'checkbox',
        options: prioritiesOptions,
        selectedValues: priorities,
        selectedCount: priorities.length,
        onOptionToggle: togglePriority,
      },
      {
        id: 'audience',
        label: t('target_audience', 'Target Audience'),
        icon: Users,
        type: 'custom',
        selectedCount: audienceScope !== 'ALL' ? (audienceScope === 'SPECIFIC_ROLE' ? selectedRoleIds.length || 1 : 1) : 0,
        renderCustom: renderAudienceSection,
      },
      {
        id: 'governance',
        label: t('action_governance', 'Action & Governance'),
        icon: CheckSquare,
        type: 'toggle',
        options: [
          { id: 'pinned', label: t('pinned_announcements_only'), description: t('pinned_to_top') },
          { id: 'ack', label: t('needs_my_signoff'), description: t('mandatory_signoff') },
        ],
        selectedValues: [
          ...(isPinnedOnly ? ['pinned'] : []),
          ...(requiresAcknowledgementOnly ? ['ack'] : []),
        ],
        selectedCount: (isPinnedOnly ? 1 : 0) + (requiresAcknowledgementOnly ? 1 : 0),
        onOptionToggle: (id) => {
          if (id === 'pinned') setIsPinnedOnly((prev) => !prev);
          if (id === 'ack') setRequiresAcknowledgementOnly((prev) => !prev);
        },
      },
    ];

    if (activeTypeFilter === 'POLLS' || activeTypeFilter === 'ALL') {
      configs.push({
        id: 'polls',
        label: t('poll_options'),
        icon: BarChart3,
        type: 'checkbox',
        options: [
          { id: 'PUBLIC', label: t('public_voting') },
          { id: 'ANONYMOUS', label: t('anonymous_voting') },
          { id: 'SINGLE_CHOICE', label: t('single_choice_polls') },
          { id: 'MULTIPLE_CHOICE', label: t('multiple_choice_polls') },
        ],
        selectedValues: [...pollVotingModes, ...pollChoiceTypes],
        selectedCount: pollVotingModes.length + pollChoiceTypes.length,
        onOptionToggle: (id) => {
          if (id === 'PUBLIC' || id === 'ANONYMOUS') {
            const mode = id as 'PUBLIC' | 'ANONYMOUS';
            setPollVotingModes((prev) =>
              prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
            );
          } else if (id === 'SINGLE_CHOICE' || id === 'MULTIPLE_CHOICE') {
            const choice = id as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
            setPollChoiceTypes((prev) =>
              prev.includes(choice) ? prev.filter((c) => c !== choice) : [...prev, choice]
            );
          }
        },
      });
    }

    configs.push({
      id: 'date',
      label: t('date_range'),
      icon: Calendar,
      type: 'custom',
      selectedCount: datePreset !== 'ALL_TIME' || startDate || endDate ? 1 : 0,
      renderCustom: renderDateSection,
    });

    return configs;
  }, [
    categories,
    priorities,
    audienceScope,
    selectedRoleIds,
    availableRoles,
    roleSearch,
    isPinnedOnly,
    requiresAcknowledgementOnly,
    pollVotingModes,
    pollChoiceTypes,
    datePreset,
    startDate,
    endDate,
    activeTypeFilter,
    t,
    categoriesOptions,
    prioritiesOptions,
    datePresets,
  ]);

  return (
    <GlobalFilterPanel
      visible={visible}
      onClose={onClose}
      title={t('filter_engagement_feed')}
      categories={categoryConfigs}
      onApply={handleApply}
      onClearAll={handleReset}
      totalActiveCount={totalActiveCount}
    />
  );
};

export default CommunityEngagementFilterDrawer;
