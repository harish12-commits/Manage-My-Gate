import re

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'r') as f:
    gc_content = f.read()

old_text = """<Text className="text-black font-black text-[14px] tracking-wide">+ {t('walk_in', 'Walk In')}</Text>"""
new_text = """<Text className="text-[13px] font-extrabold text-black tracking-wide">+ {t('walk_in', 'Walk In')}</Text>"""

gc_content = gc_content.replace(old_text, new_text)

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'w') as f:
    f.write(gc_content)

