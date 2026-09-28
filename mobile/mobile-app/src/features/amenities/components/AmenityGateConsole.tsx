/**
 * Amenity gate console: verify passes (camera or typed code), collect a balance in cash
 * before entry, record exits with a return inspection for borrowed items, and read the
 * gate's security log. Every decision is made by the server.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import {
  QrCode,
  ScanLine,
  Search,
} from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { TabBar } from '@/components/ui/TabBar';
import { KPIRow } from '@/components/ui/KPIRow';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { PaginatedList } from '@/components/ui/PaginatedList';
import { ScanResultSheet } from '@/components/hardware/ScanResultSheet';
import { ManualCodeEntrySheet } from '@/components/hardware/ManualCodeEntrySheet';
import { QRScannerModal } from '@/components/hardware/QRScannerModal';
import { AmenitySecurityLogCard } from './AmenitySecurityLogCard';
import { SecurityLogDetailModal } from './SecurityLogDetailModal';
import { ReturnInspectionSheet } from './ReturnInspectionSheet';
import { SecurityLog } from '../services/securityLogApi';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useSecurityScanner } from '../hooks/useSecurityScanner';
import { useSecurityLogs } from '../hooks/useSecurityLogs';

const AMENITY_TABS = [
  { key: 'CONSOLE', label: 'Console' },
  { key: 'LOGS', label: 'Security Logs' },
];

const SCAN_TYPE_TABS = [
  { key: '', label: 'All Types' },
  { key: 'Entry', label: 'Entry' },
  { key: 'Exit', label: 'Exit' },
  { key: 'Denied', label: 'Denied' },
  { key: 'Manual Verification', label: 'Manual' },
];

export function AmenityGateConsole() {
  const {
    isResultModalOpen,
    checkingIn,
    scanResult,
    primaryActionLabel,
    runPrimaryAction,
    inspection,
    handleBarCodeScanned,
    resetScanner,
  } = useSecurityScanner();

  // Full Security Logs Hook integration for real-time backend data
  const {
    logs: auditLogs,
    dashboard: logDashboard,
    pagination: logPagination,
    filters: logFilters,
    loading: logsLoading,
    error: logsError,
    loadData: refreshSecurityLogs,
    handleFilterChange: onLogFilterChange,
    handlePageChange: onLogPageChange,
    handleClearFilters: onClearLogFilters,
  } = useSecurityLogs();

  const [passCode, setPassCode] = useState('');
  const [activeTab, setActiveTab] = useState<'CONSOLE' | 'LOGS'>('CONSOLE');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [manualSheetOpen, setManualSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<SecurityLog | null>(null);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    refreshSecurityLogs();
    setRefreshing(false);
  }, [refreshSecurityLogs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerifyPass = async (codeToVerify?: string) => {
    const raw = (codeToVerify || passCode).trim();
    if (!raw) return;

    await handleBarCodeScanned({ type: 'MANUAL', data: raw });
    refreshSecurityLogs();
  };

  const handleManualSubmit = (token: string) => {
    setManualSheetOpen(false);
    handleVerifyPass(token);
  };

  return (
    <ScreenShell
      title="Amenity Access Pass Scanner"
      subtitle="Facility entry verification & QR pass scanner"
      iconName="ShieldCheck"
    >
      <View className="flex-1 bg-background">
        {/* Top KPI Box: Today's Entries, Today's Exits, Denied Access */}
        <View className="py-2.5 bg-background border-b border-border/40">
          <KPIRow
            cards={[
              {
                title: "Today's Entries",
                value: String(logDashboard?.entries || 0),
                subtitle: 'Verified In',
                iconName: 'DoorOpen',
                variant: 'success',
                onPress: () => {
                  setActiveTab('LOGS');
                  onLogFilterChange('scanType', 'Entry');
                },
              },
              {
                title: "Today's Exits",
                value: String(logDashboard?.exits || 0),
                subtitle: 'Checked Out',
                iconName: 'DoorClosed',
                variant: 'info',
                onPress: () => {
                  setActiveTab('LOGS');
                  onLogFilterChange('scanType', 'Exit');
                },
              },
              {
                title: 'Denied Access',
                value: String(logDashboard?.denied || 0),
                subtitle: 'Refused Scans',
                iconName: 'ShieldAlert',
                variant: 'destructive',
                onPress: () => {
                  setActiveTab('LOGS');
                  onLogFilterChange('scanType', 'Denied');
                },
              },
            ]}
          />
        </View>

        {/* TabBar Navigation: Console vs Security Logs */}
        <TabBar
          tabs={AMENITY_TABS}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as any)}
          variant="pill"
          className="mx-4 mt-3 mb-2"
        />

        {activeTab === 'LOGS' ? (
          <View className="flex-1 px-4 pt-1">
            {/* Scan Type Filter Pills & Search Filter */}
            <View className="gap-2 mb-2">
              <TabBar
                tabs={SCAN_TYPE_TABS}
                activeTab={logFilters.scanType || ''}
                onTabChange={(tabKey) => onLogFilterChange('scanType', tabKey)}
                variant="pill"
              />

              <SearchFilterBar
                searchValue={logFilters.search || ''}
                onSearchChange={(text) => onLogFilterChange('search', text)}
                searchPlaceholder="Search resident, amenity, pass code..."
                variant="bordered"
                className="px-0 py-0 border-0"
              />

              {Boolean(logFilters.search || logFilters.scanType) && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={onClearLogFilters}
                  className="self-end py-1 h-7 px-2.5"
                >
                  Clear Filters
                </Button>
              )}
            </View>

            {/* Paginated Embedded Security Log List */}
            <PaginatedList<SecurityLog>
              data={auditLogs}
              renderItem={(item) => (
                <AmenitySecurityLogCard
                  key={item._id}
                  log={item}
                  onPress={setSelectedAuditLog}
                />
              )}
              pagination={{
                currentPage: (logPagination as any).currentPage || logPagination.page || 1,
                totalPages: logPagination.totalPages || 1,
                totalRecords: (logPagination as any).totalRecords || logPagination.total || auditLogs.length,
                limit: logPagination.limit || 20,
              }}
              onLoadMore={() => {
                const current = (logPagination as any).currentPage || logPagination.page || 1;
                if (current < logPagination.totalPages) {
                  onLogPageChange(current + 1);
                }
              }}
              onRefresh={loadData}
              loading={logsLoading}
              emptyIcon="ClipboardList"
              emptyTitle="No Security Logs Found"
              emptySubtitle="Security verification logs will stream here as passes are scanned."
              contentContainerClassName="pb-28 gap-2"
            />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-4 gap-4 pb-28 pt-2"
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
          >
            {/* Verification Input Card */}
            <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-xs">
              <View className="flex-row items-center gap-2 border-b border-border/40 pb-2.5">
                <ScanLine size={18} className="text-status-warning" />
                <Text className="text-sm font-bold text-foreground">
                  Verify Access Pass
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <TextInput
                    value={passCode}
                    onChangeText={setPassCode}
                    placeholder="Enter Pass Token or QR Code..."
                    keyboardType="default"
                    inputClassName="font-mono text-sm tracking-wider"
                    onSubmitEditing={() => handleVerifyPass()}
                  />
                </View>
                <Button
                  size="sm"
                  onPress={() => handleVerifyPass()}
                  disabled={checkingIn || !passCode.trim()}
                  loading={checkingIn}
                  className="h-12 w-12 rounded-2xl items-center justify-center p-0"
                  accessibilityLabel="Search Pass Code"
                >
                  <Search size={18} className="text-primary-foreground" />
                </Button>
              </View>

              <Button
                variant="outline"
                className="flex-row items-center justify-center gap-2 h-11 rounded-xl border-amber-500/40 bg-amber-500/10"
                onPress={() => {
                  resetScanner();
                  setQrScannerOpen(true);
                }}
                accessibilityLabel="Open Camera QR Scanner"
              >
                <QrCode size={18} className="text-status-warning" />
                <Text className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  Open Camera QR Scanner
                </Text>
              </Button>
            </View>

            {/* Live Attendance Stream Section */}
            <View className="gap-2.5">
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-sm font-bold text-foreground">Recent Check-In Stream</Text>
                <Text className="text-xs text-muted-foreground font-semibold">Today</Text>
              </View>

              {auditLogs && auditLogs.length > 0 ? (
                auditLogs.slice(0, 5).map((log: any, idx: number) => (
                  <AmenitySecurityLogCard
                    key={log._id || idx}
                    log={log}
                    onPress={setSelectedAuditLog}
                  />
                ))
              ) : (
                <EmptyState
                  title="No Live Activity"
                  description="Recent check-in scans will stream live here as residents access facilities."
                />
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Hardware Camera QR Scanner Modal */}
      <QRScannerModal
        visible={qrScannerOpen}
        title="QR Scanner"
        instruction="Align QR Code inside Frame"
        onClose={() => setQrScannerOpen(false)}
        onScanCode={async (code) => {
          setQrScannerOpen(false);
          setPassCode(code);
          await handleVerifyPass(code);
        }}
      />

      {/* Verification Result Sheet */}
      <ScanResultSheet
        visible={isResultModalOpen}
        onClose={resetScanner}
        result={scanResult}
        loading={checkingIn}
        onPrimaryAction={runPrimaryAction}
        primaryActionLabel={primaryActionLabel}
        onSecondaryAction={resetScanner}
        secondaryActionLabel="Dismiss"
      />

      {/* Manual Token Lookup Fallback Sheet */}
      <ManualCodeEntrySheet
        visible={manualSheetOpen}
        onClose={() => setManualSheetOpen(false)}
        onSubmitCode={handleManualSubmit}
        loading={checkingIn}
        title="Manual Booking Token Lookup"
        description="Enter the resident reservation reference token if optical QR scan is unavailable."
        placeholder="e.g. BK-778899"
        label="Booking Reference Token"
      />

      {/* Return inspection for borrowed items (before the exit is recorded) */}
      <ReturnInspectionSheet
        visible={inspection.visible}
        onClose={inspection.onClose}
        onConfirm={inspection.onConfirm}
        depositAmount={inspection.depositAmount}
        reservationNumber={inspection.reservationNumber}
        loading={checkingIn}
        error={inspection.error}
      />

      {/* Security Log Details (read-only at the gate: audit records are not deleted here) */}
      <SecurityLogDetailModal
        visible={!!selectedAuditLog}
        onClose={() => setSelectedAuditLog(null)}
        log={selectedAuditLog}
      />
    </ScreenShell>
  );
}

export default AmenityGateConsole;
