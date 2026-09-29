import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DatePicker } from '@/components/common/DatePicker';
import { UserCheck, Users, ShieldAlert, Check, Phone, Wrench, Building2, Clock, Send, Star } from 'lucide-react-native';
import apiClient from '../../../services/apiClient';
import { Complaint, AssignTechnicianPayload } from '../types';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { ContactPickerButton } from '@/components/forms/ContactPickerButton';
import { validatePhone } from '@/src/utils/validation';

interface StaffMember {
  _id: string;
  name: string;
  phone?: string;
  department?: string;
  specialization?: string;
  specialty?: string;
  type?: string;
  rating?: number | string;
  status?: string;
  activeJobsCount?: number;
}

export interface AssignTechnicianSheetProps {
  visible: boolean;
  complaint?: Complaint | null;
  ticket?: any;
  technicians?: StaffMember[];
  loading?: boolean;
  onClose: () => void;
  onAssign: (id: string, payload: any, techName?: string, notes?: string) => Promise<any>;
}

const DEFAULT_STAFF_LIST: StaffMember[] = [];

export const AssignTechnicianSheet: React.FC<AssignTechnicianSheetProps> = ({
  visible,
  complaint,
  ticket,
  technicians: initialTechnicians,
  loading = false,
  onClose,
  onAssign,
}) => {
  const targetItem = complaint || ticket;
  const [assignmentType, setAssignmentType] = useState<'direct' | 'broadcast' | 'vendor'>('direct');
  
  // Staff Selection State
  const [staffList, setStaffList] = useState<StaffMember[]>(initialTechnicians || DEFAULT_STAFF_LIST);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [broadcastStaffIds, setBroadcastStaffIds] = useState<string[]>([]);

  // External Vendor Pass State
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorCompany, setVendorCompany] = useState('');
  const [vendorSpecialization, setVendorSpecialization] = useState('');
  const [visitTiming, setVisitTiming] = useState('Immediately');
  const [customVisitDate, setCustomVisitDate] = useState<Date | null>(null);

  // Common Fields
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialTechnicians && initialTechnicians.length > 0) {
        setStaffList(initialTechnicians);
        return;
      }
      setIsLoadingStaff(true);
      apiClient
        .get('/technicians')
        .then((res: any) => {
          const list = res?.data || res || [];
          if (Array.isArray(list)) {
            setStaffList(list);
          }
        })
        .catch((err) => {
          console.log('[AssignSheet] Technician fetch failed:', err);
          setStaffList([]);
        })
        .finally(() => {
          setIsLoadingStaff(false);
        });
    }
  }, [visible, initialTechnicians]);

  if (!targetItem) return null;

  const toggleBroadcastStaff = (id: string) => {
    setBroadcastStaffIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleAssignSubmit = async () => {
    try {
      setError(null);
      setIsSubmitting(true);
      let payload: AssignTechnicianPayload = {
        assignmentType,
        instructions: instructions.trim() || undefined,
      };
      let techName = '';

      if (assignmentType === 'direct') {
        if (!selectedStaffId) {
          setError('Please select a staff member to assign.');
          return;
        }
        const selected = staffList.find((s) => s._id === selectedStaffId);
        techName = selected ? selected.name : '';
        payload.technicianId = selectedStaffId;
        payload.assignedTechnicianId = selectedStaffId;
        payload.technicianName = techName;
        payload.vendor = 'In-House';
      } else if (assignmentType === 'broadcast') {
        if (broadcastStaffIds.length === 0) {
          setError('Please select at least one staff member for broadcast dispatch.');
          return;
        }
        payload.technicianIds = broadcastStaffIds;
        payload.vendor = 'In-House';
      } else if (assignmentType === 'vendor') {
        if (!vendorName.trim()) {
          setError('Please enter the External Vendor Name.');
          return;
        }
        if (!vendorPhone.trim() || !validatePhone(vendorPhone).isValid) {
          setError('Please enter a valid Vendor Phone Number.');
          return;
        }
        techName = vendorName.trim();
        payload.technicianName = techName;
        payload.vendor = vendorCompany.trim() || 'External Vendor';
        
        const extraVendorNotes = `\n[External Vendor Pass Details]\nPhone: ${vendorPhone}\nCompany: ${vendorCompany || 'N/A'}\nSpecialization: ${vendorSpecialization || 'N/A'}\nVisit Schedule: ${visitTiming}${customVisitDate ? ` (${customVisitDate.toLocaleDateString()})` : ''}`;
        payload.instructions = (instructions || '') + extraVendorNotes;
        payload.preferredVisitDate = customVisitDate ? customVisitDate.toISOString() : undefined;
        payload.preferredVisitTime = visitTiming;
      }

      await onAssign(targetItem._id, payload, techName, instructions.trim());
      setSelectedStaffId('');
      setBroadcastStaffIds([]);
      setInstructions('');
      onClose();
    } catch (err: any) {
      console.error('Failed to assign technician:', err);
      setError(err?.message || 'Failed to dispatch technician');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ticketNumber = targetItem.complaintNumber || targetItem.ticketNumber || '';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Assign Ticket ${ticketNumber ? `#${ticketNumber}` : ''}`}
    >
      <View className="px-1 py-1 pb-2">
        {error && (
          <View className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex-row items-center gap-2">
            <Icon as={ShieldAlert} size={16} className="text-destructive shrink-0" />
            <Text className="text-xs font-semibold text-destructive flex-1">{error}</Text>
          </View>
        )}

        {/* TICKET SUMMARY BANNER */}
        <View className="bg-card border border-border rounded-xl p-3 mb-3 flex-row items-center justify-between">
          <View className="flex-1 me-2">
            <Text className="text-[10px] font-bold text-muted-foreground uppercase">Target Issue</Text>
            <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
              {targetItem.title || 'Maintenance Request'}
            </Text>
          </View>
          <StatusBadge label={targetItem.category || 'General'} variant="info" />
        </View>

        {/* 1-TAP SEGMENTED STRATEGY CHIPS */}
        <View className="mb-3 gap-1">
          <Text className="text-xs font-bold text-muted-foreground uppercase">Assignment Strategy</Text>
          <View className="flex-row gap-2 py-1">
            {[
              { id: 'direct', label: 'Direct Staff' },
              { id: 'broadcast', label: 'Broadcast Pool' },
              { id: 'vendor', label: 'External Vendor' },
            ].map((strat) => {
              const isCurrent = assignmentType === strat.id;
              return (
                <TouchableOpacity
                  key={strat.id}
                  activeOpacity={0.8}
                  onPress={() => setAssignmentType(strat.id as any)}
                  className={`flex-1 py-2 px-3 rounded-xl items-center justify-center border ${
                    isCurrent
                      ? 'bg-primary border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  <Text className={`font-bold text-xs ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {strat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 1. DIRECT INTERNAL STAFF SELECTION LIST */}
        {assignmentType === 'direct' && (
          <View className="my-2 gap-2">
            <Text className="text-xs font-bold text-muted-foreground uppercase">
              Select Staff Member ({targetItem.category || 'Maintenance'})
            </Text>
            {staffList.length === 0 ? (
              <View className="bg-orange-50 border border-orange-200 p-4 rounded-xl items-center my-2">
                <Icon as={ShieldAlert} size={24} color="#f97316" className="mb-2" />
                <Text className="text-sm font-bold text-orange-700 text-center">No In-House Staff Found</Text>
                <Text className="text-xs text-orange-600 text-center mt-1">
                  You don't have any registered technicians. Please use the "External Vendor" tab or add staff first.
                </Text>
              </View>
            ) : (
              staffList.map((staff) => {
                const isSelected = selectedStaffId === staff._id;
                const isBusy = (staff.activeJobsCount || 0) > 0;

                return (
                  <TouchableOpacity
                    key={staff._id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedStaffId(staff._id)}
                    className={`p-3 rounded-xl border flex-row items-center justify-between ${
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-card border-border'
                    }`}
                  >
                    <View className="flex-row items-center flex-1 me-2">
                      <View className={`w-9 h-9 rounded-full items-center justify-center me-2.5 ${
                        isSelected ? 'bg-primary' : 'bg-muted'
                      }`}>
                        <Icon as={UserCheck} size={18} className={isSelected ? 'text-primary-foreground' : 'text-muted-foreground'} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-foreground">{staff.name}</Text>
                        <Text className="text-[11px] text-muted-foreground">
                          {staff.specialization || staff.specialty || staff.department || 'Maintenance Staff'} • {staff.phone || 'No phone'}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <StatusBadge
                        label={isBusy ? `Busy (${staff.activeJobsCount})` : 'Available'}
                        variant={isBusy ? 'warning' : 'success'}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* 2. BROADCAST MULTI-STAFF SELECTION LIST */}
        {assignmentType === 'broadcast' && (
          <View className="my-2 gap-2">
            <Text className="text-xs font-bold text-muted-foreground uppercase">
              Select Staff Pool to Broadcast
            </Text>
            {staffList.map((staff) => {
              const isChecked = broadcastStaffIds.includes(staff._id);

              return (
                <TouchableOpacity
                  key={staff._id}
                  activeOpacity={0.8}
                  onPress={() => toggleBroadcastStaff(staff._id)}
                  className={`p-3 rounded-xl border flex-row items-center justify-between ${
                    isChecked
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  <View className="flex-row items-center flex-1 me-2">
                    <View className={`w-5 h-5 rounded-md items-center justify-center me-2.5 border ${
                      isChecked ? 'bg-primary border-primary' : 'bg-card border-border'
                    }`}>
                      {isChecked && <Icon as={Check} size={12} className="text-primary-foreground" />}
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-foreground">{staff.name}</Text>
                      <Text className="text-[11px] text-muted-foreground">{staff.department || 'Staff Pool'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 3. EXTERNAL VENDOR PASS DETAILS */}
        {assignmentType === 'vendor' && (
          <View className="my-2 gap-3 bg-muted/20 border border-border rounded-2xl p-3.5">
            <Text className="text-xs font-bold text-muted-foreground uppercase">
              External Vendor Gate Pass Details
            </Text>

            <TextInput
              label="Vendor Technician Name *"
              placeholder="e.g. Ramesh Kumar (QuickFix Co.)"
              value={vendorName}
              onChangeText={setVendorName}
            />

            <PhoneInput
              label="Vendor Contact Phone *"
              value={vendorPhone}
              onChangeText={setVendorPhone}
              testID="vendor-phone"
              rightElement={
                <ContactPickerButton
                  onPick={(c) => {
                    if (c.name) setVendorName(c.name);
                    if (c.phone) setVendorPhone(c.phone);
                  }}
                />
              }
            />

            <TextInput
              label="Agency / Company Name"
              placeholder="e.g. QuickFix Plumbing & Sanitation Ltd"
              value={vendorCompany}
              onChangeText={setVendorCompany}
            />

            <DropdownSelect
              label="Expected Visit Timing"
              value={visitTiming}
              options={[
                { label: 'Immediately (Urgent Dispatch)', value: 'Immediately' },
                { label: 'Today (Standard Shift)', value: 'Today' },
                { label: 'Tomorrow', value: 'Tomorrow' },
                { label: 'Custom Schedule', value: 'Custom Schedule' },
              ]}
              onValueChange={(val) => setVisitTiming(val)}
            />

            {visitTiming === 'Custom Schedule' && (
              <DatePicker
                label="Custom Visit Date"
                value={customVisitDate}
                onChange={(d) => setCustomVisitDate(d)}
              />
            )}
          </View>
        )}

        {/* OPTIONAL SCOPE INSTRUCTIONS */}
        <TextInput
          label="Special Instructions / Scope of Work"
          placeholder="Enter instructions for the assigned technician..."
          value={instructions}
          onChangeText={setInstructions}
          containerClassName="mt-2"
        />

        {/* Action Buttons */}
        <View className="flex-row gap-2 pt-4 pb-2 border-t border-border mt-3">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onPress={onClose}
            disabled={isSubmitting || loading}
          >
            <Text className="text-xs font-semibold text-foreground">Cancel</Text>
          </Button>
          <Button
            variant="default"
            className="flex-1 h-12 rounded-xl flex-row items-center justify-center gap-1.5"
            onPress={handleAssignSubmit}
            disabled={isSubmitting || loading}
            loading={isSubmitting}
            accessibilityLabel="Confirm and Dispatch Technician"
          >
            <Icon as={Send} size={14} className="text-primary-foreground" />
            <Text className="text-xs font-bold text-primary-foreground">
              {isSubmitting ? 'Dispatching...' : 'Dispatch'}
            </Text>
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
};

export default AssignTechnicianSheet;
