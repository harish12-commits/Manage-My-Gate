import React, { useState, useEffect } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { X, Key, Check } from 'lucide-react-native';
import { Button } from '@/components/common/Button';
import { UserData } from '../services/userService';
import { Text } from '@/components/ui/text';

interface ManageRolesModalProps {
  visible: boolean;
  user: UserData | null;
  unit?: any | null;
  onClose: () => void;
  onSave: (userId: string, roles: string[]) => Promise<void>;
  availableRoles: string[];
}

export const ManageRolesModal: React.FC<ManageRolesModalProps> = ({
  visible,
  user,
  unit,
  onClose,
  onSave,
  availableRoles,
}) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && user) {
      if (unit && unit.role) {
        setSelectedRoles(typeof unit.role === 'string' ? unit.role.split(',').map((r: string) => r.trim()) : [unit.role]);
      } else if (user.role) {
        setSelectedRoles(typeof user.role === 'string' ? user.role.split(',').map((r: string) => r.trim()) : [user.role]);
      } else {
        setSelectedRoles([]);
      }
    }
  }, [visible, user, unit]);

  if (!user) return null;

  const toggleRoleSelect = (roleName: string) => {
    if (selectedRoles.includes(roleName)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== roleName));
    } else {
      setSelectedRoles([...selectedRoles, roleName]);
    }
  };

  const handleSave = async () => {
    const userId = user.id || user._id || '';
    if (!userId) return;
    setSubmitting(true);
    try {
      await onSave(userId, selectedRoles);
      onClose();
    } catch (err) {
      console.error('Failed to save roles:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent={true} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={onClose} />
          <View className="bg-card rounded-t-3xl p-5 border-t border-border max-h-[85%]">
            {/* Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-border mb-4">
              <View className="flex-row items-center">
                <Key size={20} color="#6366f1" className="me-2" />
                <View>
                  <Text className="text-base font-bold text-foreground text-start">
                    Manage Access Roles
                  </Text>
                  <Text className="text-xs text-muted-foreground text-start">
                    User: {user?.name || ''} {unit ? `(Unit ${unit.villaNumber})` : ''}
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={onClose} className="p-1 rounded-full bg-muted">
                <X size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Multi-Role Selection List */}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} className="mb-4">
              <Text className="text-xs font-semibold text-muted-foreground text-start mb-2">
                Select user access roles:
              </Text>

              {availableRoles.length === 0 ? (
                <Text className="text-xs text-muted-foreground text-start py-4">
                  No roles defined in the system.
                </Text>
              ) : (
                availableRoles.map((roleName) => {
                  const isSelected = selectedRoles.includes(roleName);
                  return (
                    <TouchableOpacity
                      key={roleName}
                      onPress={() => toggleRoleSelect(roleName)}
                      className={`flex-row items-center justify-between p-3 rounded-xl mb-2 border ${
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'bg-muted/30 border-border'
                      }`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <Text
                        className={`text-sm font-semibold text-start ${
                          isSelected ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {roleName}
                      </Text>

                      <View
                        className={`w-5 h-5 rounded-md items-center justify-center border ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'bg-background border-border'
                        }`}
                      >
                        {isSelected ? <Check size={14} color="#ffffff" strokeWidth={3} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Footer Actions */}
            <View className="flex-row items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="outline" onPress={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="default" onPress={handleSave} loading={submitting}>
                Save Roles
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ManageRolesModal;
