import React, { useState } from 'react';
import { View, ScrollView, ActivityIndicator, Share, Linking, Platform, Clipboard, Alert } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { DetailSection } from '@/components/ui/DetailSection';
import { DetailRow } from '@/components/ui/DetailRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { VisitorPassCode } from '../shared/VisitorPassCode';
import { VisitorQRCode } from '../shared/VisitorQRCode';
import { ExtendedVisitorPass } from '../../mocks/visitorMocks';
import { useVisitorPass } from '../../hooks/useVisitorPass';
import { useTranslation } from '@/src/utils/i18n';
import { X, ShieldAlert, Share2, QrCode, MessageCircle, Copy, Check } from 'lucide-react-native';
import { encodeAppBarcode, buildVisitorPassShareMessage } from '@/src/utils/appBarcodeProtocol';
import { shareQrImage } from '@/src/utils/qrPngGenerator';

export interface VisitorLogDetailsModalProps {
  visible: boolean;
  pass: ExtendedVisitorPass | null;
  onClose: () => void;
  onRevokeSuccess?: () => void;
}

export const VisitorLogDetailsModal: React.FC<VisitorLogDetailsModalProps> = ({
  visible,
  pass,
  onClose,
  onRevokeSuccess,
}) => {
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [submittingRevoke, setSubmittingRevoke] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const { revokePass, actionStatus } = useVisitorPass();

  if (!pass) return null;

  const rawPass = pass.rawPass || {};
  const passType = pass.passType || 'GUEST';
  const shortKey =
    pass.code ||
    rawPass.shortKey ||
    rawPass.code ||
    (typeof pass._id === 'string' && pass._id.length >= 6 ? pass._id.slice(-6).toUpperCase() : '849201');

  const canRevoke = pass.status === 'PENDING' || pass.status === 'ACTIVE';

  const statusVariant =
    pass.status === 'ACTIVE'
      ? 'success'
      : pass.status === 'PENDING'
      ? 'warning'
      : pass.status === 'REVOKED'
      ? 'danger'
      : 'neutral';

  const usageText = rawPass.usageLimit
    ? `${rawPass.usageLimit.currentUses || 0} / ${rawPass.usageLimit.maxUses || 1} Uses`
    : null;

  const handleCopyCode = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareBarcodeToWhatsApp = async () => {
    if (!shortKey || sharingImage) return;
    setSharingImage(true);
    try {
      const targetCode = String(shortKey);
      const barcodePayload = encodeAppBarcode(passType, targetCode, pass._id || rawPass._id, pass.visitorName || 'Guest');
      const shared = await shareQrImage(
        barcodePayload,
        targetCode,
        `Nahom Pass - ${targetCode}`
      );
      if (!shared) {
        await handleSendWhatsAppMessage();
      }
    } catch (e) {
      console.log('Error sharing barcode image:', e);
      await handleSendWhatsAppMessage();
    } finally {
      setSharingImage(false);
    }
  };

  const buildPassText = () => {
    const targetCode = String(shortKey);
    const barcodePayload = encodeAppBarcode(passType, targetCode, pass._id || rawPass._id, pass.visitorName || 'Guest');
    const destination = (pass as any).unit || (pass as any).villaNumber || (pass as any).destinationUnit;

    return buildVisitorPassShareMessage({
      passCode: targetCode,
      visitorName: pass.visitorName || 'Guest',
      passTypeLabel: passType,
      validUntil: pass.validUntil,
      destination,
      barcodePayload,
    });
  };

  const handleSendWhatsAppMessage = async () => {
    if (!shortKey) return;
    const text = buildPassText();
    const cleanPhone = pass.phone ? pass.phone.replace(/[^0-9]/g, '') : '';

    const nativeWhatsappUrl = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `whatsapp://send?text=${encodeURIComponent(text)}`;

    if (Platform.OS !== 'web') {
      // 1. Try launching native WhatsApp app directly
      try {
        await Linking.openURL(nativeWhatsappUrl);
        return;
      } catch (err) {
        console.log('Could not open WhatsApp directly:', err);
      }

      // 2. WhatsApp not installed: fallback to native OS share sheet (never open broken wa.me in browser!)
      try {
        await Share.share({
          title: `Nahom Visitor Pass (${shortKey})`,
          message: text,
        });
        return;
      } catch (shareErr) {
        console.log('Error opening native share sheet:', shareErr);
      }
    }

    // 3. Web browser environment
    const webWhatsAppUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    try {
      if (typeof window !== 'undefined') {
        window.open(webWhatsAppUrl, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(webWhatsAppUrl);
      }
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else if (Clipboard && typeof Clipboard.setString === 'function') {
        Clipboard.setString(text);
      }
      Alert.alert('Pass Copied', 'Visitor pass details copied to clipboard.');
    }
  };

  const handleSharePassText = async () => {
    if (!shortKey) return;
    const text = buildPassText();

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `Nahom Visitor Pass (${shortKey})`,
            text,
          });
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') return;
        }
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else if (Clipboard && typeof Clipboard.setString === 'function') {
        Clipboard.setString(text);
      }
      Alert.alert('Pass Copied', 'Visitor pass details copied to clipboard!');
      return;
    }

    try {
      await Share.share({
        title: `Nahom Visitor Pass (${shortKey})`,
        message: text,
      });
    } catch (err) {
      console.log('Error sharing pass', err);
    }
  };

  const handleConfirmRevoke = async () => {
    if (submittingRevoke || actionStatus === 'loading') return;
    setSubmittingRevoke(true);
    setRevokeError(null);

    const targetId = pass._id || (pass as any).id || rawPass._id;
    try {
      await revokePass(targetId);
      setRevokeConfirmOpen(false);
      onRevokeSuccess?.();
      onClose();
    } catch (err: any) {
      setRevokeError(err.message || 'Failed to revoke visitor pass');
    } finally {
      setSubmittingRevoke(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('visitor_pass_details', 'Visitor Pass Details')}>
      <View className="gap-4 pb-6">
            {/* Status Header */}
            <View className="flex-row items-center justify-between bg-card border border-border p-3.5 rounded-2xl">
              <View className="gap-1">
                <StatusBadge label={pass.status} variant={statusVariant} dot />
                <View className="mt-0.5">
                  <StatusBadge label={passType} variant="info" />
                </View>
              </View>
              {shortKey ? <VisitorPassCode code={shortKey} /> : null}
            </View>

            {/* Share Pass & QR Code Action Controls */}
            <View className="gap-2.5">
              {/* Primary Action: Send Barcode & Pass Code to WhatsApp */}
              <Button
                onPress={handleShareBarcodeToWhatsApp}
                disabled={sharingImage}
                className="w-full h-12 rounded-xl bg-[#25D366] active:bg-[#1EBE5D] flex-row items-center justify-center gap-2.5 shadow-sm"
                accessibilityLabel="Share Visitor Pass Barcode and Code on WhatsApp"
              >
                {sharingImage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MessageCircle size={19} color="#FFFFFF" strokeWidth={2.5} />
                    <Text className="font-bold text-white text-sm">
                      Share Barcode & Pass to WhatsApp
                    </Text>
                  </>
                )}
              </Button>

              {/* Secondary Action Row: Copy Code, Share Pass, Toggle QR */}
              <View className="flex-row gap-2">
                <Button
                  variant="outline"
                  onPress={handleCopyCode}
                  className="flex-1 h-10 rounded-xl border-border bg-card active:bg-muted flex-row items-center justify-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check size={15} className="text-emerald-600" />
                      <Text className="font-bold text-emerald-600 text-xs">Copied</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={15} className="text-foreground" />
                      <Text className="font-bold text-foreground text-xs">Copy Code</Text>
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onPress={handleSharePassText}
                  className="flex-1 h-10 rounded-xl border-blue-500/30 bg-blue-500/10 active:bg-blue-500/20 flex-row items-center justify-center gap-1.5"
                  accessibilityLabel="Share Visitor Pass"
                >
                  <Share2 size={15} className="text-blue-600 dark:text-blue-400" />
                  <Text className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                    Share Pass
                  </Text>
                </Button>

                <Button
                  variant="outline"
                  onPress={() => setShowQR(!showQR)}
                  className="h-10 px-3.5 rounded-xl border-border bg-card active:bg-muted flex-row items-center justify-center gap-1.5"
                >
                  <QrCode size={15} className="text-foreground" />
                  <Text className="font-bold text-foreground text-xs">
                    {showQR ? 'Hide' : 'QR View'}
                  </Text>
                </Button>
              </View>
            </View>

            {/* QR Code Presentation */}
            {showQR && (
              <VisitorQRCode
                code={shortKey || '849201'}
                validityText={`Valid for ${pass.visitorName || 'Guest'}`}
              />
            )}

            {/* Error Banner */}
            {revokeError && (
              <View className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex-row items-center gap-2">
                <ShieldAlert size={16} className="text-destructive" />
                <Text className="text-xs text-destructive flex-1 font-medium">{revokeError}</Text>
              </View>
            )}

            {/* Primary Visitor Info */}
            <DetailSection title={t('visitor_details', 'Visitor Details')} iconName="User">
              <DetailRow label={t('visitor_event', 'Visitor / Event')} value={pass.visitorName} iconName="User" />
              <DetailRow
                label={t('phone_number', 'Phone Number')}
                value={pass.phone || 'Not Provided'}
                iconName="Phone"
                copyable={Boolean(pass.phone)}
              />
              {pass.purpose ? (
                <DetailRow label={t('purpose_of_visit', 'Purpose of Visit')} value={pass.purpose} iconName="Tag" />
              ) : null}
              {rawPass.visitorDetails?.idProofType ? (
                <DetailRow
                  label="ID Proof Type"
                  value={rawPass.visitorDetails.idProofType}
                  iconName="ShieldCheck"
                />
              ) : null}
              {rawPass.visitorDetails?.idProofNumber ? (
                <DetailRow
                  label="ID Proof Number"
                  value={rawPass.visitorDetails.idProofNumber}
                  iconName="FileText"
                  copyable
                  isLast={!pass.vehicleNo && !pass.provider}
                />
              ) : null}
            </DetailSection>

            {/* Group Pass Guest Details (Only if named guests exist) */}
            {passType === 'GROUP' && Array.isArray(pass.guestList) && pass.guestList.length > 0 && (
              <DetailSection title="Group Guest List" iconName="Users">
                <DetailRow
                  label="Total Named Guests"
                  value={`${pass.guestList.length} Guests`}
                  iconName="Users"
                />
                <View className="p-3 bg-muted/30 rounded-xl gap-2 mt-1">
                  {pass.guestList.map((guest, idx) => (
                    <View
                      key={idx}
                      className="flex-row items-center justify-between py-1 border-b border-border/50 last:border-b-0"
                    >
                      <Text className="text-xs font-medium text-foreground">
                        {idx + 1}. {guest.name}
                      </Text>
                      {guest.phone ? (
                        <Text className="text-xs text-muted-foreground">{guest.phone}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </DetailSection>
            )}

            {/* Cab Pass Details */}
            {passType === 'CAB' && (
              <DetailSection title="Cab & Driver Details" iconName="Car">
                {pass.provider ? (
                  <DetailRow label="Cab Provider" value={pass.provider} iconName="Car" />
                ) : null}
                {pass.vehicleNo ? (
                  <DetailRow
                    label="Vehicle Plate No"
                    value={pass.vehicleNo}
                    iconName="FileText"
                    copyable
                  />
                ) : null}
                {rawPass.vehicleDetails?.vehicleType ? (
                  <DetailRow
                    label="Vehicle Type"
                    value={rawPass.vehicleDetails.vehicleType}
                    iconName="Car"
                    isLast
                  />
                ) : null}
              </DetailSection>
            )}

            {/* Delivery Pass Details */}
            {passType === 'DELIVERY' && (
              <DetailSection title="Delivery Details" iconName="Package">
                {pass.provider ? (
                  <DetailRow label="Delivery Partner" value={pass.provider} iconName="Package" />
                ) : null}
                {pass.orderId ? (
                  <DetailRow label="Order ID" value={pass.orderId} iconName="Tag" copyable />
                ) : null}
                {pass.packageCount ? (
                  <DetailRow
                    label="Package Count"
                    value={`${pass.packageCount} Package(s)`}
                    iconName="Box"
                  />
                ) : null}
                {pass.deliveryAction ? (
                  <DetailRow label="Delivery Action" value={pass.deliveryAction} iconName="Truck" />
                ) : null}
                {pass.deliveryInstructions ? (
                  <DetailRow
                    label="Instructions"
                    value={pass.deliveryInstructions}
                    iconName="FileText"
                    isLast
                  />
                ) : null}
              </DetailSection>
            )}

            {/* Service Pass Details */}
            {passType === 'SERVICE' && (
              <DetailSection title="Service & Schedule Details" iconName="Wrench">
                {pass.provider ? (
                  <DetailRow label="Service Category" value={pass.provider} iconName="Wrench" />
                ) : null}
                {pass.serviceNotes ? (
                  <DetailRow label="Service Notes" value={pass.serviceNotes} iconName="FileText" />
                ) : null}
                {Array.isArray(pass.allowedWeekdays) && pass.allowedWeekdays.length > 0 ? (
                  <DetailRow
                    label="Allowed Days"
                    value={pass.allowedWeekdays.join(', ')}
                    iconName="Calendar"
                  />
                ) : null}
                {pass.timeWindow ? (
                  <DetailRow
                    label="Daily Time Window"
                    value={`${pass.timeWindow.startTime} - ${pass.timeWindow.endTime}`}
                    iconName="Clock"
                    isLast
                  />
                ) : null}
              </DetailSection>
            )}

            {/* Validity & Usage Limits */}
            <DetailSection title="Pass Validity & Rules" iconName="Clock">
              <DetailRow
                label="Valid From"
                value={pass.validFrom ? new Date(pass.validFrom).toLocaleString() : 'Immediate'}
                iconName="Calendar"
              />
              <DetailRow
                label="Valid Until"
                value={pass.validUntil ? new Date(pass.validUntil).toLocaleString() : 'End of Day'}
                iconName="Calendar"
              />
              {usageText ? (
                <DetailRow label="Usage Counter" value={usageText} iconName="Repeat" isLast />
              ) : null}
            </DetailSection>

            {/* Revoke Action Button */}
            {/* Revoke Action Button & Inline Confirmation */}
            {canRevoke && (
              <View className="pt-2 border-t border-border mt-2">
                {revokeConfirmOpen ? (
                  <View className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl gap-3">
                    <View className="flex-row items-center gap-2">
                      <ShieldAlert size={20} className="text-destructive" />
                      <Text className="text-sm font-bold text-destructive">Revoke Visitor Pass?</Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      This will immediately invalidate the entry pass for {pass.visitorName || 'this visitor'}.
                    </Text>
                    <View className="flex-row gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => setRevokeConfirmOpen(false)}
                        className="flex-1"
                        disabled={submittingRevoke}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onPress={handleConfirmRevoke}
                        disabled={submittingRevoke || actionStatus === 'loading'}
                        className="flex-1 flex-row items-center justify-center gap-2"
                      >
                        {submittingRevoke ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          'Revoke Pass'
                        )}
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Button
                    variant="destructive"
                    disabled={submittingRevoke || actionStatus === 'loading'}
                    onPress={() => setRevokeConfirmOpen(true)}
                    className="h-12 rounded-xl flex-row items-center justify-center gap-2"
                  >
                    <X size={18} color="#fff" />
                    <Text className="font-bold text-destructive-foreground text-base">
                      Revoke Pass
                    </Text>
                  </Button>
                )}
              </View>
            )}
          </View>
      </BottomSheet>
  );
};

export default VisitorLogDetailsModal;
