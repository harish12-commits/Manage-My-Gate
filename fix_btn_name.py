import re

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'r') as f:
    gc_content = f.read()

old_text = """<Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 12 }}>+ {t('gate_actions', 'Gate Actions')}</Text>"""
new_text = """<Text style={{ color: '#000000', fontWeight: '900', fontSize: 13 }}>+ {t('walk_in', 'Walk In')}</Text>"""

gc_content = gc_content.replace(old_text, new_text)

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'w') as f:
    f.write(gc_content)

