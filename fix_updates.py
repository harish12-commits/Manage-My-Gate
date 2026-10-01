import re

# 1. Fix GuardInitiateWalkInModal
with open('./mobile/mobile-app/src/features/visitor/components/guard/GuardInitiateWalkInModal.tsx', 'r') as f:
    content = f.read()

content = content.replace('title="Initiate Gate Walk-In"', 'title="Walk in Invite"')

old_btns = """          <View className="flex-row gap-2 pt-2 border-t border-border">
            <Button variant="outline" className="flex-1 h-11 rounded-xl" onPress={onClose} disabled={loading}>
              <Text className="text-xs font-semibold text-foreground">Cancel</Text>
            </Button>
            <Button
              variant="default"
              className="flex-1 h-11 rounded-xl"
              onPress={handleSubmit}
              disabled={loading}
              loading={loading}
            >
              <Text className="text-xs font-bold text-primary-foreground">Send Resident Request</Text>
            </Button>
          </View>"""

new_btns = """          <View className="flex-row gap-3 pt-4">
            <Button variant="outline" className="flex-1 h-12 rounded-xl border border-border bg-background" onPress={onClose} disabled={loading}>
              <Text className="text-sm font-bold text-foreground">Cancel</Text>
            </Button>
            <Button variant="default" className="flex-1 h-12 rounded-xl bg-primary shadow-sm shadow-orange-500/20" onPress={handleSubmit} disabled={loading} loading={loading}>
              <Text className="text-sm font-bold text-white">Continue</Text>
            </Button>
          </View>"""

content = content.replace(old_btns, new_btns)

with open('./mobile/mobile-app/src/features/visitor/components/guard/GuardInitiateWalkInModal.tsx', 'w') as f:
    f.write(content)

# 2. Fix gate-console.tsx header right button and remove BottomSheet
with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'r') as f:
    gc_content = f.read()

# Remove BottomSheet
bs_regex = r"      \{\/\* Gate Actions Bottom Sheet \*\/}.*?<\/BottomSheet>"
gc_content = re.sub(bs_regex, "", gc_content, flags=re.DOTALL)

# Remove state
gc_content = gc_content.replace("  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);\n", "")

# Change header button style and onPress
old_header = """        <Button
          size="sm"
          onPress={() => setActionsSheetOpen(true)}
          className="bg-primary px-3 h-8 rounded-full flex-row items-center justify-center shadow-md shadow-orange-500/20"
        >
          <Text className="text-white text-[11px] font-bold">+ {t('gate_actions', 'Gate Actions')}</Text>
        </Button>"""

new_header = """        <Button
          size="sm"
          variant="outline"
          onPress={() => setWalkInModalOpen(true)}
          className="h-8 rounded-full flex-row items-center justify-center bg-secondary/80 border border-border/80 px-3 shadow-2xs"
        >
          <Text className="text-foreground text-[11px] font-bold">+ {t('gate_actions', 'Gate Actions')}</Text>
        </Button>"""

gc_content = gc_content.replace(old_header, new_header)

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'w') as f:
    f.write(gc_content)

# 3. Fix forgot-password.tsx keyboard jumping & button
with open('./mobile/mobile-app/app/(auth)/forgot-password.tsx', 'r') as f:
    fp_content = f.read()

# Make sure useSafeAreaInsets is imported and used
if "useSafeAreaInsets" not in fp_content:
    fp_content = fp_content.replace(
        "import { useTranslation } from '@/src/utils/i18n';",
        "import { useTranslation } from '@/src/utils/i18n';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';"
    )

if "const insets =" not in fp_content:
    fp_content = fp_content.replace(
        "const loading = emailLoading || phoneLoading || verifyingOtp || resettingPwd;",
        "const loading = emailLoading || phoneLoading || verifyingOtp || resettingPwd;\n  const insets = useSafeAreaInsets();"
    )

# Replace the layout
old_layout = """      <ImageBackground
        source={require('../../assets/images/auth-bg.jpg')}
        style={{ flex: 1 }}
        blurRadius={Platform.OS === 'ios' ? 3 : 2}
        resizeMode="cover"
      >
        <View className="absolute inset-0 bg-white/45 dark:bg-[#0B0E14]/60" />
        <KeyboardAwareScrollView
            extraScrollHeight={56}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            className="px-5 py-8"
          >
          <View className="max-w-sm mx-auto w-full gap-4">
            {/* Brand Emblem */}
            <View className="items-center justify-center mb-1">
              <NahomEmblem size={96} />
              <NahomWordmark />
            </View>"""

new_layout = """      <ImageBackground
        source={require('../../assets/images/auth-bg.jpg')}
        style={{ flex: 1 }}
        blurRadius={Platform.OS === 'ios' ? 3 : 2}
        resizeMode="cover"
      >
        <View className="absolute inset-0 bg-white/45 dark:bg-[#0B0E14]/60" />

        {/* Fixed Brand Identity Section */}
        <View 
          className="items-center justify-center z-10 w-full"
          style={{ paddingTop: Math.max(insets.top, 24) + 12, paddingBottom: 8 }}
          pointerEvents="box-none"
        >
          <NahomEmblem size={96} />
          <NahomWordmark />
        </View>

        <KeyboardAwareScrollView
            extraScrollHeight={56}
            enableAutoScroll={Platform.OS !== 'ios'}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: Math.max(insets.bottom, 20) + 24,
            }}
            keyboardShouldPersistTaps="handled"
        >
          <View className="max-w-sm mx-auto w-full px-5 py-2 mt-2 gap-4">"""

fp_content = fp_content.replace(old_layout, new_layout)

with open('./mobile/mobile-app/app/(auth)/forgot-password.tsx', 'w') as f:
    f.write(fp_content)

