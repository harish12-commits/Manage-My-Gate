import React from 'react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

interface AdminForceCheckoutModalProps {
  visible: boolean;
  visitorName?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const AdminForceCheckoutModal: React.FC<AdminForceCheckoutModalProps> = ({
  visible,
  visitorName = 'Visitor',
  loading = false,
  onClose,
  onConfirm,
}) => {
  return (
    <ConfirmationModal
      visible={visible}
      variant="warning"
      title="Force Check-Out"
      message={`Are you sure you want to manually check out ${visitorName}? This will mark the entry log as COMPLETED.`}
      confirmLabel="Force Check-Out"
      cancelLabel="Cancel"
      loading={loading}
      onCancel={onClose}
      onConfirm={() => onConfirm('Admin Emergency Force Checkout')}
    />
  );
};

export default AdminForceCheckoutModal;
