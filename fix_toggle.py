import re

with open('./mobile/mobile-app/app/(auth)/forgot-password.tsx', 'r') as f:
    content = f.read()

if "AuthMethodSelector" not in content:
    content = content.replace("import { OtpInputField } from '@/components/auth/OtpInputField';", "import { OtpInputField } from '@/components/auth/OtpInputField';\nimport { AuthMethodSelector } from '@/components/auth/AuthMethodSelector';")

selector_block = r"\{\/\* Method Selector \*\/}.*?<\/View>\s*<\/View>\s*\{method === 'email' \?"
new_selector_block = """{/* Method Selector */}
                  <View className="mb-2">
                    <AuthMethodSelector
                      value={method === 'email' ? 'basic' : 'phone'}
                      onChange={(val) => setMethod(val === 'basic' ? 'email' : 'phone')}
                      emailLabel={t('email', 'Email')}
                      otpLabel={t('phone_number', 'Phone Number')}
                      reduceMotion={false}
                    />
                  </View>

                  {method === 'email' ?"""

content = re.sub(selector_block, new_selector_block, content, flags=re.DOTALL)

with open('./mobile/mobile-app/app/(auth)/forgot-password.tsx', 'w') as f:
    f.write(content)

