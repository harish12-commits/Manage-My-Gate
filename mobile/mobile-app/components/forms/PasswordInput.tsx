import React, { forwardRef, useState } from 'react';
import { Platform, View, Text } from 'react-native';
import { TextInput, TextInputProps } from './TextInput';
import { Eye, EyeOff, Check, X } from 'lucide-react-native';
import { validatePassword } from '../../src/utils/validation';
import { useTranslation } from '../../src/utils/i18n';

export interface PasswordInputProps extends TextInputProps {
  showRequirements?: boolean;
  confirmValue?: string;
}

export const PasswordInput = forwardRef<any, PasswordInputProps>(
  ({ showRequirements = false, confirmValue, value, ...props }, ref) => {
    const { t, translateText } = useTranslation();
    const [isSecure, setIsSecure] = useState(true);

    const stringVal = typeof value === 'string' ? value : '';
    const { requirements, satisfiedCount } = validatePassword(stringVal);

    // Confirm match check
    const isConfirmMismatch =
      confirmValue !== undefined && stringVal.length > 0 && stringVal !== confirmValue;

    // Fix for Chrome [DOM] Password field is not contained in a form violation on Web
    const FormWrapper = Platform.OS === 'web' ? ('form' as any) : View;

    return (
      <View className="w-full">
        <FormWrapper style={Platform.OS === 'web' ? { width: '100%', margin: 0, padding: 0 } : undefined}>
          <TextInput
          ref={ref}
          value={value}
          secureTextEntry={isSecure}
          rightIcon={isSecure ? EyeOff : Eye}
          onRightIconPress={() => setIsSecure(!isSecure)}
          autoComplete={Platform.select({ web: 'current-password', default: 'password' })}
          textContentType="password"
          importantForAutofill="yes"
          accessibilityLabel={props.label || t('password', 'Password')}
          error={isConfirmMismatch ? t('passwords_not_match', 'Passwords do not match.') : props.error}
          {...props}
        />
        </FormWrapper>

        {showRequirements && Boolean(stringVal) && (
          <View className="flex-row flex-wrap gap-1.5 mt-2 ms-1">
            <View
              className={`flex-row items-center px-2 py-0.5 rounded-md border ${
                requirements.length
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                  : 'bg-muted border-border text-muted-foreground'
              }`}
            >
              {requirements.length ? (
                <Check size={10} className="text-emerald-600 me-1" />
              ) : (
                <X size={10} className="text-muted-foreground me-1" />
              )}
              <Text className="text-[10px] font-medium text-foreground">{t('req_8_chars', '8+ chars')}</Text>
            </View>

            <View
              className={`flex-row items-center px-2 py-0.5 rounded-md border ${
                requirements.uppercase
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                  : 'bg-muted border-border text-muted-foreground'
              }`}
            >
              {requirements.uppercase ? (
                <Check size={10} className="text-emerald-600 me-1" />
              ) : (
                <X size={10} className="text-muted-foreground me-1" />
              )}
              <Text className="text-[10px] font-medium text-foreground">{t('req_uppercase', 'Uppercase')}</Text>
            </View>

            <View
              className={`flex-row items-center px-2 py-0.5 rounded-md border ${
                requirements.lowercase
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                  : 'bg-muted border-border text-muted-foreground'
              }`}
            >
              {requirements.lowercase ? (
                <Check size={10} className="text-emerald-600 me-1" />
              ) : (
                <X size={10} className="text-muted-foreground me-1" />
              )}
              <Text className="text-[10px] font-medium text-foreground">{t('req_lowercase', 'Lowercase')}</Text>
            </View>

            <View
              className={`flex-row items-center px-2 py-0.5 rounded-md border ${
                requirements.number
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                  : 'bg-muted border-border text-muted-foreground'
              }`}
            >
              {requirements.number ? (
                <Check size={10} className="text-emerald-600 me-1" />
              ) : (
                <X size={10} className="text-muted-foreground me-1" />
              )}
              <Text className="text-[10px] font-medium text-foreground">{t('req_number', 'Number')}</Text>
            </View>
          </View>
        )}
      </View>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
