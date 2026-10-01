with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'r') as f:
    content = f.read()

old_header = """        <Button
          size="sm"
          variant="outline"
          onPress={() => setWalkInModalOpen(true)}
          className="h-8 rounded-full flex-row items-center justify-center bg-secondary/80 border border-border/80 px-3 shadow-2xs"
        >
          <Text className="text-foreground text-[11px] font-bold">+ {t('gate_actions', 'Gate Actions')}</Text>
        </Button>"""

new_header = """        <Button
          size="sm"
          onPress={() => setWalkInModalOpen(true)}
          className="h-8 rounded-full flex-row items-center justify-center bg-white px-4 shadow-sm"
        >
          <Text className="text-black text-[12px] font-extrabold">+ {t('gate_actions', 'Gate Actions')}</Text>
        </Button>"""

content = content.replace(old_header, new_header)

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'w') as f:
    f.write(content)

