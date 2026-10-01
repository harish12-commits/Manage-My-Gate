import React from 'react';
import { act, render, renderHook } from '@testing-library/react-native';
import { PermissionMatrixGrid } from '../components/PermissionMatrixGrid';
import { useRoleForm } from '../hooks/useRoleForm';

describe('Role Builder notice board and polls permissions', () => {
  it('renders notice and poll permissions in one group', async () => {
    const { getByText, queryByText } = await render(
      <PermissionMatrixGrid
        groupedPermissions={{
          Notices: [
            { name: 'notices:active_board' },
            { name: 'notices:manage_notices' },
          ],
          Polls: [
            { name: 'polls:read' },
            { name: 'polls:vote' },
          ],
        }}
        selectedIds={['notices:active_board', 'polls:read']}
        onSelectAllGroup={jest.fn()}
        onTogglePermission={jest.fn()}
      />
    );

    expect(getByText('Notice Board & Polls')).toBeTruthy();
    expect(getByText('Resident Feed')).toBeTruthy();
    expect(getByText('Community Engagement')).toBeTruthy();
    expect(queryByText('Polls')).toBeNull();
  });

  it('deselects canonical and legacy notice/poll permissions together', async () => {
    const role = {
      id: 'role-1',
      name: 'Board Member',
      permissions: [
        'notices:active_board',
        'notices:read',
        'notices:polls',
        'polls:read',
        'polls:vote',
        'notices:manage_notices',
        'polls:create',
        'billing:dashboard',
      ],
    };
    const onSave = jest.fn();
    const { result } = await renderHook(() =>
      useRoleForm({
        role,
        visible: true,
        onSave,
      })
    );

    await act(async () => {
      result.current.handleSelectAllGroup(
        ['notices:active_board', 'notices:polls', 'notices:manage_notices'],
        false
      );
    });

    expect(result.current.selectedPermissions).toEqual(['billing:dashboard']);
  });
});
