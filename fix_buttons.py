import re

# 1. Update forgot-password.tsx gradient
with open('./mobile/mobile-app/app/(auth)/forgot-password.tsx', 'r') as f:
    fp_content = f.read()

old_gradient = """                        <Defs>
                          <LinearGradient id="signInGrad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor="#F97316" stopOpacity="1" />
                            <Stop offset="1" stopColor="#EA580C" stopOpacity="1" />
                          </LinearGradient>
                        </Defs>"""

new_gradient = """                        <Defs>
                          <LinearGradient id="signInGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <Stop offset="0%" stopColor="#1E232E" />
                            <Stop offset="42%" stopColor="#252D3D" />
                            <Stop offset="75%" stopColor="#EA580C" />
                            <Stop offset="100%" stopColor="#FF7A00" />
                          </LinearGradient>
                        </Defs>"""

fp_content = fp_content.replace(old_gradient, new_gradient)

with open('./mobile/mobile-app/app/(auth)/forgot-password.tsx', 'w') as f:
    f.write(fp_content)

# 2. Update gate-console.tsx button text
with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'r') as f:
    gc_content = f.read()

old_text = """<Text className="text-black text-[12px] font-extrabold">+ {t('gate_actions', 'Gate Actions')}</Text>"""
new_text = """<Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 12 }}>+ {t('gate_actions', 'Gate Actions')}</Text>"""

gc_content = gc_content.replace(old_text, new_text)

with open('./mobile/mobile-app/app/(resident)/visitor/gate-console.tsx', 'w') as f:
    f.write(gc_content)

