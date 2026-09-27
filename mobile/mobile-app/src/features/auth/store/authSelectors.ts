import { RootState } from '../../../store/store';

export const selectAuthUser = (state: RootState) => (state as any).auth?.user;

export const selectCurrentUserId = (state: RootState): string => {
  const user = selectAuthUser(state);
  if (!user) return '';

  const rawId =
    user.id ||
    user._id ||
    user.userId ||
    user.user?.id ||
    user.user?._id ||
    user.sub ||
    '';

  if (typeof rawId === 'string') return rawId;
  if (typeof rawId === 'object' && rawId !== null) return rawId._id || rawId.id || '';
  return '';
};

/** The unit a resident is currently acting for (kept in sync by the villa switcher). */
export const selectActiveVillaId = (state: RootState): string => {
  const user = selectAuthUser(state);
  return user?.activeVillaId || user?.villaId || '';
};

export const selectActiveOrgId = (state: RootState): string => {
  const user = selectAuthUser(state);
  if (!user) return '';

  return (
    user.orgId ||
    user.organizationId ||
    user.org?._id ||
    user.organization?._id ||
    user.activeOrgId ||
    user.activeOrganizationId ||
    (Array.isArray(user.availableWorkspaces) && user.availableWorkspaces[0]?.orgId) ||
    (Array.isArray(user.availableWorkspaces) && user.availableWorkspaces[0]?._id) ||
    ''
  );
};
