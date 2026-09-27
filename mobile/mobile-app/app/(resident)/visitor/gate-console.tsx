import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Redirect } from 'expo-router';
import { TabBar } from '@/components/ui/TabBar';
import { KPIRow } from '@/components/ui/KPIRow';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { QRScannerOverlay } from '@/components/hardware/QRScannerOverlay';
import { ScanResultSheet, ScanResultData } from '@/components/hardware/ScanResultSheet';
import { VisitorPassDetailsModal } from '@/src/features/visitor/components/VisitorPassDetailsModal';
import { GuardInitiateWalkInModal } from '@/src/features/visitor/components/guard/GuardInitiateWalkInModal';
import { GuardQRScannerModal } from '@/src/features/visitor/components/guard/GuardQRScannerModal';
import { InsideVisitorsView } from '@/src/features/visitor/components/guard/InsideVisitorsView';
import { GuardWalkInStatusView } from '@/src/features/visitor/components/guard/GuardWalkInStatusView';
import { GuardVillaDirectoryView } from '@/src/features/visitor/components/guard/GuardVillaDirectoryView';
import { useVisitorPass } from '@/src/features/visitor/hooks/useVisitorPass';
import { selectActiveOrgId, selectAuthUser } from '@/src/features/auth/store/authSelectors';
import { useSelector } from 'react-redux';
import visitorService from '@/src/features/visitor/services/visitorService';
import {
  QrCode,
  ScanLine,
  Search,
  ShieldAlert,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Barcode,
  Zap,
  ZapOff,
  Maximize2,
  Minimize2,
  Camera,
} from 'lucide-react-native';
import { parseAndValidateAppBarcode } from '@/src/utils/appBarcodeProtocol';
import { useTranslation } from '@/src/utils/i18n';
import { isFeatureAllowedForUser } from '@/src/utils/rbac';

export default function GateConsoleScreen() {
  const { t } = useTranslation();
  const GATE_TABS = [
    { key: 'CONSOLE', label: t('console', 'Console') },
    { key: 'WALK_INS', label: t('walk_ins', 'Walk-Ins') },
    { key: 'INSIDE', label: t('inside', 'Inside') },
    { key: 'DIRECTORY', label: t('directory', 'Directory') },
  ];
  const activeOrgId = useSelector(selectActiveOrgId);
  const authUser = useSelector(selectAuthUser);
  const hasGateAccess = isFeatureAllowedForUser({ id: 'visitor_gate_console', permission: 'visitor:guard' }, authUser);
  if (authUser && !hasGateAccess) {
    return <Redirect href="/(resident)/dashboard" />;
  }
  const {
    passes,
    activePass,
    setActivePass,
    activeVisitors,
    fetchPassDetails,
    walkIns,
    loadPendingWalkIns,
    submitWalkIn,
    fetchActiveVisitors,
    processPreApproved,
    checkoutVisitor,
  } = useVisitorPass();

  const [passCode, setPassCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [admitLoading, setAdmitLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [scanResultSheetOpen, setScanResultSheetOpen] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [isInsideAction, setIsInsideAction] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'CONSOLE' | 'WALK_INS' | 'INSIDE' | 'DIRECTORY'>('CONSOLE');
  const [walkInLoading, setWalkInLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [insideCount, setInsideCount] = useState<number>(0);

  // Minimized Barcode Scanner Hardware State
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isScannerMinimized, setIsScannerMinimized] = useState(false);
  const [inlineTorchOn, setInlineTorchOn] = useState(false);

  const fetchGateMetrics = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      const activeList = await fetchActiveVisitors(activeOrgId);
      setInsideCount(activeList.length);
    } catch {
      // Handled silently
    }
  }, [activeOrgId, fetchActiveVisitors]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadPendingWalkIns(),
      fetchActiveVisitors(activeOrgId),
    ]);
    setRefreshing(false);
  }, [loadPendingWalkIns, fetchActiveVisitors, activeOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const extractCodeFromRaw = (raw: string): string => {
    let text = (raw || '').trim();
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const parsed = JSON.parse(text);
        text = parsed.code || parsed.shortKey || parsed.token || parsed.passId || text;
      } catch {}
    }
    if (text.includes('?')) {
      const urlParams = text.split('?')[1];
      const match = urlParams.match(/(?:code|token|passId|id)=([^&]+)/i);
      if (match && match[1]) {
        text = match[1];
      }
    } else if (text.includes('/')) {
      const parts = text.split('/');
      text = parts[parts.length - 1] || text;
    }
    return text.replace(/^PASS-?/i, '').replace(/[\s-]/g, '').trim();
  };

  const handleVerifyPass = async (codeToVerify?: string) => {
    const raw = (codeToVerify || passCode).trim();
    if (!raw) return;
    let code = raw;
    let barcodeMeta: any = null;
    const validation = parseAndValidateAppBarcode(raw);
    if (validation.isValid) {
      code = validation.code || validation.passId || raw;
      barcodeMeta = validation;
    }
    const cleanCode = extractCodeFromRaw(code);
    if (!cleanCode) return;

    setLoading(true);
    setStatusMessage(null);

    let passData: any = null;

    try {
      // 1. Try Redux thunk fetch
      const res: any = await fetchPassDetails(cleanCode);
      if (res?.meta?.requestStatus === 'fulfilled' && res?.payload) {
        passData = res.payload.data || res.payload;
      } else if (res?.payload) {
        passData = res.payload;
      }
    } catch {
      // Fallback
    }

    // 2. Direct service lookups fallback by Code
    if (!passData || (!passData._id && !passData.visitorName && !passData.visitorDetails)) {
      try {
        const res = await visitorService.getPassByCode(cleanCode);
        const body = res && (res as any).success !== undefined ? res : (res as any)?.data;
        passData = body?.data || body;
      } catch {}
    }

    // 3. Direct service lookup by ID
    if (!passData || (!passData._id && !passData.visitorName && !passData.visitorDetails)) {
      try {
        const res = await visitorService.getPassDetails(cleanCode);
        const body = res && (res as any).success !== undefined ? res : (res as any)?.data;
        passData = body?.data || body;
      } catch {}
    }

    // 4. In-memory fallback across passes list (Search by Vehicle Plate Number or Visitor Name)
    if ((!passData || (!passData._id && !passData.visitorName && !passData.visitorDetails)) && Array.isArray(passes)) {
      const q = raw.toLowerCase().trim();
      const matched = passes.find(
        (p: any) =>
          p.vehicleDetails?.number?.toLowerCase().replace(/[\s-]/g, '').includes(cleanCode.toLowerCase()) ||
          p.vehicleNo?.toLowerCase().replace(/[\s-]/g, '').includes(cleanCode.toLowerCase()) ||
          p.visitorDetails?.name?.toLowerCase().includes(q) ||
          p.visitorName?.toLowerCase().includes(q) ||
          p.phone?.includes(cleanCode) ||
          p.visitorDetails?.phone?.includes(cleanCode)
      );
      if (matched) {
        passData = matched;
      }
    }

    setLoading(false);

    if (passData && (passData._id || passData.visitorName || passData.visitorDetails)) {
      // Check if visitor is currently INSIDE
      let isCurrentlyInside = false;
      let matchedLogId: string | null = null;

      try {
        const currentActiveList = activeVisitors && activeVisitors.length > 0 ? activeVisitors : await fetchActiveVisitors(activeOrgId);
        const logs = Array.isArray(currentActiveList) ? currentActiveList : [];
        const foundInside = logs.find((l: any) => {
          const lPassId = (l.passId?._id || l.passId)?.toString();
          const targetId = (passData._id || passData.id)?.toString();
          return lPassId && targetId && lPassId === targetId;
        });
        if (foundInside) {
          isCurrentlyInside = true;
          matchedLogId = foundInside._id || foundInside.id;
        }
      } catch {}

      setIsInsideAction(isCurrentlyInside);
      setActiveLogId(matchedLogId);

      const isRevoked = passData.status === 'REVOKED';
      const isExpired =
        passData.status === 'EXPIRED' ||
        (passData.validUntil && new Date(passData.validUntil).getTime() < Date.now());
      const requiresServerDecision = !isCurrentlyInside && !isRevoked && !isExpired;

      const status: 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'PENDING' | 'REVOKED' = isRevoked
        ? 'REVOKED'
        : isExpired
        ? 'EXPIRED'
        : requiresServerDecision
        ? 'PENDING'
        : 'REJECTED';

      const result: ScanResultData = {
        success: isCurrentlyInside,
        status,
        title: isCurrentlyInside
          ? 'Visitor Currently On-Premises'
          : requiresServerDecision
          ? 'Pass Located'
          : 'Access Verification Denied',
        message: isCurrentlyInside
          ? 'Visitor is currently inside the estate. Tap below to log gate check-out.'
          : isRevoked
          ? 'Pass has been revoked by host resident or estate admin.'
          : isExpired
          ? 'This visitor pass has expired.'
          : requiresServerDecision
          ? 'Confirm entry to request the current server authorization decision.'
          : 'Pass is not eligible for entry.',
        visitorName: passData.visitorDetails?.name || passData.visitorName || 'Guest Visitor',
        visitorPhone: passData.visitorDetails?.phone || passData.phone,
        passType: passData.passType || 'GUEST',
        unitOrVilla: passData.villaId?.unitNumber
          ? `Villa ${passData.villaId.unitNumber}${passData.villaId.blockOrBuilding ? ` (${passData.villaId.blockOrBuilding})` : ''}`
          : passData.villaId?.name || passData.villaId?.number || passData.unit || 'Community / Common Area',
        hostName: passData.createdById?.name || passData.hostName || 'Host Resident',
        bookingReference: passData.shortKey || passData.code || cleanCode,
        validityWindow:
          passData.validity?.startDate && passData.validity?.endDate
            ? `${new Date(passData.validity.startDate).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })} - ${new Date(passData.validity.endDate).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : 'Today',
        metadata: {
          passId: passData._id || passData.id,
          code: passData.shortKey || passData.code || cleanCode,
        },
      };

      setScanResult(result);
      setScanResultSheetOpen(true);
    } else {
      setStatusMessage(`No active pass found matching "${raw}".`);
    }
  };

  const handleAdmitVisitor = async () => {
    if (!scanResult?.metadata?.passId && !scanResult?.bookingReference) {
      setScanResultSheetOpen(false);
      return;
    }

    setAdmitLoading(true);
    try {
      await processPreApproved({
        passId: scanResult.metadata?.passId,
        code: scanResult.metadata?.code || scanResult.bookingReference,
        orgId: activeOrgId,
        gateName: t('default_gate_name', 'Main gate'),
      });

      setScanResultSheetOpen(false);
      setPassCode('');
      setStatusMessage(`Visitor ${scanResult.visitorName || ''} successfully admitted!`);
      await loadData();
    } catch (err: any) {
      // Close the sheet so the refusal reason is visible on the console.
      setScanResultSheetOpen(false);
      setStatusMessage(err?.response?.data?.message || err?.message || 'Failed to admit visitor.');
    } finally {
      setAdmitLoading(false);
    }
  };

  const handleCheckOutFromConsole = async () => {
    if (!activeLogId) {
      setScanResultSheetOpen(false);
      return;
    }

    setAdmitLoading(true);
    try {
      await checkoutVisitor(activeLogId);
      setScanResultSheetOpen(false);
      setPassCode('');
      setStatusMessage(`Visitor ${scanResult?.visitorName || ''} checked out successfully!`);
      await loadData();
    } catch (err: any) {
      setStatusMessage(err?.response?.data?.message || err?.message || 'Failed to checkout visitor.');
    } finally {
      setAdmitLoading(false);
    }
  };

  const handleWalkInSubmit = async (data: {
    visitorName: string;
    phone: string;
    villaId?: string;
    villaName?: string;
    residentId?: string;
    residentName?: string;
    idProofNumber?: string;
    vehicleNumber?: string;
  }) => {
    setWalkInLoading(true);
    try {
      const targetResidentUser = data.residentId;
      await submitWalkIn({
        orgId: activeOrgId,
        residentId: targetResidentUser,
        entryType: 'WALK_IN',
        snapshot: {
          visitorName: data.visitorName,
          idProofNumber: data.idProofNumber,
          vehicleNumber: data.vehicleNumber,
        },
      });
      setStatusMessage(`Walk-in gate approval request sent to ${data.residentName || data.villaName || 'Resident'}`);
      setActiveTab('WALK_INS');
      loadData();
    } catch (err: any) {
      const details = err?.response?.data?.details;
      const detailMsg = details && details.length > 0 ? details[0].message : null;
      setStatusMessage(detailMsg || err?.response?.data?.message || err?.message || 'Failed to send request.');
    } finally {
      setWalkInLoading(false);
    }
  };

  const pendingCount = walkIns?.pendingList?.length || 0;

  return (
    <ScreenShell
      title="Gate Security Console"
      subtitle="Guard check-in verification, QR scanner & walk-in entry"
      iconName="ShieldCheck"
    >
      <View className="flex-1 bg-background">
        {/* Live Gate Operational KPI Strip */}
        <View className="py-2.5 bg-background border-b border-border/40">
          <KPIRow
            cards={[
              ({
                title: 'Inside Now',
                value: String(activeVisitors?.length || 0),
                subtitle: 'Active Visitors',
                iconName: 'Users',
                variant: 'success',
                onPress: () => setActiveTab('INSIDE'),
              } as any),
              ({
                title: 'Pending Walk-Ins',
                value: String(pendingCount),
                subtitle: 'Awaiting Host',
                iconName: 'Clock',
                variant: pendingCount > 0 ? 'warning' : 'default',
                onPress: () => setActiveTab('WALK_INS'),
              } as any),
              ({
                title: 'Gate Status',
                value: 'Active',
                subtitle: 'Main Gate Desk',
                iconName: 'ShieldCheck',
                variant: 'info',
              } as any),
            ]}
          />
        </View>

        {/* Canonical TabBar: Console vs Walk-In Queue vs Inside Visitors vs Directory */}
        <TabBar
          tabs={GATE_TABS}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as any)}
          variant="pill"
          className="mx-4 mt-3 mb-2"
        />

        {activeTab === 'INSIDE' ? (
          <InsideVisitorsView />
        ) : activeTab === 'WALK_INS' ? (
          <GuardWalkInStatusView />
        ) : activeTab === 'DIRECTORY' ? (
          <GuardVillaDirectoryView />
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-4 gap-4 pb-28 pt-2"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
          >
            {statusMessage && (
              <View className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex-row items-center gap-2">
                <CheckCircle2 size={16} className="text-primary shrink-0" />
                <Text className="text-xs font-semibold text-primary flex-1">{statusMessage}</Text>
              </View>
            )}
            {/* Verification Card with Integrated Minimized Barcode Scanner */}
            <View className="bg-card border border-border rounded-2xl p-4 gap-3 overflow-hidden shadow-sm">
              <View className="flex-row items-center justify-between border-b border-border/40 pb-2.5">
                <View className="flex-row items-center gap-2">
                  <Barcode size={18} className="text-emerald-500" />
                  <Text className="text-sm font-bold text-foreground">{t('barcode_qr_gate_scanner', 'Barcode & QR Gate Scanner')}</Text>
                </View>

                {/* Top Controls: Light / Torch, Minimize/Expand, Fullscreen */}
                <View className="flex-row items-center gap-1.5">
                  {cameraPermission?.granted && !isScannerMinimized && (
                    <TouchableOpacity
                      onPress={() => setInlineTorchOn((prev) => !prev)}
                      className={`p-1.5 rounded-lg border ${
                        inlineTorchOn
                          ? 'bg-amber-400 border-amber-300'
                          : 'bg-muted border-border'
                      }`}
                      accessibilityLabel={t('toggle_scanner_light', 'Toggle Scanner Light')}
                    >
                      {inlineTorchOn ? (
                        <Zap size={14} color="#000000" fill="#000000" />
                      ) : (
                        <ZapOff size={14} className="text-muted-foreground" />
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => setIsScannerMinimized((prev) => !prev)}
                    className="p-1.5 rounded-lg border border-border bg-muted"
                    accessibilityLabel={isScannerMinimized ? t('expand_scanner', 'Expand scanner') : t('minimize_scanner', 'Minimize scanner')}
                  >
                    {isScannerMinimized ? (
                      <Maximize2 size={14} className="text-foreground" />
                    ) : (
                      <Minimize2 size={14} className="text-foreground" />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setQrScannerOpen(true)}
                    className="p-1.5 rounded-lg border border-border bg-muted"
                    accessibilityLabel={t('open_fullscreen_scanner', 'Open Fullscreen Scanner')}
                  >
                    <Maximize2 size={14} className="text-foreground" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Minimized Live Camera Viewport */}
              {!isScannerMinimized ? (
                !cameraPermission?.granted ? (
                  <View className="h-44 w-full rounded-xl bg-black/90 items-center justify-center p-4 border border-border/40 gap-2">
                    <Camera size={28} color="#94a3b8" />
                    <Text className="text-xs text-white/80 font-semibold text-center">
                      {t('camera_access_required_to_scan_barcodes', 'Camera access required to scan barcodes')}
                    </Text>
                    <Button
                      size="sm"
                      variant="default"
                      onPress={requestCameraPermission}
                      className="bg-emerald-600 px-4 py-1.5 rounded-lg mt-1"
                    >
                      <Text className="text-xs font-bold text-white">{t('enable_camera', 'Enable Camera')}</Text>
                    </Button>
                  </View>
                ) : (
                  <View className="h-48 w-full rounded-xl overflow-hidden bg-black relative border border-emerald-500/30">
                    <CameraView
                      facing="back"
                      enableTorch={Boolean(inlineTorchOn)}
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'pdf417', 'upc_a', 'upc_e'],
                      }}
                      onBarcodeScanned={loading ? undefined : ({ data }) => handleVerifyPass(data)}
                      style={{ width: '100%', height: '100%' }}
                    />
                    <QRScannerOverlay
                      mode="barcode"
                      frameHeight={120}
                      frameWidth={260}
                      instruction={t('fit_barcode_inside_box', 'Fit Barcode inside Box')}
                    />
                  </View>
                )
              ) : (
                <TouchableOpacity
                  onPress={() => setIsScannerMinimized(false)}
                  className="flex-row items-center justify-between p-3 rounded-xl bg-muted/60 border border-border"
                >
                  <View className="flex-row items-center gap-2">
                    <Barcode size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <Text className="text-xs font-semibold text-foreground">{t('scanner_minimized', 'Scanner Minimized')}</Text>
                  </View>
                  <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{t('expand_camera', 'Expand Camera')}</Text>
                </TouchableOpacity>
              )}

              {/* Manual Pass Code Fallback Input */}
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <TextInput
                    value={passCode}
                    onChangeText={setPassCode}
                    placeholder={t('enter_6_digit_pin_plate_or_name', 'Enter 6-digit PIN, Plate, or Name...')}
                    keyboardType="default"
                    leftIcon={Search}
                    inputClassName="font-mono text-sm tracking-wider"
                    onSubmitEditing={() => handleVerifyPass()}
                  />
                </View>
                <Button
                  size="sm"
                  onPress={() => handleVerifyPass()}
                  disabled={loading || !passCode.trim()}
                  className="h-12 px-4 rounded-xl bg-emerald-600 active:bg-emerald-700"
                  accessibilityLabel={t('search_pass_code', 'Search Pass Code')}
                >
                  <Search size={18} color="#FFFFFF" strokeWidth={2.5} />
                </Button>
              </View>

              {/* Fullscreen Modal Option */}
              <Button
                variant="outline"
                className="flex-row items-center justify-center gap-2 h-11 rounded-xl border-emerald-500/30 bg-emerald-500/10 active:bg-emerald-500/20"
                onPress={() => setQrScannerOpen(true)}
                accessibilityLabel={t('open_fullscreen_barcode_scanner', 'Open Fullscreen Barcode Scanner')}
              >
                <Barcode size={18} className="text-emerald-600 dark:text-emerald-400" />
                <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {t('open_fullscreen_scanner', 'Open Fullscreen Scanner')}
                </Text>
              </Button>
            </View>

            {/* Guard Quick Actions */}
            <View className="bg-card border border-border rounded-2xl p-4 gap-3">
              <Text className="text-sm font-bold text-foreground">{t('guard_gate_actions', 'Guard Gate Actions')}</Text>

              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={() => setWalkInModalOpen(true)}
                  className="flex-1 h-auto py-3.5 rounded-xl flex-col items-center justify-center gap-1.5 bg-amber-500/10 border-amber-500/20"
                  accessibilityLabel={t('initiate_walk_in', 'Initiate Walk-In')}
                >
                  <ShieldAlert size={22} className="text-amber-600 dark:text-amber-400" />
                  <Text className="text-xs font-bold text-amber-600 dark:text-amber-400 text-center">
                    {t('initiate_walk_in', 'Initiate Walk-In')}
                  </Text>
                </Button>

                <Button
                  variant="outline"
                  onPress={() => setActiveTab('DIRECTORY')}
                  className="flex-1 h-auto py-3.5 rounded-xl flex-col items-center justify-center gap-1.5 bg-primary/10 border-primary/20"
                  accessibilityLabel={t('villa_directory', 'Villa Directory')}
                >
                  <Search size={22} className="text-primary" />
                  <Text className="text-xs font-bold text-primary text-center">
                    {t('villa_directory', 'Villa Directory')}
                  </Text>
                </Button>

                <Button
                  variant="outline"
                  onPress={() => setActiveTab('INSIDE')}
                  className="flex-1 h-auto py-3.5 rounded-xl flex-col items-center justify-center gap-1.5 bg-red-500/10 border-red-500/20"
                  accessibilityLabel={t('gate_check_out', 'Gate Check-Out')}
                >
                  <LogOut size={22} className="text-red-600 dark:text-red-400" />
                  <Text className="text-xs font-bold text-red-600 dark:text-red-400 text-center">
                    {t('gate_check_out', 'Gate Check-Out')}
                  </Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Hardware / Verification Scan Result Sheet with Admit / Checkout Action */}
      <ScanResultSheet
        visible={scanResultSheetOpen}
        result={scanResult}
        loading={admitLoading}
        primaryActionLabel={isInsideAction ? t('gate_check_out', 'Gate Check-Out') : t('confirm_gate_entry', 'Confirm Gate Entry')}
        secondaryActionLabel={t('dismiss', 'Dismiss')}
        onPrimaryAction={isInsideAction ? handleCheckOutFromConsole : handleAdmitVisitor}
        onSecondaryAction={() => setScanResultSheetOpen(false)}
        onClose={() => setScanResultSheetOpen(false)}
      />

      {/* Verification Details Modal for Resident Review / Revocation */}
      <VisitorPassDetailsModal
        visible={detailsModalOpen}
        pass={activePass}
        onClose={() => setDetailsModalOpen(false)}
      />

      {/* Guard Walk-in Form Modal */}
      <GuardInitiateWalkInModal
        visible={walkInModalOpen}
        loading={walkInLoading}
        onClose={() => setWalkInModalOpen(false)}
        onSubmit={handleWalkInSubmit}
      />

      {/* Camera QR Scanner Modal */}
      <GuardQRScannerModal
        visible={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScanCode={(code) => {
          setPassCode(code);
          handleVerifyPass(code);
        }}
      />
    </ScreenShell>
  );
}
