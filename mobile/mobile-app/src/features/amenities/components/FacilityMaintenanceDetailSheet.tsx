import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Amenity, MaintenanceTask } from '../store/amenitySlice';
import { getArchetypeMeta } from '../utils/amenityPresentation';
import {
  Calendar,
  Clock,
  Edit2,
  MapPin,
  Plus,
  Repeat,
  Trash2,
  Users,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Timer,
  Sparkles,
  DoorOpen,
} from 'lucide-react-native';
import { AppLoader } from '@/components/ui/AppLoader';

export interface FacilityMaintenanceDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  amenity: Amenity | any | null;
  activeTasks: MaintenanceTask[];
  onAddWindow: (amenityId: string) => void;
  onEditTask: (task: MaintenanceTask) => void;
  onCancelTask: (task: MaintenanceTask) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const FacilityMaintenanceDetailSheet: React.FC<FacilityMaintenanceDetailSheetProps> = ({
  visible,
  onClose,
  amenity,
  activeTasks,
  onAddWindow,
  onEditTask,
  onCancelTask,
  loading = false,
  error = null,
  onRetry,
}) => {
  if (!amenity) return null;

  const archetypeMeta = getArchetypeMeta(amenity.category || amenity.type);

  // In-sheet confirmation state for cancelling a maintenance window
  const [taskToCancel, setTaskToCancel] = React.useState<MaintenanceTask | null>(null);

  // Filter out any cancelled or completed tasks just in case
  const taskList = React.useMemo(() => {
    if (!Array.isArray(activeTasks)) return [];
    return activeTasks.filter((t) => {
      const s = String(t.status || '').toUpperCase();
      return s !== 'CANCELLED' && s !== 'COMPLETED';
    });
  }, [activeTasks]);

  const hasMaintenance = taskList.length > 0;
  const isProgress = taskList.some(
    (t) => String(t.status || '').toUpperCase() === 'IN_PROGRESS'
  );

  const renderArchetypeIcon = () => {
    switch (archetypeMeta.archetype) {
      case 'EXCLUSIVE_HOURLY':
        return <Timer size={12} color="#818cf8" />;
      case 'EVENT_SPACE':
        return <Sparkles size={12} color="#fbbf24" />;
      case 'ROOM_RESOURCE':
        return <DoorOpen size={12} color="#c084fc" />;
      case 'INVENTORY_TOOLS':
        return <Wrench size={12} color="#34d399" />;
      default:
        return <Users size={12} color="#60a5fa" />;
    }
  };

  const formatDateDisplay = (startDate?: string, endDate?: string) => {
    if (!startDate) return 'Scheduled Date';
    if (!endDate || endDate === startDate) return startDate;
    return `${startDate} – ${endDate}`;
  };

  const formatTimeDisplay = (startTime?: string, endTime?: string) => {
    return `${startTime || '00:00'} – ${endTime || '23:59'}`;
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Facility Maintenance"
    >
      <View className="gap-5">
        {/* ── 1. Facility Header Summary ─────────────────────────────── */}
        <View className="p-4 rounded-2xl bg-muted/40 border border-border/80 gap-2.5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 me-2">
              <Text className="text-lg font-extrabold text-foreground tracking-tight">
                {amenity.name}
              </Text>
              <View className="flex-row items-center gap-1 mt-1">
                <MapPin size={13} className="text-muted-foreground shrink-0" />
                <Text className="text-xs font-medium text-muted-foreground flex-1">
                  {amenity.location || 'Community Facilities'}
                </Text>
              </View>
            </View>

            {/* Status Badge */}
            {hasMaintenance ? (
              <StatusBadge
                label={isProgress ? 'IN PROGRESS' : 'MAINTENANCE'}
                variant={isProgress ? 'danger' : 'warning'}
                dot
              />
            ) : (
              <StatusBadge label="OPERATIONAL" variant="success" dot />
            )}
          </View>

          {/* Archetype & Code Info Row */}
          <View className="flex-row items-center gap-2 pt-2 border-t border-border/40">
            <View className="bg-card px-2.5 py-1 rounded-lg flex-row items-center gap-1.5 border border-border/80">
              {renderArchetypeIcon()}
              <Text className="text-[11px] font-bold text-foreground">
                {archetypeMeta.label || amenity.category || amenity.type || 'Facility'}
              </Text>
            </View>
            {amenity.code ? (
              <View className="bg-card px-2.5 py-1 rounded-lg border border-border/80">
                <Text className="text-[11px] font-semibold text-muted-foreground">
                  Code: {amenity.code}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── 2. Scheduled Maintenance Section ──────────────────────── */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-bold text-foreground">
                Scheduled Maintenance
              </Text>
              <View className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                <Text className="text-[11px] font-extrabold text-primary">
                  {taskList.length}
                </Text>
              </View>
            </View>

            {/* Quick Add Window Trigger in Header */}
            <TouchableOpacity
              onPress={() => onAddWindow(amenity._id)}
              activeOpacity={0.7}
              className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20"
              accessibilityLabel="Add maintenance window"
            >
              <Plus size={13} className="text-primary" />
              <Text className="text-xs font-bold text-primary">Add Window</Text>
            </TouchableOpacity>
          </View>

          {/* Loading State */}
          {loading && (
            <View className="p-6 rounded-2xl bg-card border border-border/60 items-center justify-center gap-2">
              <AppLoader variant="inline" />
              <Text className="text-xs font-medium text-muted-foreground">
                Loading maintenance...
              </Text>
            </View>
          )}

          {/* Error State */}
          {!loading && error && (
            <View className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 gap-2 items-center text-center">
              <AlertTriangle size={20} className="text-destructive" />
              <Text className="text-xs font-semibold text-destructive text-center">
                {error || 'Unable to load maintenance windows.'}
              </Text>
              {onRetry && (
                <Button variant="outline" size="sm" onPress={onRetry} className="mt-1">
                  <Text className="text-xs">Retry</Text>
                </Button>
              )}
            </View>
          )}

          {/* Empty State */}
          {!loading && !error && taskList.length === 0 && (
            <View className="p-6 rounded-2xl bg-card border border-border/60 items-center justify-center gap-2">
              <CheckCircle2 size={32} className="text-emerald-500" />
              <Text className="text-sm font-bold text-foreground text-center">
                No scheduled maintenance windows.
              </Text>
              <Text className="text-xs text-muted-foreground text-center">
                Facility is operational and open for resident bookings.
              </Text>
            </View>
          )}

          {/* Active Maintenance Windows List */}
          {!loading && !error && taskList.length > 0 && (
            <View className="gap-3">
              {taskList.map((task, idx) => {
                const taskTitle = task.title || task.reason || 'Routine Maintenance';
                const isTaskRecurring = Boolean(task.isRecurring || task.recurringSeriesId);
                const isTaskProgress = String(task.status || '').toUpperCase() === 'IN_PROGRESS';

                return (
                  <View
                    key={String(task._id || idx)}
                    className="p-3.5 rounded-2xl bg-card border border-border/80 gap-3 shadow-xs"
                  >
                    {/* Window Header: Title & Badges */}
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-row items-center gap-2 flex-1">
                        <View className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                          <Wrench size={14} className="text-primary" />
                        </View>
                        <View className="flex-1">
                          <Text
                            numberOfLines={1}
                            className="text-sm font-bold text-foreground"
                          >
                            {taskTitle}
                          </Text>
                          <Text className="text-[11px] font-semibold text-muted-foreground capitalize">
                            Type: {task.maintenanceType?.toLowerCase() || 'general'}
                          </Text>
                        </View>
                      </View>

                      {/* Status / Recurring Badge */}
                      <View className="flex-row items-center gap-1">
                        {isTaskRecurring && (
                          <View className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 flex-row items-center gap-1">
                            <Repeat size={10} className="text-purple-600 dark:text-purple-400" />
                            <Text className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                              Series
                            </Text>
                          </View>
                        )}
                        {isTaskProgress && (
                          <View className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20">
                            <Text className="text-[10px] font-bold text-red-600 dark:text-red-400">
                              IN PROGRESS
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Window Schedule Details: Date & Time */}
                    <View className="p-2.5 rounded-xl bg-muted/40 border border-border/40 gap-1.5">
                      <View className="flex-row items-center gap-1.5">
                        <Calendar size={12} className="text-muted-foreground shrink-0" />
                        <Text className="text-xs font-semibold text-foreground">
                          {formatDateDisplay(task.startDate, task.endDate)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Clock size={12} className="text-muted-foreground shrink-0" />
                        <Text className="text-xs font-semibold text-muted-foreground">
                          {formatTimeDisplay(task.startTime, task.endTime)}
                        </Text>
                      </View>
                      {task.assignedStaff ? (
                        <View className="flex-row items-center gap-1.5 pt-1 border-t border-border/30">
                          <Users size={12} className="text-muted-foreground shrink-0" />
                          <Text className="text-xs text-muted-foreground">
                            Assigned Staff: <Text className="font-semibold text-foreground">{task.assignedStaff}</Text>
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Description if present */}
                    {task.description && task.description !== taskTitle ? (
                      <Text
                        numberOfLines={3}
                        className="text-xs text-muted-foreground italic px-1"
                      >
                        "{task.description}"
                      </Text>
                    ) : null}

                    {/* Window Action Buttons Row */}
                    <View className="flex-row items-center gap-2 pt-1 border-t border-border/40">
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => onEditTask(task)}
                        className="flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl border-border active:bg-secondary/60"
                        accessibilityLabel={`Edit window ${taskTitle}`}
                      >
                        <Edit2 size={12} className="text-foreground" />
                        <Text className="text-xs font-bold text-foreground">Edit</Text>
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        onPress={() => setTaskToCancel(task)}
                        className="flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl bg-red-600 active:bg-red-700"
                        accessibilityLabel={`Cancel window ${taskTitle}`}
                      >
                        <Trash2 size={12} color="#FFFFFF" />
                        <Text className="text-xs font-bold text-white">Cancel</Text>
                      </Button>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* In-Sheet Confirmation for Cancelling a Maintenance Window */}
          {taskToCancel && (
            <View className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 gap-3 mt-1">
              <View className="flex-row items-center gap-2">
                <Trash2 size={16} className="text-destructive" />
                <Text className="text-sm font-bold text-destructive">
                  Cancel Maintenance Window?
                </Text>
              </View>
              <View className="bg-card/90 p-3 rounded-xl border border-border/60 gap-1">
                <Text className="text-xs text-muted-foreground">
                  Task: <Text className="font-bold text-foreground">{taskToCancel.title || taskToCancel.reason || 'Maintenance'}</Text>
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Date: <Text className="font-bold text-foreground">{formatDateDisplay(taskToCancel.startDate, taskToCancel.endDate)}</Text>
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Time: <Text className="font-bold text-foreground">{formatTimeDisplay(taskToCancel.startTime, taskToCancel.endTime)}</Text>
                </Text>
              </View>
              <Text className="text-[11px] text-muted-foreground">
                Cancelling this window will unblock conflicting resident reservation slots.
              </Text>
              <View className="flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setTaskToCancel(null)}
                  className="flex-1 h-9 rounded-xl border-border bg-card"
                >
                  <Text className="text-xs font-semibold text-foreground">Keep Window</Text>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onPress={() => {
                    const target = taskToCancel;
                    setTaskToCancel(null);
                    onCancelTask(target);
                  }}
                  className="flex-1 h-9 rounded-xl bg-red-600 active:bg-red-700"
                >
                  <Text className="text-xs font-bold text-white">Confirm Cancel</Text>
                </Button>
              </View>
            </View>
          )}
        </View>

        {/* ── 3. Bottom Actions Row ─────────────────────────────────── */}
        <View className="pt-3 border-t border-border/80 gap-2.5">
          <Button
            variant="default"
            size="default"
            onPress={() => onAddWindow(amenity._id)}
            className="w-full flex-row items-center justify-center gap-2 h-11 rounded-xl bg-primary"
            accessibilityLabel="Add Maintenance Window"
          >
            <Plus size={16} color="#FFFFFF" />
            <Text className="font-bold text-white text-sm">Add Maintenance Window</Text>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onPress={onClose}
            className="w-full h-9 rounded-xl"
            accessibilityLabel="Close Facility Details"
          >
            <Text className="font-semibold text-muted-foreground text-xs">Close</Text>
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
};

export default FacilityMaintenanceDetailSheet;
