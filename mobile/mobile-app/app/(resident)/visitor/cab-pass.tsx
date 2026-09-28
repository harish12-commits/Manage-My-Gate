import React from 'react';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { VisitorPassWizard } from '@/src/features/visitor/components/wizard/VisitorPassWizard';
import { useVisitorPass } from '@/src/features/visitor/hooks/useVisitorPass';
import { selectActiveOrgId, selectActiveVillaId, selectAuthUser } from '@/src/features/auth/store/authSelectors';

export default function CabPassScreen() {
  const router = useRouter();
  const authUser = useSelector(selectAuthUser);
  const activeOrgId = useSelector(selectActiveOrgId);
  const activeVillaId = useSelector(selectActiveVillaId);
  const { createNewPass } = useVisitorPass();

  const roleContext = {
    role: 'RESIDENT' as const,
    orgId: activeOrgId,
    createdById: authUser?.id || authUser?._id,
    villaId: activeVillaId || undefined,
  };

  return (
    <ScreenShell title="Cab & Taxi Pass" subtitle="Vehicle pre-clearance & gate pass">
      <VisitorPassWizard
        initialType="CAB"
        roleContext={roleContext}
        onSubmitPass={async (payload) => {
          return await createNewPass(payload);
        }}
        onClose={() => router.back()}
      />
    </ScreenShell>
  );
}
