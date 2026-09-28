import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { VisitorPassWizard } from '@/src/features/visitor/components/wizard/VisitorPassWizard';
import { useVisitorPass } from '@/src/features/visitor/hooks/useVisitorPass';
import { selectActiveOrgId, selectActiveVillaId, selectAuthUser } from '@/src/features/auth/store/authSelectors';
import { PassTypeKey } from '@/src/features/visitor/mocks/visitorMocks';

export default function InviteVisitorScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ type?: string }>();
  const authUser = useSelector(selectAuthUser);
  const activeOrgId = useSelector(selectActiveOrgId);
  const activeVillaId = useSelector(selectActiveVillaId);
  const { createNewPass } = useVisitorPass();

  const initialType: PassTypeKey =
    routeParams.type && ['GUEST', 'GROUP', 'CAB', 'DELIVERY', 'SERVICE'].includes(routeParams.type.toUpperCase())
      ? (routeParams.type.toUpperCase() as PassTypeKey)
      : 'GUEST';

  const rawRole = (
    authUser?.role?.name ||
    authUser?.role ||
    authUser?.user?.role ||
    authUser?.userRole ||
    'RESIDENT'
  ).toString().toUpperCase();

  const isAdmin =
    rawRole.includes('ADMIN') ||
    rawRole.includes('MANAGER') ||
    rawRole.includes('SUPER');

  const roleContext = {
    role: (isAdmin ? 'ADMIN' : 'RESIDENT') as 'ADMIN' | 'RESIDENT',
    orgId: activeOrgId,
    createdById: authUser?.id || authUser?._id,
    villaId: activeVillaId || undefined,
  };

  return (
    <ScreenShell
      title="Invite Visitor"
      subtitle="Pre-approve guest entry & generate QR passes"
      hideHeader
      hideBottomNav
    >
      <VisitorPassWizard
        initialType={initialType}
        roleContext={roleContext}
        onSubmitPass={async (payload) => {
          return await createNewPass(payload);
        }}
        onClose={() => router.back()}
      />
    </ScreenShell>
  );
}
