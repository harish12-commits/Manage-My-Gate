import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, Platform, Alert, KeyboardAvoidingView, Pressable } from 'react-native';
import { X, Users, Upload, Plus, Trash2, CheckCircle2, AlertTriangle, FileSpreadsheet, Download, FileText } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

let LegacyFileSystem: any = null;
try {
  LegacyFileSystem = require('expo-file-system/legacy');
} catch (e) {
  try {
    LegacyFileSystem = require('expo-file-system');
  } catch (err) {
    LegacyFileSystem = null;
  }
}
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { downloadCSVFile } from '@/src/utils/downloadHelper';
import { validateEmail, parseBackendError } from '@/src/utils/validation';
import apiClient from '../../../services/apiClient';
import { InviteUserData } from '../services/userService';
import { AppLoader } from '@/components/ui/AppLoader';

interface BulkInviteModalProps {
  visible: boolean;
  onClose: () => void;
  onBulkInvite: (invitations: InviteUserData[]) => Promise<any>;
}

interface InviteRowItem {
  id: string;
  email: string;
  roleName: string;
  villaId: string;
  residentType: string;
  isValid: boolean;
  error?: string;
}

const SAMPLE_CSV_CONTENT = `Email,Role,Villa,ResidentType
resident.owner@example.com,Resident Owner,Villa 01,Owner
resident.tenant@example.com,Resident Tenant,Villa 02,Tenant
security.guard@example.com,Security Guard,,None`;

export const BulkInviteModal: React.FC<BulkInviteModalProps> = ({
  visible,
  onClose,
  onBulkInvite,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [rows, setRows] = useState<InviteRowItem[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [villas, setVillas] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResults, setSuccessResults] = useState<any | null>(null);

  // Fetch roles and villas when modal becomes visible
  useEffect(() => {
    if (visible) {
      setErrorMsg('');
      setSuccessResults(null);
      setSelectedFileName(null);
      setActiveTab('upload');

      setLoadingOptions(true);
      Promise.all([
        apiClient.get('/roles?limit=100').catch(() => ({ data: [] })),
        apiClient.get('/villas?limit=1000').catch(() => ({ data: [] })),
      ])
        .then(([rolesRes, villasRes]: any[]) => {
          const fetchedRoles = rolesRes.data?.data || rolesRes.data || [];
          const fetchedVillas = villasRes.data?.data || villasRes.data || [];
          const loadedRoles = Array.isArray(fetchedRoles) ? fetchedRoles : [];
          const loadedVillas = Array.isArray(fetchedVillas) ? fetchedVillas : [];
          setRoles(loadedRoles);
          setVillas(loadedVillas);

          const defaultRole = loadedRoles[0]?.name || '';
          setRows([
            {
              id: String(Date.now()),
              email: '',
              roleName: defaultRole,
              villaId: '',
              residentType: 'None',
              isValid: false,
            },
          ]);
        })
        .finally(() => setLoadingOptions(false));
    }
  }, [visible]);

  // Validate a row item
  const validateRow = (row: InviteRowItem, currentRoles = roles, allRows: InviteRowItem[] = rows): InviteRowItem => {
    if (!row.email.trim()) {
      return { ...row, isValid: false, error: 'Email is required' };
    }
    const emailRes = validateEmail(row.email.trim());
    if (!emailRes.isValid) {
      return { ...row, isValid: false, error: emailRes.message || 'Invalid email format' };
    }
    const hasDuplicate = allRows.some(
      (r) => r.id !== row.id && r.email.trim().toLowerCase() === row.email.trim().toLowerCase()
    );
    if (hasDuplicate) {
      return { ...row, isValid: false, error: 'Duplicate email in this list' };
    }
    if (!row.roleName) {
      return { ...row, isValid: false, error: 'Role is required' };
    }

    return { ...row, isValid: true, error: undefined };
  };

  // Helper to parse CSV string content into InviteRowItems
  const parseCSVText = (text: string) => {
    if (!text.trim()) return;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const parsed: InviteRowItem[] = [];
    lines.forEach((line, index) => {
      // Skip header row if present
      if (index === 0 && (line.toLowerCase().includes('email') || line.toLowerCase().includes('role'))) return;

      const parts = line.split(',').map((p) => p.trim());
      const email = parts[0] || '';
      const roleName = parts[1] || (roles[0]?.name || '');
      const villaName = parts[2] || '';
      const residentType = parts[3] || 'None';

      const matchingVilla = villas.find(
        (v) =>
          String(v.unitNumber || v.villaNumber).toLowerCase() === villaName.toLowerCase() ||
          String(v.unitNumber || v.villaNumber) === villaName.replace(/villa/i, '').trim()
      );

      const row: InviteRowItem = {
        id: String(Date.now() + index),
        email,
        roleName,
        villaId: matchingVilla?._id || matchingVilla?.id || '',
        residentType,
        isValid: false,
      };

      parsed.push(validateRow(row));
    });

    if (parsed.length > 0) {
      setRows(parsed);
      setActiveTab('manual');
      setErrorMsg('');
    } else {
      setErrorMsg('No valid invitation records found in CSV file.');
    }
  };

  // Trigger Document Picker for CSV Upload
  const handlePickDocument = async () => {
    try {
      setErrorMsg('');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFileName(asset.name);

        let text = '';
        if (Platform.OS === 'web' && (asset as any).file) {
          text = await (asset as any).file.text();
        } else if (asset.uri) {
          const fs = LegacyFileSystem || FileSystem;
          if (fs.readAsStringAsync) {
            text = await fs.readAsStringAsync(asset.uri);
          }
        }

        if (text) {
          parseCSVText(text);
        } else {
          setErrorMsg('Could not read text content from selected file.');
        }
      }
    } catch (err: any) {
      console.error('Document picker error:', err);
      setErrorMsg('Failed to select file. Please try again.');
    }
  };

  // Trigger Download / Share Sample CSV
  const handleDownloadSample = async () => {
    await downloadCSVFile(SAMPLE_CSV_CONTENT, 'bulk_invite_users_template.csv');
  };

  // Add new empty row for manual tab
  const handleAddRow = () => {
    const defaultRole = roles[0]?.name || '';
    const newRow: InviteRowItem = {
      id: String(Date.now() + Math.random()),
      email: '',
      roleName: defaultRole,
      villaId: '',
      residentType: 'None',
      isValid: false,
    };
    setRows((prev) => [...prev, newRow]);
  };

  // Remove row item
  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Update row field
  const handleRowChange = (id: string, field: keyof InviteRowItem, value: any) => {
    setRows((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'roleName') {
            const roleObj = roles.find((r) => r.name === value);
            if (roleObj?.isTenantRole) {
              const lower = value.toLowerCase();
              if (lower.includes('owner')) updated.residentType = 'Owner';
              else if (lower.includes('tenant')) updated.residentType = 'Tenant';
              else if (lower.includes('family')) updated.residentType = 'Family';
              else updated.residentType = 'Owner';
            } else {
              updated.residentType = 'None';
              updated.villaId = '';
            }
          }
          return validateRow(updated);
        }
        return item;
      })
    );
  };

  // Submit Bulk Invitations
  const handleSubmit = async () => {
    const validatedRows = rows.map((r) => validateRow(r));
    setRows(validatedRows);

    const validRows = validatedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setErrorMsg('No valid invitation entries found. Please enter email and select role.');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);

    try {
      const payload: InviteUserData[] = validRows.map((r) => ({
        email: r.email.trim(),
        roleName: r.roleName || null,
        villaId: r.villaId || null,
        residentType: r.residentType || 'None',
      }));

      const res = await onBulkInvite(payload);
      setSuccessResults(res || { invitedCount: payload.length });
    } catch (err: any) {
      const parsed = parseBackendError(err, 'Failed to send bulk invitations');
      setErrorMsg(parsed.userMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const roleOptions = roles.map((r) => ({
    label: `${r.name} ${r.isTenantRole ? '(Unit)' : '(Global)'}`,
    value: r.name,
  }));

  const villaOptions = villas.map((v) => ({
    label: `Unit ${v.unitNumber || v.villaNumber} ${v.blockOrBuilding ? `(${v.blockOrBuilding})` : ''}`,
    value: v._id || v.id,
  }));

  const validCount = rows.filter((r) => r.isValid).length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Bulk Invite Users"
    >
      {/* Success Result View */}
      {successResults ? (
        <View className="py-6 items-center">
          <View className="w-14 h-14 rounded-full bg-emerald-500/10 items-center justify-center mb-3 border border-emerald-500/30">
            <CheckCircle2 size={32} color="#10b981" />
          </View>
          <Text className="text-base font-bold text-foreground mb-1 text-center">
            Bulk Invitations Processed!
          </Text>
          <Text className="text-xs text-muted-foreground text-center mb-4 px-4">
            Successfully dispatched invitation tokens for {validCount} user(s).
          </Text>
          <Button variant="default" size="sm" onPress={onClose}>
            Done & Close
          </Button>
        </View>
      ) : (
        <>
          {/* Tab Selector: Upload CSV vs Manual Entries */}
          <View className="flex-row p-1 bg-muted/40 rounded-xl mb-3 border border-border/40">
            <TouchableOpacity
              onPress={() => setActiveTab('upload')}
              className={`flex-1 py-1.5 rounded-lg items-center ${activeTab === 'upload' ? 'bg-card shadow-xs' : ''}`}
            >
              <Text className={`text-xs font-semibold ${activeTab === 'upload' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                Upload File
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('manual')}
              className={`flex-1 py-1.5 rounded-lg items-center ${activeTab === 'manual' ? 'bg-card shadow-xs' : ''}`}
            >
              <Text className={`text-xs font-semibold ${activeTab === 'manual' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                Manual Entries ({rows.length})
              </Text>
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View className="p-3 mb-3 bg-destructive/10 border border-destructive/20 rounded-xl flex-row items-start">
              <AlertTriangle size={16} color="#ef4444" className="me-2 mt-0.5" />
              <Text className="text-xs text-destructive font-semibold flex-1 text-start">{errorMsg}</Text>
            </View>
          ) : null}

          {/* Scrollable Content Area */}
          <View className="space-y-2 pb-2">
            {loadingOptions ? (
              <View className="py-8 items-center justify-center">
                <AppLoader variant="inline" />
                <Text className="text-xs text-muted-foreground mt-2">Loading roles & villa units...</Text>
              </View>
            ) : activeTab === 'upload' ? (
              /* Upload CSV File Tab */
              <View className="space-y-3">
                {/* Document Picker Drop Zone Card */}
                <TouchableOpacity
                  onPress={handlePickDocument}
                  activeOpacity={0.8}
                  className="p-6 bg-primary/5 border-2 border-dashed border-primary/40 rounded-2xl items-center justify-center mb-3"
                >
                  <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mb-2">
                    <FileSpreadsheet size={24} color="#6366f1" />
                  </View>
                  <Text className="text-sm font-bold text-foreground mb-1 text-center">
                    {selectedFileName ? selectedFileName : 'Tap to Choose CSV File'}
                  </Text>
                  <Text className="text-xs text-muted-foreground text-center mb-3">
                    {selectedFileName ? 'CSV Loaded! Check Entries tab to review.' : 'Supports .csv, .txt files formatted with columns'}
                  </Text>

                  <View className="px-4 py-2 bg-primary rounded-xl flex-row items-center shadow-xs">
                    <Upload size={14} color="#ffffff" className="me-1.5" />
                    <Text className="text-xs font-bold text-white">
                      {selectedFileName ? 'Choose Different File' : 'Browse CSV File'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Download Sample Template Card */}
                <View className="p-3 bg-muted/20 border border-border/60 rounded-2xl flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 me-2">
                    <FileText size={18} color="#6366f1" className="me-2" />
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-foreground text-start">Need a CSV template?</Text>
                      <Text className="text-[10px] text-muted-foreground text-start">Download formatted CSV sample file</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleDownloadSample}
                    className="px-3 py-1.5 rounded-xl bg-card border border-border/80 flex-row items-center active:opacity-70"
                  >
                    <Download size={12} color="#6366f1" className="me-1" />
                    <Text className="text-xs font-semibold text-primary">Sample</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Manual Entries Review Tab */
              <View className="space-y-3">
                {rows.map((row, index) => {
                  const selectedRoleObj = roles.find((r) => r.name === row.roleName);
                  const isTenantRole = selectedRoleObj ? !!selectedRoleObj.isTenantRole : false;

                  return (
                    <View
                      key={row.id}
                      className="p-3.5 bg-card border border-border/80 rounded-2xl mb-3 shadow-xs"
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs font-bold text-foreground">
                            Entry #{index + 1}
                          </Text>
                          {row.isValid ? (
                            <StatusBadge label="Valid" variant="success" />
                          ) : (
                            <StatusBadge label={row.error || 'Incomplete'} variant="warning" />
                          )}
                        </View>

                        {rows.length > 1 && (
                          <TouchableOpacity
                            onPress={() => handleRemoveRow(row.id)}
                            className="p-1.5 rounded-xl bg-destructive/10 border border-destructive/20 active:opacity-70"
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Email Field */}
                      <View className="mb-2.5">
                        <Text className="text-[11px] font-semibold text-muted-foreground mb-1 text-start">Email Address *</Text>
                        <TextInput
                          placeholder="user@domain.com"
                          value={row.email}
                          onChangeText={(val) => handleRowChange(row.id, 'email', val)}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>

                      {/* Role Selection */}
                      <View className="mb-2.5">
                        <Text className="text-[11px] font-semibold text-muted-foreground mb-1 text-start">Assigned Role *</Text>
                        <DropdownSelect
                          options={roleOptions}
                          value={row.roleName}
                          onValueChange={(val) => handleRowChange(row.id, 'roleName', val)}
                          placeholder="-- Select Role --"
                        />
                      </View>

                      {/* Unit Selection if Tenant/Unit role */}
                      {isTenantRole && (
                        <View className="mb-1">
                          <Text className="text-[11px] font-semibold text-muted-foreground mb-1 text-start">Villa Unit (Optional)</Text>
                          <DropdownSelect
                            options={villaOptions}
                            value={row.villaId}
                            onValueChange={(val) => handleRowChange(row.id, 'villaId', val)}
                            placeholder="-- Choose Villa Unit (Optional) --"
                          />
                        </View>
                      )}
                    </View>
                  );
                })}

                <Button variant="outline" size="sm" leftIcon={Plus} onPress={handleAddRow} className="mt-1">
                  Add Another User Entry
                </Button>
              </View>
            )}
          </View>

          {/* Footer */}
          <View className="flex-row items-center justify-between pt-3 border-t border-border mt-3">
            <Text className="text-xs font-semibold text-muted-foreground">
              Valid: <Text className="font-bold text-foreground">{validCount}</Text> of {rows.length}
            </Text>

            <View className="flex-row items-center gap-2">
              <Button variant="outline" size="sm" onPress={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onPress={handleSubmit}
                loading={submitting}
                disabled={validCount === 0 || submitting}
              >
                Send ({validCount}) Invites
              </Button>
            </View>
          </View>
        </>
      )}
    </BottomSheet>
);
};

export default BulkInviteModal;
