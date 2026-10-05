import React, { useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailRow } from '@/components/ui/DetailRow';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react-native';
import { NotificationItemData } from '../services/notificationService';
import authService from '../../auth/services/authService';
import { useTranslation } from '@/src/utils/i18n';
import { AppLoader } from '@/components/ui/AppLoader';

export interface InvitationDetailModalProps {
  visible: boolean;
  onClose: () => void;
  notification: NotificationItemData | null;
  onAccept: (token: string, orgId?: string, orgName?: string) => Promise<void>;
  onReject: (token: string, orgName?: string) => Promise<void>;
}

export const extractInvitationToken = (notification?: NotificationItemData | null): string => {
  if (!notification) return '';
  if (notification.metadata?.token) return String(notification.metadata.token);
  if (notification.metadata?.invitationToken) return String(notification.metadata.invitationToken);
  const url = notification.actionUrl || '';
  const match = url.match(/[\/?&](?:token|code)=([^&#]+)|\/invite\/(?:app\/|web\/)?([a-f0-9]{32,64}|[^/?&#]+)/i);
  if (match) return match[1] || match[2] || '';
  return '';
};

export const InvitationDetailModal: React.FC<InvitationDetailModalProps> = ({
  visible,
  onClose,
  notification,
  onAccept,
  onReject,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [inviteDetails, setInviteDetails] = useState<{
    orgName?: string;
    roleName?: string;
    unitNumber?: string;
    inviterName?: string;
    membershipStatus?: string;
    invitationStatus?: string;
    orgId?: string;
    expiresAt?: string;
    isExisting?: boolean;
    isAlreadyMember?: boolean;
  } | null>(null);

  const token = extractInvitationToken(notification);

  // Initialize or fetch details on modal appearance
  useEffect(() => {
    if (!visible || !notification) {
      setInviteDetails(null);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;

    // Prepopulate with notification metadata or parsed title/body if available
    const meta = notification.metadata || {};
    let parsedOrgName = meta.communityName || meta.orgName || '';
    let parsedRoleName = meta.roleName || meta.role || '';
    let parsedUnit = meta.villaLabel || meta.unitNumber || meta.unit || '';

    if (!parsedOrgName && notification.title) {
      const match = notification.title.match(/Invitation to (.+)/i);
      if (match) parsedOrgName = match[1].trim();
    }

    if (!parsedRoleName && notification.body) {
      const match = notification.body.match(/\(([^)]+)\)/);
      if (match) {
        const parts = match[1].split('•').map((s) => s.trim());
        if (parts.length === 2) {
          parsedUnit = parts[0];
          parsedRoleName = parts[1];
        } else if (parts.length === 1) {
          parsedRoleName = parts[0];
        }
      }
    }

    setInviteDetails({
      orgName: parsedOrgName || 'Community Workspace',
      roleName: parsedRoleName || 'Member',
      unitNumber: parsedUnit || '',
      orgId: meta.orgId || '',
      membershipStatus: 'Pending',
      invitationStatus: 'PENDING',
    });

    // If we have a token, fetch live validation from backend
    if (token) {
      setLoading(true);
      authService
        .validateInvite(token)
        .then((res: any) => {
          if (!isMounted) return;
          const data = res?.data?.data || res?.data || res;
          if (data && data.valid) {
            setInviteDetails({
              orgName: data.orgName || parsedOrgName || 'Community Workspace',
              roleName: data.role || data.roleName || parsedRoleName || 'Member',
              unitNumber: data.unit || data.villa || parsedUnit || '',
              inviterName: data.inviterName || '',
              membershipStatus: data.membershipStatus || 'Pending',
              invitationStatus: data.invitationStatus || 'PENDING',
              orgId: data.orgId || meta.orgId || '',
              expiresAt: data.expiresAt || '',
              isExisting: !!data.isExisting,
              isAlreadyMember: data.membershipStatus === 'Active' || data.isAlreadyMemberInOrg,
            });
            setErrorMsg(null);
          }
        })
        .catch((err: any) => {
          if (!isMounted) return;
          const msg = err?.response?.data?.message || err?.message || '';
          if (msg.toLowerCase().includes('reject')) {
            setInviteDetails((prev) => ({
              ...prev,
              membershipStatus: 'Rejected',
              invitationStatus: 'REJECTED',
            }));
          } else if (
            msg.toLowerCase().includes('already') ||
            msg.toLowerCase().includes('accepted')
          ) {
            setInviteDetails((prev) => ({
              ...prev,
              membershipStatus: 'Active',
              invitationStatus: 'ACCEPTED',
              isAlreadyMember: true,
            }));
          } else if (msg) {
            setErrorMsg(msg);
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [visible, notification, token]);

  const handleAcceptPress = useCallback(async () => {
    if (!token) {
      setErrorMsg('Invitation token is missing or expired.');
      return;
    }
    setAccepting(true);
    setErrorMsg(null);
    try {
      await onAccept(token, inviteDetails?.orgId, inviteDetails?.orgName);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to accept invitation.';
      setErrorMsg(msg);
    } finally {
      setAccepting(false);
    }
  }, [token, inviteDetails, onAccept, onClose]);

  const handleRejectPress = useCallback(async () => {
    if (!token) {
      setErrorMsg('Invitation token is missing.');
      return;
    }
    setRejecting(true);
    setErrorMsg(null);
    try {
      await onReject(token, inviteDetails?.orgName);
      setInviteDetails((prev) => ({
        ...prev,
        membershipStatus: 'Rejected',
        invitationStatus: 'REJECTED',
      }));
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to reject invitation.';
      setErrorMsg(msg);
    } finally {
      setRejecting(false);
    }
  }, [token, inviteDetails, onReject, onClose]);

  const isRejected =
    inviteDetails?.membershipStatus === 'Rejected' ||
    inviteDetails?.invitationStatus === 'REJECTED';

  const isAccepted =
    inviteDetails?.membershipStatus === 'Active' ||
    inviteDetails?.invitationStatus === 'ACCEPTED' ||
    inviteDetails?.isAlreadyMember;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('community_invitation', 'Community Invitation')}
    >
      <View className="gap-4 pt-1">
        {/* Header Visual Banner */}
        <View className="items-center justify-center py-3 bg-secondary/50 rounded-2xl border border-border/60">
          <View
            className={`p-3.5 rounded-2xl mb-2 items-center justify-center ${
              isRejected
                ? 'bg-destructive/10'
                : isAccepted
                ? 'bg-emerald-500/10'
                : 'bg-primary/10'
            }`}
          >
            {isRejected ? (
              <XCircle size={32} className="text-destructive" />
            ) : isAccepted ? (
              <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Building2 size={32} className="text-primary" />
            )}
          </View>

          <Text className="text-lg font-black text-foreground text-center px-4" numberOfLines={2}>
            {inviteDetails?.orgName || t('community_workspace', 'Community Workspace')}
          </Text>

          <View className="flex-row items-center gap-2 mt-1.5">
            {isRejected ? (
              <StatusBadge variant="danger" label={t('declined', 'Declined')} dot={true} />
            ) : isAccepted ? (
              <StatusBadge variant="success" label={t('active_member', 'Active Member')} dot={true} />
            ) : (
              <StatusBadge variant="warning" label={t('pending_response', 'Pending Response')} dot={true} />
            )}
            {inviteDetails?.roleName ? (
              <StatusBadge variant="neutral" label={inviteDetails.roleName} />
            ) : null}
          </View>
        </View>

        {/* Loading Indicator */}
        {loading ? (
          <View className="py-6 items-center justify-center gap-2">
            <AppLoader variant="inline" />
            <Text className="text-xs text-muted-foreground">
              {t('verifying_invitation', 'Verifying invitation status...')}
            </Text>
          </View>
        ) : null}

        {/* Error Notice */}
        {errorMsg ? (
          <View className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex-row items-start gap-2.5">
            <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
            <Text className="text-xs text-destructive flex-1 leading-4">{errorMsg}</Text>
          </View>
        ) : null}

        {/* Details Table */}
        {!loading ? (
          <View className="bg-card border border-border/80 rounded-2xl px-4 py-1 shadow-xs">
            <DetailRow
              label={t('organization', 'Community')}
              value={inviteDetails?.orgName || '—'}
              iconName="Building2"
            />

            {inviteDetails?.roleName ? (
              <DetailRow
                label={t('assigned_role', 'Assigned Role')}
                value={inviteDetails.roleName}
                iconName="ShieldCheck"
              />
            ) : null}

            {inviteDetails?.unitNumber ? (
              <DetailRow
                label={t('unit_villa', 'Unit / Villa')}
                value={inviteDetails.unitNumber}
                iconName="Home"
              />
            ) : null}

            {inviteDetails?.inviterName ? (
              <DetailRow
                label={t('invited_by', 'Invited By')}
                value={inviteDetails.inviterName}
                iconName="User"
              />
            ) : null}

            {inviteDetails?.expiresAt ? (
              <DetailRow
                label={t('expires', 'Expires')}
                value={new Date(inviteDetails.expiresAt).toLocaleDateString([], {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                iconName="Clock"
                isLast={true}
              />
            ) : null}
          </View>
        ) : null}

        {/* Information Callout */}
        {!isRejected && !isAccepted ? (
          <View className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl">
            <Text className="text-xs text-foreground/80 leading-relaxed">
              {t(
                'invitation_accept_desc',
                'Accepting will grant you full access to this community. Your active session will switch to this workspace immediately.'
              )}
            </Text>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View className="gap-2.5 pt-2 pb-2">
          {!isRejected && !isAccepted ? (
            <>
              <Button
                variant="default"
                onPress={handleAcceptPress}
                loading={accepting}
                disabled={rejecting || loading}
                className="w-full h-12 shadow-sm"
              >
                <View className="flex-row items-center justify-center gap-2">
                  <ShieldCheck size={18} color="#FFFFFF" />
                  <Text className="text-white font-bold text-sm">
                    {t('accept_and_join', 'Accept & Switch Community')}
                  </Text>
                </View>
              </Button>

              <Button
                variant="outline"
                onPress={handleRejectPress}
                loading={rejecting}
                disabled={accepting || loading}
                className="w-full h-11 border-destructive/40"
              >
                <View className="flex-row items-center justify-center gap-1.5">
                  <XCircle size={16} className="text-destructive" />
                  <Text className="text-destructive font-semibold text-sm">
                    {t('reject_invitation', 'Reject Invitation')}
                  </Text>
                </View>
              </Button>
            </>
          ) : isAccepted ? (
            <Button
              variant="default"
              onPress={handleAcceptPress}
              loading={accepting}
              className="w-full h-12"
            >
              <View className="flex-row items-center justify-center gap-2">
                <ArrowRight size={18} color="#FFFFFF" />
                <Text className="text-white font-bold text-sm">
                  {t('switch_to_community', 'Switch to this Community')}
                </Text>
              </View>
            </Button>
          ) : (
            <Button variant="outline" onPress={onClose} className="w-full h-11">
              <Text className="text-foreground font-semibold text-sm">
                {t('close', 'Close')}
              </Text>
            </Button>
          )}
        </View>
      </View>
    </BottomSheet>
  );
};

export default InvitationDetailModal;
