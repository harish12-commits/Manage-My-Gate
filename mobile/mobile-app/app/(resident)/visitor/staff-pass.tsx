import React from 'react';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { VisitorPassWizard } from '@/src/features/visitor/components/wizard/VisitorPassWizard';
import { useVisitorPass } from '@/src/features/visitor/hooks/useVisitorPass';
import { selectActiveOrgId, selectAuthUser } from '@/src/features/auth/store/authSelectors';

export default function StaffPassScreen() {
  const router = useRouter();
  const authUser = useSelector(selectAuthUser);
  const activeOrgId = useSelector(selectActiveOrgId);
  const { createNewPass } = useVisitorPass();

  const roleContext = {
    role: 'RESIDENT' as const,
    orgId: activeOrgId,
    createdById: authUser?.id || authUser?._id,
  };

  return (
    <ScreenShell title="Daily Staff Pass" subtitle="Recurring access for domestic help & daily staff" hideHeader hideBottomNav>
      <VisitorPassWizard
        initialType="SERVICE"
        roleContext={roleContext}
        onSubmitPass={async (payload) => {
          return await createNewPass(payload);
        }}
        onClose={() => router.back()}
      />
    </ScreenShell>
  );
}
