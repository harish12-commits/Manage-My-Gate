import re

with open('./mobile/mobile-app/app/(auth)/forgot-password.tsx', 'r') as f:
    content = f.read()

# 1. Align the page to center
content = content.replace(
    "contentContainerStyle={{ flexGrow: 1 }}",
    "contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}"
)

# 2. Email / Phone number style to match outer page (login.tsx)
content = content.replace(
    """                          placeholder="name@example.com"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          error={emailForm.formState.errors.email?.message}
                          leftIcon={<Mail size={16} color="#94A3B8" />}""",
    """                          placeholder="name@example.com"
                          placeholderTextColor="#9CA3AF"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          error={emailForm.formState.errors.email?.message}
                          leftIcon={<Mail size={16} color="#94A3B8" />}
                          className="bg-white rounded-full h-[48px] py-0 shadow-sm border-0"
                          inputClassName="text-slate-900 text-[15px] font-medium"
                          style={{ fontSize: 15, fontWeight: '500', color: '#0F172A' }}"""
)

content = content.replace(
    """                        <PhoneInput
                          variant="glass"
                          label={t('phone_number', 'Phone Number')}
                          placeholder="98765 43210"
                          value={value}
                          onChangeText={onChange}
                          error={phoneForm.formState.errors.phone?.message}
                        />""",
    """                        <PhoneInput
                          variant="form"
                          label={t('phone_number', 'Phone Number')}
                          placeholder="98765 43210"
                          value={value}
                          onChangeText={onChange}
                          error={phoneForm.formState.errors.phone?.message}
                          className="bg-white rounded-full h-[48px] shadow-sm border-0 px-3"
                        />"""
)

# 3. Change "Send Recovery Code" button to gradient and rename to "Reset Password"
# Also need to import Svg etc.
if "import Svg" not in content:
    content = content.replace(
        "import { parseBackendError } from '@/src/utils/validation';",
        "import { parseBackendError } from '@/src/utils/validation';\nimport Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';"
    )

old_btn = """                  <Button
                    onPress={
                      method === 'email'
                        ? emailForm.handleSubmit(onSendOtp)
                        : phoneForm.handleSubmit(onSendOtp)
                    }
                    loading={loading}
                    textClassName="font-bold text-sm"
                    className="mt-2 h-12 bg-primary rounded-xl w-full items-center justify-center"
                  >
                    {t('send_recovery_code', 'Send Recovery Code')}
                  </Button>"""

new_btn = """                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={loading}
                    onPress={method === 'email' ? emailForm.handleSubmit(onSendOtp) : phoneForm.handleSubmit(onSendOtp)}
                    className="h-[48px] rounded-2xl w-full items-center justify-center shadow-md shadow-orange-500/20 overflow-hidden mt-2"
                  >
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, overflow: 'hidden' }}>
                      <Svg height="100%" width="100%" style={{ position: 'absolute' }}>
                        <Defs>
                          <LinearGradient id="signInGrad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor="#F97316" stopOpacity="1" />
                            <Stop offset="1" stopColor="#EA580C" stopOpacity="1" />
                          </LinearGradient>
                        </Defs>
                        <Rect width="100%" height="100%" rx="16" fill="url(#signInGrad)" />
                      </Svg>
                    </View>
                    {loading ? (
                      <View className="flex-row items-center gap-2 z-10">
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text className="font-bold text-white text-sm font-sans">{t('sending', 'Sending...')}</Text>
                      </View>
                    ) : (
                      <Text className="font-bold text-white text-base font-sans z-10">
                        {t('reset_password', 'Reset Password')}
                      </Text>
                    )}
                  </TouchableOpacity>"""

content = content.replace(old_btn, new_btn)

with open('./mobile/mobile-app/app/(auth)/forgot-password.tsx', 'w') as f:
    f.write(content)
