import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/text';
import { VisitorPassWizard } from '@/src/features/visitor/components/wizard/VisitorPassWizard';
import { AdminVillaFilterSheet } from '@/src/features/visitor/components/admin/AdminVillaFilterSheet';
import { AdminPassSetupData } from '@/src/features/visitor/components/admin/AdminPassSetupStep';
import { useAdminVisitor } from '@/src/features/visitor/hooks/useAdminVisitor';
import { selectActiveOrgId, selectAuthUser } from '@/src/features/auth/store/authSelectors';
import { PassTypeKey } from '@/src/features/visitor/mocks/visitorMocks';
import { Building2, Filter } from 'lucide-react-native';

export default function AdminCreatePassScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ type?: string }>();
  const authUser = useSelector(selectAuthUser);
  const activeOrgId = useSelector(selectActiveOrgId);
  const { createAdminPass } = useAdminVisitor();

  // Single target shared by the header picker and the wizard's scope step, so what the
  // header shows is always what the created pass targets.
  const [adminScope, setAdminScope] = useState<AdminPassSetupData>({ scope: 'COMMUNITY' });
  const targetVillaName = adminScope.scope === 'VILLA' && adminScope.villaName ? adminScope.villaName : 'Community Common Area';
  const [villaSheetOpen, setVillaSheetOpen] = useState(false);

  const initialType: PassTypeKey =
    routeParams.type && ['GUEST', 'GROUP', 'CAB', 'DELIVERY', 'SERVICE'].includes(routeParams.type.toUpperCase())
      ? (routeParams.type.toUpperCase() as PassTypeKey)
      : 'GUEST';

  const roleContext = {
    role: 'ADMIN' as const,
    orgId: activeOrgId,
    createdById: authUser?.id || authUser?._id,
    villaId: adminScope.villaId,
  };

  return (
    <ScreenShell
      title="Admin Pass Creation"
      subtitle="Issue visitor pass on behalf of villa or community event"
      hideHeader
      hideBottomNav={true}
    >
      <View className="flex-1 bg-background">
        <VisitorPassWizard
          initialType={initialType}
          roleContext={roleContext}
          onSubmitPass={async (payload) => {
            return await createAdminPass(payload);
          }}
          onClose={() => router.back()}
          adminScope={adminScope}
          onAdminScopeChange={setAdminScope}
          renderExtraStepHeader={() => (
            <View className="px-4 py-2 bg-muted/40 border-b border-border flex-row items-center gap-2">
              <View className="flex-1 min-w-0 flex-row items-center gap-1.5">
                <Building2 size={16} className="text-primary shrink-0" />
                <Text className="text-xs font-semibold text-muted-foreground shrink-0">Target:</Text>
                <Text className="flex-1 min-w-0 text-xs font-bold text-foreground" numberOfLines={1} ellipsizeMode="tail">
                  {targetVillaName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setVillaSheetOpen(true)}
                activeOpacity={0.7}
                hitSlop={6}
                className="shrink-0 h-10 flex-row items-center justify-center gap-1 bg-primary/10 px-3 rounded-xl border border-primary/20"
                accessibilityRole="button"
                accessibilityLabel="Change target destination"
              >
                <Text className="text-xs font-bold text-primary">Change</Text>
                <Filter size={12} className="text-primary ms-0.5" />
              </TouchableOpacity>
            </View>
          )}
        />

        <AdminVillaFilterSheet
          visible={villaSheetOpen}
          selectedVillaId={adminScope.villaId}
          onClose={() => setVillaSheetOpen(false)}
          onSelectVilla={(villaId, villaName, residentId, residentName) => {
            setAdminScope(
              villaId
                ? { scope: 'VILLA', villaId, villaName, residentId, residentName }
                : { scope: 'COMMUNITY' }
            );
          }}
        />
      </View>
    </ScreenShell>
  );
}
