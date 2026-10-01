import re

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'r') as f:
    content = f.read()

old_header = r"headerRight=\{\s*<Button.*?>\s*<Text.*?>.*?<\/Text>\s*<\/Button>\s*\}"
new_header = """headerRight={
        <HeaderActionButton
          onPress={() => setWalkInModalOpen(true)}
          icon={Plus}
          label={t('gate_actions', 'Gate Actions')}
          accessibilityRole="button"
          accessibilityLabel="Gate Actions"
        />
      }"""

content = re.sub(old_header, new_header, content, flags=re.DOTALL)

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'w') as f:
    f.write(content)
