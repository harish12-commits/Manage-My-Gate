import React, { useState } from 'react';
import { View, TouchableOpacity, Share, ActivityIndicator, Linking, Alert, Platform, Clipboard } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { StatusBadge, StatusVariant } from '@/components/ui/StatusBadge';
import { DetailRow } from '@/components/ui/DetailRow';
import { VisitorPass } from '../store/visitorPassSlice';
import { VisitorQRCode } from './shared/VisitorQRCode';
import { QrCode, ShieldAlert, Copy, Check, Share2, MessageCircle, Barcode, Image as ImageIcon } from 'lucide-react-native';

import { PASS_TYPE_META, encodeAppBarcode, buildVisitorPassShareMessage } from '@/src/utils/appBarcodeProtocol';
import { shareQrImage } from '@/src/utils/qrPngGenerator';
import { useVisitorPass } from '../hooks/useVisitorPass';

export interface VisitorPassDetailsModalProps {
  visible: boolean;
  pass: VisitorPass | null;
  onClose: () => void;
  onRevokePress?: (pass: VisitorPass) => void;
  /** Recorded with the revocation, e.g. when an admin revokes a resident's pass. */
  revokeReason?: string;
}

const mapPassStatusVariant = (status: string): StatusVariant => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'REVOKED':
      return 'danger';
    case 'EXPIRED':
      return 'neutral';
    default:
      return 'neutral';
  }
};

export const VisitorPassDetailsModal: React.FC<VisitorPassDetailsModalProps> = ({
  visible,
  pass,
  onClose,
  onRevokePress,
  revokeReason,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [sharingImage, setSharingImage] = useState(false);

  const { revokePass } = useVisitorPass();

  if (!pass) return null;

  const rawId = (pass as any).shortKey || pass.code || pass._id || (pass as any).id || '';
  const rawCode = (pass as any).shortKey || pass.code || (typeof rawId === 'string' && rawId.length >= 6 ? rawId.slice(-6) : rawId);
  const passCode = String(rawCode).replace(/^PASS-?/i, '').toUpperCase() || '849201';
  const rawType = ((pass as any).passType || (pass as any).type || 'GUEST').toUpperCase();
  const passTypeMeta = PASS_TYPE_META[rawType] || PASS_TYPE_META.GUEST;
  const visitorDetails = (pass as any).visitorDetails || (pass as any).rawPass?.visitorDetails || {};
  const visitorName = pass.visitorName || visitorDetails.name || 'Guest';
  const phone = pass.phone || visitorDetails.phone || '';

  // Generate official Manage-My-Gate Barcode image URL
  const passIdVal = pass._id || (pass as any).id || '';
  const barcodePayload = encodeAppBarcode(rawType, passCode, passIdVal, visitorName);
  const barcodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=12&data=${encodeURIComponent(barcodePayload)}`;

  const destination =
    (pass as any).destinationUnit ||
    (pass as any).villaNumber ||
    (pass as any).villaName ||
    (pass as any).unit ||
    (pass as any).villaId?.number ||
    (pass as any).villaId?.name;

  const vehicleNo =
    (pass as any).vehicleNo ||
    (pass as any).vehicleNumber ||
    (pass as any).vehicleDetails?.number;

  const provider = (pass as any).provider || (pass as any).cabProvider;
  const guestCount = (pass as any).guestCount || (pass as any).guestList?.length;
  const notes = pass.purpose || (pass as any).serviceNotes || (pass as any).deliveryInstructions;

  const handleConfirmRevoke = async () => {
    if (revoking) return;
    setRevoking(true);
    const targetId = pass._id || (pass as any).id || pass.code || '';
    setRevokeError(null);
    try {
      const result: any = await revokePass(targetId, revokeReason);
      // The thunk resolves with a rejected action instead of throwing; keep the sheet open and say why.
      if (result?.meta?.requestStatus === 'rejected') {
        setRevokeError(String(result.payload || 'Could not revoke this pass. Please try again.'));
        return;
      }
      setRevokeConfirm(false);
      onRevokePress?.(pass);
      onClose();
    } finally {
      setRevoking(false);
    }
  };

  const handleCopyCode = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildShareText = () => {
    return buildVisitorPassShareMessage({
      passCode,
      visitorName,
      passTypeLabel: passTypeMeta.label,
      validUntil: pass.validUntil,
      destination,
      barcodePayload,
    });
  };

  const handleShareBarcodeToWhatsApp = async () => {
    if (!passCode || sharingImage) return;
    setSharingImage(true);
    try {
      const shared = await shareQrImage(
        barcodePayload,
        passCode,
        `Nahom Pass - ${passCode}`
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

  const handleSendWhatsAppMessage = async () => {
    if (!passCode) return;
    const text = buildShareText();
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';

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
          title: `Nahom Visitor Pass (${passCode})`,
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
    if (!passCode) return;
    const text = buildShareText();

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `Nahom Visitor Pass (${passCode})`,
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
        title: `Nahom Visitor Pass (${passCode})`,
        message: text,
      });
    } catch (err) {
      console.log('Error sharing pass', err);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Visitor Pass Details">
      <View className="gap-4 p-2 pb-6">
        {/* Pass Code Badge */}
        <View className="bg-primary/10 border border-primary/20 rounded-2xl p-4 items-center justify-center gap-2">
          <Text variant="muted" className="text-xs uppercase font-bold text-muted-foreground">
            {passTypeMeta.label} Keycode
          </Text>
          <Text className="text-3xl font-extrabold text-primary tracking-widest font-mono">
            {passCode}
          </Text>
        </View>

        {/* Action Controls */}
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
            code={passCode}
            passId={pass._id || (pass as any).id}
            visitorName={visitorName}
            type={rawType}
            validityText={`Valid for ${visitorName}`}
          />
        )}

        {/* Status Pill */}
        <View className="flex-row items-center justify-between bg-card border border-border rounded-xl p-3">
          <Text variant="small" className="font-semibold text-foreground">
            Pass Status
          </Text>
          <StatusBadge label={pass.status} variant={mapPassStatusVariant(pass.status)} dot />
        </View>

        {/* Detailed Attribute Rows */}
        <View className="bg-card border border-border rounded-xl p-3 gap-2">
          <DetailRow label="Invitation Type" value={passTypeMeta.label} />
          <DetailRow label="Visitor Name" value={visitorName} />
          <DetailRow label="Phone Number" value={phone || 'Not provided'} />
          {destination ? <DetailRow label="Destination Unit" value={destination} /> : null}
          {vehicleNo ? <DetailRow label="Vehicle Plate No" value={vehicleNo} /> : null}
          {provider ? <DetailRow label="Service / Provider" value={provider} /> : null}
          {guestCount ? <DetailRow label="Total Guests" value={`${guestCount} Guests`} /> : null}
          {notes ? <DetailRow label="Purpose / Instructions" value={notes} /> : null}
          {pass.validFrom ? (
            <DetailRow
              label="Valid From"
              value={new Date(pass.validFrom).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            />
          ) : null}
          {pass.validUntil ? (
            <DetailRow
              label="Valid Until"
              value={new Date(pass.validUntil).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            />
          ) : null}
        </View>

        {/* Action Button: Revoke Pass & Inline Confirmation */}
        {pass.status === 'ACTIVE' || pass.status === 'PENDING' ? (
          revokeConfirm ? (
            <View className="mt-2 p-4 bg-destructive/10 border border-destructive/30 rounded-2xl gap-3">
              <View className="flex-row items-center gap-2">
                <ShieldAlert size={20} className="text-destructive" />
                <Text className="text-sm font-bold text-destructive">Revoke Visitor Pass?</Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                This will immediately invalidate the entry pass for {visitorName || 'this visitor'}.
              </Text>
              {revokeError ? (
                <Text className="text-xs font-semibold text-destructive" accessibilityRole="alert">
                  {revokeError}
                </Text>
              ) : null}
              <View className="flex-row gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setRevokeConfirm(false);
                    setRevokeError(null);
                  }}
                  className="flex-1 h-11 rounded-xl"
                  disabled={revoking}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onPress={handleConfirmRevoke}
                  disabled={revoking}
                  className="flex-1 h-11 rounded-xl flex-row items-center justify-center"
                >
                  {revoking ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-sm font-bold text-destructive-foreground" numberOfLines={1}>Confirm Revoke</Text>
                  )}
                </Button>
              </View>
            </View>
          ) : (
            <Button
              variant="destructive"
              onPress={() => setRevokeConfirm(true)}
              className="mt-2 h-12 rounded-xl flex-row items-center justify-center gap-2"
            >
              <ShieldAlert size={18} className="text-destructive-foreground" />
              <Text className="font-bold text-destructive-foreground text-sm">Revoke Visitor Pass</Text>
            </Button>
          )
        ) : null}
      </View>
    </BottomSheet>
  );
};

export default VisitorPassDetailsModal;
