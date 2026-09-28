import React, { useEffect, useMemo, useState } from 'react';
import { GlobalFilterPanel, FilterCategoryConfig } from '@/components/ui/GlobalFilterPanel';
import { Layers, Shield } from 'lucide-react-native';

interface UserFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  availableRoles: string[];
  selectedRoles: string[];
  onToggleRole: (role: string) => void;
  onClearRoles: () => void;
  statusOptions: string[];
  selectedStatuses: string[];
  onToggleStatus: (status: string) => void;
}

export const UserFilterSheet: React.FC<UserFilterSheetProps> = ({
  visible,
  onClose,
  availableRoles,
  selectedRoles,
  onToggleRole,
  onClearRoles,
  statusOptions,
  selectedStatuses,
  onToggleStatus,
}) => {
  const [draftRoles, setDraftRoles] = useState(selectedRoles);
  const [draftStatuses, setDraftStatuses] = useState(selectedStatuses);

  useEffect(() => {
    if (visible) {
      setDraftRoles(selectedRoles);
      setDraftStatuses(selectedStatuses);
    }
  }, [visible, selectedRoles, selectedStatuses]);

  const toggleDraftRole = (role: string) => {
    setDraftRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    );
  };

  const toggleDraftStatus = (status: string) => {
    setDraftStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
    );
  };

  const handleApply = () => {
    selectedRoles
      .filter((role) => !draftRoles.includes(role))
      .forEach(onToggleRole);
    draftRoles
      .filter((role) => !selectedRoles.includes(role))
      .forEach(onToggleRole);
    selectedStatuses
      .filter((status) => !draftStatuses.includes(status))
      .forEach(onToggleStatus);
    draftStatuses
      .filter((status) => !selectedStatuses.includes(status))
      .forEach(onToggleStatus);
    onClose();
  };

  const handleClearAll = () => {
    setDraftRoles([]);
    setDraftStatuses([]);
    onClearRoles();
    selectedStatuses.forEach((st) => onToggleStatus(st));
    onClose();
  };

  const totalActiveCount = draftRoles.length + draftStatuses.length;

  const categoryConfigs: FilterCategoryConfig[] = useMemo(() => [
    {
      id: 'status',
      label: 'Account Status',
      icon: Layers,
      type: 'checkbox',
      options: statusOptions.map((st) => ({ id: st, label: st })),
      selectedValues: draftStatuses,
      selectedCount: draftStatuses.length,
      onOptionToggle: toggleDraftStatus,
    },
    {
      id: 'roles',
      label: 'User Roles',
      icon: Shield,
      type: 'checkbox',
      options: availableRoles.map((role) => ({ id: role, label: role })),
      selectedValues: draftRoles,
      selectedCount: draftRoles.length,
      onOptionToggle: toggleDraftRole,
    },
  ], [statusOptions, draftStatuses, availableRoles, draftRoles]);

  return (
    <GlobalFilterPanel
      visible={visible}
      onClose={onClose}
      title="Filter Users"
      categories={categoryConfigs}
      onApply={handleApply}
      onClearAll={handleClearAll}
      totalActiveCount={totalActiveCount}
    />
  );
};

export default UserFilterSheet;
