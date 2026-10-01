import re

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'r') as f:
    content = f.read()

# 1. Import BottomSheet
if "BottomSheet" not in content:
    content = content.replace("import { ScreenShell } from '@/components';", "import { ScreenShell, BottomSheet } from '@/components';")
    content = content.replace("import { ScreenShell } from '../../components';", "import { ScreenShell, BottomSheet } from '../../components';")
    content = content.replace("import { ScreenShell, KPIRow, TabBar } from '@/components';", "import { ScreenShell, KPIRow, TabBar, BottomSheet } from '@/components';")
    # Just in case, add it manually if not found above
    if "BottomSheet" not in content:
        content = content.replace("import { ScreenShell", "import { BottomSheet }\nimport { ScreenShell")

# 2. Add state for BottomSheet
state_decl = "const [qrScannerOpen, setQrScannerOpen] = useState(false);"
new_state_decl = state_decl + "\n  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);"
content = content.replace(state_decl, new_state_decl)

# 3. Add headerRight to ScreenShell
shell_start = """    <ScreenShell
      title="Gate Security Console"
      subtitle="Guard check-in verification, QR scanner & walk-in entry"
      iconName="ShieldCheck"
    >"""

shell_start_new = """    <ScreenShell
      title="Gate Security Console"
      subtitle="Guard check-in verification, QR scanner & walk-in entry"
      iconName="ShieldCheck"
      headerRight={
        <Button
          size="sm"
          onPress={() => setActionsSheetOpen(true)}
          className="bg-primary px-3 h-8 rounded-full flex-row items-center justify-center shadow-md shadow-orange-500/20"
        >
          <Text className="text-white text-[11px] font-bold">+ {t('gate_actions', 'Gate Actions')}</Text>
        </Button>
      }
    >"""
content = content.replace(shell_start, shell_start_new)

# 4. Remove the Guard Quick Actions block
guard_actions_block = r"\{\/\* Guard Quick Actions \*\/}.*?<\/View>\n            <\/View>"
content = re.sub(guard_actions_block, "", content, flags=re.DOTALL)

# 5. Append BottomSheet at the end of the file, just before </ScreenShell>
bottom_sheet_jsx = """      {/* Gate Actions Bottom Sheet */}
      <BottomSheet
        visible={actionsSheetOpen}
        onClose={() => setActionsSheetOpen(false)}
        title={t('gate_actions', 'Gate Actions')}
      >
        <View className="gap-2 p-4 pt-0">
          <Button
            variant="outline"
            onPress={() => { setActionsSheetOpen(false); setWalkInModalOpen(true); }}
            className="h-14 rounded-xl flex-row items-center justify-start gap-3 bg-amber-500/10 border-amber-500/20 px-4"
          >
            <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />
            <Text className="text-sm font-bold text-amber-600 dark:text-amber-400">{t('initiate_walk_in', 'Initiate Walk-In')}</Text>
          </Button>

          <Button
            variant="outline"
            onPress={() => { setActionsSheetOpen(false); setActiveTab('DIRECTORY'); }}
            className="h-14 rounded-xl flex-row items-center justify-start gap-3 bg-primary/10 border-primary/20 px-4 mt-2"
          >
            <Search size={20} className="text-primary" />
            <Text className="text-sm font-bold text-primary">{t('villa_directory', 'Villa Directory')}</Text>
          </Button>

          <Button
            variant="outline"
            onPress={() => { setActionsSheetOpen(false); setActiveTab('INSIDE'); }}
            className="h-14 rounded-xl flex-row items-center justify-start gap-3 bg-red-500/10 border-red-500/20 px-4 mt-2"
          >
            <LogOut size={20} className="text-red-600 dark:text-red-400" />
            <Text className="text-sm font-bold text-red-600 dark:text-red-400">{t('gate_check_out', 'Gate Check-Out')}</Text>
          </Button>
        </View>
      </BottomSheet>
    </ScreenShell>"""

content = content.replace("    </ScreenShell>", bottom_sheet_jsx)

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'w') as f:
    f.write(content)
