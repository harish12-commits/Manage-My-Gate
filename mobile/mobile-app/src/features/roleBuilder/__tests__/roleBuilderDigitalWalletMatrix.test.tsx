import React from 'react';
import { render, fireEvent, renderHook, act } from '@testing-library/react-native';
import { PermissionMatrixGrid } from '../components/PermissionMatrixGrid';
import { useRoleForm } from '../hooks/useRoleForm';
import { isFeatureAllowedForUser } from '../../../utils/rbac';

describe('Role Builder — Digital Wallet & Ledger Dedicated Group Matrix', () => {
  const mockGroupedPermissions = {
    billing: [
      { _id: 'p1', name: 'billing:dashboard', feature: 'billing', action: 'dashboard' },
      { _id: 'p2', name: 'billing:assessment_manager', feature: 'billing', action: 'assessment_manager' },
      { _id: 'p3', name: 'billing:action_center', feature: 'billing', action: 'action_center' },
    ],
    visitor: [
      { _id: 'p4', name: 'visitor:resident', feature: 'visitor', action: 'resident' },
      { _id: 'p5', name: 'visitor:guard', feature: 'visitor', action: 'guard' },
    ],
  };

  it('1. Separates action_center into a dedicated "Digital Wallet & Ledger" group distinct from "Billing & Invoices"', async () => {
    const handleToggle = jest.fn();
    const handleSelectAll = jest.fn();

    const { getByText } = await render(
      <PermissionMatrixGrid
        groupedPermissions={mockGroupedPermissions}
        selectedIds={['billing:action_center']}
        onSelectAllGroup={handleSelectAll}
        onTogglePermission={handleToggle}
      />
    );

    // Group headers must both exist as separate groups
    expect(getByText('Digital Wallet & Ledger')).toBeTruthy();
    expect(getByText('Billing & Invoices')).toBeTruthy();

    // Digital Wallet item label and subtitle must be rendered
    expect(getByText('Digital Wallet & Resident Ledger')).toBeTruthy();
    expect(
      getByText('Prepaid wallet top-up, dues payments, and personal transaction receipts')
    ).toBeTruthy();

    // Billing items must have their clear labels
    expect(getByText('Billing Hub & Community Ledger')).toBeTruthy();
    expect(getByText('Assessment Manager')).toBeTruthy();
  });

  it('2. Clicking permission in Digital Wallet & Ledger group toggles billing:action_center', async () => {
    const handleToggle = jest.fn();
    const handleSelectAll = jest.fn();

    const { getByText } = await render(
      <PermissionMatrixGrid
        groupedPermissions={mockGroupedPermissions}
        selectedIds={[]}
        onSelectAllGroup={handleSelectAll}
        onTogglePermission={handleToggle}
      />
    );

    const walletItem = getByText('Digital Wallet & Resident Ledger');
    fireEvent.press(walletItem);

    expect(handleToggle).toHaveBeenCalledWith('billing:action_center', true);
  });

  it('3. Select All on Digital Wallet & Ledger group selects only billing:action_center', async () => {
    const handleToggle = jest.fn();
    const handleSelectAll = jest.fn();

    const { getAllByText } = await render(
      <PermissionMatrixGrid
        groupedPermissions={mockGroupedPermissions}
        selectedIds={[]}
        onSelectAllGroup={handleSelectAll}
        onTogglePermission={handleToggle}
      />
    );

    // Find all 'Select All' buttons (visitor, digital_wallet, billing)
    const selectAllButtons = getAllByText('Select All');
    expect(selectAllButtons.length).toBeGreaterThanOrEqual(2);

    // Press Select All on Digital Wallet & Ledger group
    fireEvent.press(selectAllButtons[0]);
  });

  it('4. RBAC access resolution verifies billing:action_center correctly gates Digital Wallet & Ledger', () => {
    const userWithWallet = {
      id: 'u1',
      role: 'Resident',
      permissions: ['billing:action_center'],
    };

    const userWithoutWallet = {
      id: 'u2',
      role: 'Staff',
      permissions: ['villas:read'],
    };

    const digitalWalletFeature = {
      id: 'billing_wallet',
      permission: 'billing:action_center',
      categoryKey: 'digital_wallet',
    };

    const financialHistoryFeature = {
      id: 'financial_history',
      permission: 'billing:action_center',
      categoryKey: 'digital_wallet',
    };

    // User with permission has access
    expect(isFeatureAllowedForUser(digitalWalletFeature, userWithWallet)).toBe(true);
    expect(isFeatureAllowedForUser(financialHistoryFeature, userWithWallet)).toBe(true);

    // User without permission is denied access
    expect(isFeatureAllowedForUser(digitalWalletFeature, userWithoutWallet)).toBe(false);
    expect(isFeatureAllowedForUser(financialHistoryFeature, userWithoutWallet)).toBe(false);
  });

  it('5. useRoleForm updates permissions with billing:action_center when granted or revoked', async () => {
    const onSave = jest.fn();
    const initialRole = {
      id: 'r1',
      name: 'Tenant Role',
      permissions: ['visitor:resident'],
    };

    const { result } = await renderHook(() =>
      useRoleForm({
        role: initialRole,
        visible: true,
        onSave,
      })
    );

    expect(result.current.selectedPermissions).toEqual(['visitor:resident']);

    // Toggle on Digital Wallet & Resident Ledger
    await act(async () => {
      result.current.handleTogglePermission('billing:action_center', true);
    });

    expect(result.current.selectedPermissions).toContain('billing:action_center');

    // Toggle off Digital Wallet & Resident Ledger
    await act(async () => {
      result.current.handleTogglePermission('billing:action_center', false);
    });

    expect(result.current.selectedPermissions).not.toContain('billing:action_center');
  });
});
