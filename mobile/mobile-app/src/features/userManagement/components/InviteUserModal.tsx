import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Clipboard,
} from 'react-native';
import { X, Mail, CheckCircle2, Copy, Check, Send, AlertTriangle } from 'lucide-react-native';
import { TextInput } from '@/components/forms/TextInput';
import { DropdownSelect } from '@/components/forms/DropdownSelect';
import { Button } from '@/components/common/Button';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import apiClient from '../../../services/apiClient';
import { InviteUserData } from '../services/userService';
import { useTranslation } from '@/src/utils/i18n';
import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  validateEmail,
  validateRequired,
  parseBackendError,
  ValidationStatus,
} from '@/src/utils/validation';
import { AppLoader } from '@/components/ui/AppLoader';

interface InviteUserModalProps {
  visible: boolean;
  onClose: () => void;
  onSendInvite: (inviteData: InviteUserData) => Promise<any>;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  visible,
  onClose,
  onSendInvite,
}) => {
  const { t } = useTranslation();
  // Form values
  const [email, setEmail] = useState('');
  const [selectedRoleName, setSelectedRoleName] = useState('');
  const [selectedVillaId, setSelectedVillaId] = useState('');

  // Dropdown data
  const [roles, setRoles] = useState<any[]>([]);
  const [villas, setVillas] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingVillas, setLoadingVillas] = useState(false);

  // Email Validation & Checking State
  const [emailStatus, setEmailStatus] = useState<ValidationStatus>('idle');
  const [emailMessage, setEmailMessage] = useState<string | undefined>(undefined);
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  // Field errors
  const [roleError, setRoleError] = useState<string | undefined>(undefined);
  const [villaError, setVillaError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Submission & Post-submit success state
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessResults] = useState<{
    email: string;
    roleName: string;
    inviteLink?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Debounce ref for async email availability check
  const emailCheckTimerRef = useRef<any>(null);
  const emailSeqRef = useRef<number>(0);

  // Load roles & villas on open
  useEffect(() => {
    if (visible) {
      resetForm();
      setLoadingRoles(true);
      apiClient
        .get('/roles?limit=100')
        .then((res: any) => {
          const fetched = res.data?.data || res.data || [];
          setRoles(Array.isArray(fetched) ? fetched : []);
        })
        .catch((err) => console.error('Failed to fetch roles:', err))
        .finally(() => setLoadingRoles(false));

      setLoadingVillas(true);
      apiClient
        .get('/villas?limit=1000')
        .then((res: any) => {
          const fetched = res.data?.data || res.data || [];
          setVillas(Array.isArray(fetched) ? fetched : []);
        })
        .catch((err) => console.error('Failed to fetch villas:', err))
        .finally(() => setLoadingVillas(false));
    }
  }, [visible]);

  const resetForm = () => {
    setEmail('');
    setSelectedRoleName('');
    setSelectedVillaId('');
    setEmailStatus('idle');
    setEmailMessage(undefined);
    setIsEmailChecking(false);
    setEmailTouched(false);
    setRoleError(undefined);
    setVillaError(undefined);
    setSubmitError(null);
    setSuccessResults(null);
    setCopiedLink(false);
    if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current);
  };

  const selectedRoleObj = roles.find((r) => r.name === selectedRoleName);
  const isTenantRole = selectedRoleObj ? !!selectedRoleObj.isTenantRole : false;

  // Real-time email validation and debounced backend verification
  const handleEmailChange = (text: string) => {
    const trimmed = text.trim();
    setEmail(trimmed);
    setSubmitError(null);

    if (emailCheckTimerRef.current) {
      clearTimeout(emailCheckTimerRef.current);
    }

    const currentSeq = ++emailSeqRef.current;

    if (!trimmed) {
      setEmailStatus('idle');
      setEmailMessage(undefined);
      setIsEmailChecking(false);
      return;
    }

    // Step 1: Format validation
    const formatRes = validateEmail(trimmed);

    if (!formatRes.isValid) {
      setEmailStatus(formatRes.status);
      setEmailMessage(formatRes.message);
      setIsEmailChecking(false);
      return;
    }

    // Step 2: Format is strictly valid; now perform debounced async verification
    setIsEmailChecking(true);
    setEmailStatus('validating');
    setEmailMessage('Checking email availability...');

    emailCheckTimerRef.current = setTimeout(async () => {
      try {
        // Query backend to check if user already exists in current organization
        const orgUsersRes: any = await apiClient
          .get(`/users?search=${encodeURIComponent(trimmed)}&limit=5`)
          .catch(() => null);

        if (currentSeq !== emailSeqRef.current) return;

        const usersList = orgUsersRes?.data?.data || orgUsersRes?.data || [];
        const existingInOrg = Array.isArray(usersList)
          ? usersList.find((u: any) => u.email?.toLowerCase() === trimmed.toLowerCase())
          : null;

        if (existingInOrg) {
          if (existingInOrg.status === 'Active') {
            setEmailStatus('invalid');
            setEmailMessage('This user is already an active member of this community.');
            setIsEmailChecking(false);
            return;
          }
          if (existingInOrg.status === 'Pending' || existingInOrg.status === 'Pending Verification') {
            setEmailStatus('valid');
            setEmailMessage('User has a pending invite. Submitting will refresh and resend.');
            setIsEmailChecking(false);
            return;
          }
          if (existingInOrg.status === 'Rejected') {
            setEmailStatus('valid');
            setEmailMessage('User previously declined. Submitting will send a fresh invitation.');
            setIsEmailChecking(false);
            return;
          }
        }

        // Check global account status
        const accountStatusRes: any = await apiClient
          .get(`/auth/check-account-status?email=${encodeURIComponent(trimmed)}`)
          .catch(() => null);

        if (currentSeq !== emailSeqRef.current) return;

        const accountData = accountStatusRes?.data?.data || accountStatusRes?.data;
        if (accountData?.exists) {
          setEmailStatus('valid');
          setEmailMessage('Existing user found. Sending invitation will add them to this community.');
        } else {
          setEmailStatus('valid');
          setEmailMessage('Email is available.');
        }
      } catch (err) {
        if (currentSeq !== emailSeqRef.current) return;
        setEmailStatus('valid');
        setEmailMessage('Email format is valid.');
      } finally {
        if (currentSeq === emailSeqRef.current) {
          setIsEmailChecking(false);
        }
      }
    }, 450);
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    if (!email.trim()) {
      setEmailStatus('invalid');
      setEmailMessage('Email address is required.');
    } else {
      const formatRes = validateEmail(email);
      if (!formatRes.isValid) {
        setEmailStatus(formatRes.status);
        setEmailMessage(formatRes.message);
      }
    }
  };

  const handleRoleChange = (val: string) => {
    setSelectedRoleName(val);
    setRoleError(undefined);
  };

  const handleVillaChange = (val: string) => {
    setSelectedVillaId(val);
    setVillaError(undefined);
  };

  const handleSubmit = async () => {
    setEmailTouched(true);
    setSubmitError(null);

    // Validate email
    const emailRes = validateEmail(email);
    if (!emailRes.isValid) {
      setEmailStatus(emailRes.status);
      setEmailMessage(emailRes.message);
      return;
    }

    // Validate role
    if (!selectedRoleName) {
      setRoleError('Please select a user role.');
      return;
    }

    // Validate villa if tenant role
    if (isTenantRole && !selectedVillaId) {
      setVillaError('Please select a villa or unit for this tenant role.');
      return;
    }

    setSubmitting(true);

    try {
      let residentType = 'None';
      if (isTenantRole && selectedRoleName) {
        const lower = selectedRoleName.toLowerCase();
        if (lower.includes('owner')) residentType = 'Owner';
        else if (lower.includes('tenant')) residentType = 'Tenant';
        else if (lower.includes('family')) residentType = 'Family';
        else residentType = 'Guest';
      }

      const res = await onSendInvite({
        email: email.trim(),
        villaId: isTenantRole ? selectedVillaId || null : null,
        residentType,
        roleName: selectedRoleName || null,
      });

      // Show persistent success confirmation inside modal
      setSuccessResults({
        email: email.trim(),
        roleName: selectedRoleName,
        inviteLink: res?.inviteLink || res?.data?.inviteLink,
      });
    } catch (err: any) {
      const parsed = parseBackendError(err, 'Failed to send invitation. Please try again.');
      if (parsed.isDuplicate || parsed.field === 'email') {
        setEmailStatus('invalid');
        setEmailMessage(parsed.userMessage);
      } else {
        setSubmitError(parsed.userMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (successData?.inviteLink) {
      Clipboard.setString(successData.inviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const roleOptions = roles.map((r) => ({
    label: `${r.name} ${r.isTenantRole ? '(Unit/Tenant)' : '(Global)'}`,
    value: r.name,
  }));

  const villaOptions = villas.map((v) => ({
    label: `Unit ${v.unitNumber || v.villaNumber} ${
      v.blockOrBuilding ? `(${v.blockOrBuilding})` : ''
    }`,
    value: v._id || v.id,
  }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('invite_user', 'Invite Community User')}
    >
              {/* SUCCESS VIEW */}
              {successData ? (
                <View className="gap-4 py-2">
                  <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 items-center justify-center">
                    <View className="w-12 h-12 rounded-full bg-emerald-500/20 items-center justify-center mb-2">
                      <CheckCircle2 size={28} className="text-emerald-600 dark:text-emerald-400" />
                    </View>
                    <Text className="text-base font-bold text-foreground text-center">
                      {t('invitation_sent_success', 'Invitation Sent Successfully!')}
                    </Text>
                    <Text className="text-xs text-muted-foreground text-center mt-1">
                      {t('invitation_dispatched_to', 'An invitation was dispatched to')}{' '}
                      <Text className="font-semibold text-foreground">{successData.email}</Text> {t('for_role', 'for the role')}{' '}
                      <Text className="font-semibold text-foreground">{successData.roleName}</Text>.
                    </Text>

                    {Boolean(successData.inviteLink) && (
                      <View className="w-full mt-3.5 pt-3 border-t border-emerald-500/20">
                        <Text className="text-[11px] font-bold text-muted-foreground mb-1.5 text-start">
                          {t('invitation_link', 'Invitation Link:')}
                        </Text>
                        <View className="flex-row items-center bg-background border border-border rounded-xl px-3 py-2">
                          <Text
                            numberOfLines={1}
                            ellipsizeMode="middle"
                            className="flex-1 text-xs text-foreground font-mono"
                          >
                            {successData.inviteLink}
                          </Text>
                          <TouchableOpacity
                            onPress={handleCopyLink}
                            className="ms-2 px-2.5 py-1 rounded-lg bg-primary/10 flex-row items-center gap-1"
                            accessibilityRole="button"
                            accessibilityLabel="Copy invitation link"
                          >
                            {copiedLink ? (
                              <>
                                <Check size={12} className="text-primary" />
                                <Text className="text-[10px] font-bold text-primary">{t('copied', 'Copied')}</Text>
                              </>
                            ) : (
                              <>
                                <Copy size={12} className="text-primary" />
                                <Text className="text-[10px] font-bold text-primary">{t('copy_link', 'Copy')}</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Actions after success */}
                  <View className="flex-row items-center gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 bg-white border-neutral-300"
                      textClassName="text-black font-bold"
                      onPress={resetForm}
                    >
                      {t('invite_another', 'Invite Another')}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onPress={onClose}
                    >
                      {t('done', 'Done')}
                    </Button>
                  </View>
                </View>
              ) : (
                /* INVITATION FORM VIEW */
                <View className="gap-4">
                  {/* General Submit Error Banner */}
                  {submitError ? (
                    <View className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex-row items-center gap-2">
                      <AlertTriangle size={16} className="text-destructive shrink-0" />
                      <Text className="text-xs text-destructive font-semibold flex-1 text-start">
                        {submitError}
                      </Text>
                    </View>
                  ) : null}

                  {/* Email Field with Real-time & Async Validation */}
                  <View>
                    <TextInput
                      label={t('email_address', 'Email Address')}
                      required
                      placeholder="resident@community.com"
                      value={email}
                      onChangeText={handleEmailChange}
                      onBlur={handleEmailBlur}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      status={emailStatus}
                      isValidating={isEmailChecking}
                      isValid={emailStatus === 'valid' && !isEmailChecking}
                      clearable
                      leftIcon={Mail}
                      error={emailStatus === 'invalid' ? emailMessage : undefined}
                      helperText={
                        emailStatus === 'incomplete'
                          ? emailMessage
                          : emailStatus === 'valid'
                          ? emailMessage
                          : undefined
                      }
                      successMessage={emailStatus === 'valid' ? emailMessage : undefined}
                    />
                  </View>

                  {/* Role Select */}
                  <View>
                    {loadingRoles ? (
                      <View className="py-3 items-center justify-center">
                        <AppLoader variant="inline" />
                        <Text className="text-xs text-muted-foreground mt-1">{t('loading', 'Loading roles...')}</Text>
                      </View>
                    ) : (
                      <DropdownSelect
                        label={t('select_role', 'Select Role')}
                        required
                        options={roleOptions}
                        value={selectedRoleName}
                        onValueChange={handleRoleChange}
                        placeholder={t('select_user_role_placeholder', '-- Select User Role --')}
                        error={roleError}
                      />
                    )}
                  </View>

                  {/* Villa Select for Unit Roles */}
                  {isTenantRole && (
                    <View>
                      {loadingVillas ? (
                        <View className="py-3 items-center justify-center">
                          <AppLoader variant="inline" />
                          <Text className="text-xs text-muted-foreground mt-1">
                            {t('loading', 'Loading villas...')}
                          </Text>
                        </View>
                      ) : (
                        <DropdownSelect
                          label={t('unit_number', 'Select Villa / Unit')}
                          required
                          options={villaOptions}
                          value={selectedVillaId}
                          onValueChange={handleVillaChange}
                          placeholder={t('choose_villa_placeholder', '-- Choose Villa Unit --')}
                          error={villaError}
                          helperText={t('assign_villa_help', 'Assign resident to their designated villa unit')}
                        />
                      )}
                    </View>
                  )}

                  <Text className="text-xs text-muted-foreground text-start mt-1">
                    {t('invitation_hint', 'An invitation code and setup link will be generated for password setup.')}
                  </Text>

                  {/* Modal Footer */}
                  <View className="flex-row items-center justify-end gap-3 pt-3 border-t border-border mt-2">
                    <Button variant="outline" onPress={onClose} disabled={submitting}>
                      {t('cancel', 'Cancel')}
                    </Button>
                    <Button
                      variant="default"
                      onPress={handleSubmit}
                      loading={submitting}
                      disabled={submitting || isEmailChecking}
                      className="bg-white border-neutral-300"
                      textClassName="text-black font-bold"
                    >
                      {t('send_invitation', 'Send Invitation')}
                    </Button>
                  </View>
                </View>
              )}
    </BottomSheet>
  );
};

export default InviteUserModal;
