import React, { useState, useEffect } from 'react';
import { View, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { OtpInputField } from '@/components/auth/OtpInputField';
import { SheetGrabHandle } from '@/components/ui/SheetGrabHandle';
import { useTranslation } from '@/src/utils/i18n';
import { Mail, Check, RotateCw } from 'lucide-react-native';

interface VerifyEmailOtpModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
  onVerify: (otp: string) => void;
  onResend: () => void;
  loading?: boolean;
  resending?: boolean;
  errorMessage?: string | null;
  devCode?: string | null;
}

export const VerifyEmailOtpModal: React.FC<VerifyEmailOtpModalProps> = ({
  visible,
  email,
  onClose,
  onVerify,
  onResend,
  loading = false,
  resending = false,
  errorMessage = null,
  devCode = null,
}) => {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (visible) {
      setOtp('');
      setCountdown(60);
      if (devCode) {
        setOtp(devCode);
      }
    }
  }, [visible, devCode]);

  useEffect(() => {
    let timer: any;
    if (visible && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible, countdown]);

  const handleResend = () => {
    if (countdown === 0 && !resending) {
      setCountdown(60);
      onResend();
    }
  };

  const handleVerify = () => {
    if (otp.length === 6 && !loading) {
      onVerify(otp);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      statusBarTranslucent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-end bg-black/60">
          <Pressable className="flex-1" onPress={onClose} />
          <View className="bg-card rounded-t-3xl overflow-hidden border-t border-border px-5 pb-8 pt-2">
            <SheetGrabHandle onClose={onClose} />

            {/* Header Icon & Title */}
            <View className="items-center mt-2 mb-4">
              <View className="size-14 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center mb-3">
                <Mail size={26} className="text-primary" />
              </View>
              <Text className="text-lg font-bold text-foreground text-center">
                {t('verify_new_email', 'Verify New Email')}
              </Text>
              <Text className="text-xs text-muted-foreground text-center mt-1 px-4">
                {t('otp_sent_description', 'We sent a 6-digit verification code to:')}
              </Text>
              <View className="mt-1.5 px-3 py-1 bg-muted/30 border border-border rounded-full">
                <Text className="text-xs font-semibold text-foreground">
                  {email}
                </Text>
              </View>
            </View>

            {/* Developer Test Helper */}
            {devCode ? (
              <View className="mb-3 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl items-center">
                <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Dev Code: {devCode}
                </Text>
              </View>
            ) : null}

            {/* OTP Input Boxes */}
            <View className="my-2 items-center">
              <OtpInputField
                length={6}
                value={otp}
                onValueChange={setOtp}
                error={!!errorMessage}
              />
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View className="mt-2 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-xl items-center">
                <Text className="text-xs font-medium text-destructive text-center">
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {/* Resend Section */}
            <View className="flex-row items-center justify-center gap-1.5 mt-4 mb-3">
              <Text className="text-xs text-muted-foreground">
                {t('did_not_receive_code', "Didn't receive code?")}
              </Text>
              {countdown > 0 ? (
                <Text className="text-xs font-bold text-primary">
                  {t('resend_in', 'Resend in')} {countdown}s
                </Text>
              ) : (
                <Pressable
                  onPress={handleResend}
                  disabled={resending}
                  className="flex-row items-center gap-1 active:opacity-70"
                >
                  <RotateCw size={12} className="text-primary" />
                  <Text className="text-xs font-bold text-primary">
                    {resending ? t('sending', 'Sending...') : t('resend_code', 'Resend Code')}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Actions */}
            <View className="gap-2.5 mt-2">
              <Button
                variant="default"
                size="default"
                loading={loading}
                disabled={otp.length !== 6 || loading}
                leftIcon={Check}
                onPress={handleVerify}
                className="h-12 rounded-xl"
                textClassName="font-bold text-sm"
              >
                {t('verify_and_save_profile', 'Verify & Save Profile')}
              </Button>

              <Button
                variant="outline"
                size="default"
                disabled={loading}
                onPress={onClose}
                className="h-11 rounded-xl border-border"
                textClassName="font-semibold text-sm text-muted-foreground"
              >
                {t('cancel', 'Cancel')}
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default VerifyEmailOtpModal;
