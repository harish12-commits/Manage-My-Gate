import React, { useState, useMemo } from 'react';
import { View, FlatList, RefreshControl, ScrollView, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { ChevronLeft, ChevronRight, Plus, Hash, X, Landmark } from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { FAB } from '@/components/ui/FAB';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SkeletonLoader } from '@/components/feedback/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TextInput } from '@/components/forms/TextInput';
import useIntegrationHub from '../hooks/useIntegrationHub';
import ProviderCard from '../components/ProviderCard';
import ConnectionCard from '../components/ConnectionCard';
import ConnectModal from '../components/ConnectModal';
import BankDetailsModal from '../components/BankDetailsModal';
import EditConnectionModal from '../components/EditConnectionModal';
import ConnectionDetailsModal from '../components/ConnectionDetailsModal';

export const IntegrationHubScreen: React.FC = () => {
  const {
    catalog = [],
    connections = [],
    selectedProvider = 'all',
    isLoading = false,
    isSubmitting = false,
    error = null,
    pagination = { currentPage: 1, totalPages: 1, totalRecords: 0, rowsPerPage: 10 },
    connectModalVisible = false,
    bankModalVisible = false,
    editModalVisible = false,
    detailsModalVisible = false,
    deleteModalVisible = false,
    selectedConnection = null,
    targetConnection = null,
    selectedCatalogItem = null,
    setSelectedCatalogItem,
    handleSelectProvider,
    handleRefresh,
    handlePageChange,
    openConnectModal,
    closeConnectModal,
    handleConnectSubmit,
    openBankModal,
    closeBankModal,
    handleBankDetailsSubmit,
    openEditModal,
    closeEditModal,
    handleUpdateLabelSubmit,
    openDetailsModal,
    closeDetailsModal,
    promptDelete,
    closeDeleteModal,
    confirmDelete,
  } = useIntegrationHub();

  const [searchQuery, setSearchQuery] = useState('');
  const [showPageJumpModal, setShowPageJumpModal] = useState(false);
  const [targetPageInput, setTargetPageInput] = useState('');

  // Dynamic filter chips
  const filterChips = useMemo(() => {
    const base = [{ id: 'all', label: 'All Connections', count: connections.length }];
    catalog.forEach((cat) => {
      const count = connections.filter((c) => c.provider === cat.id).length;
      base.push({ id: cat.id, label: cat.name, count });
    });
    return base;
  }, [catalog, connections]);

  // Filter connections
  const filteredConnections = useMemo(() => {
    let result = connections || [];
    if (selectedProvider && selectedProvider !== 'all') {
      result = result.filter((c) => c.provider === selectedProvider);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.accountLabel?.toLowerCase().includes(q) ||
          c.provider?.toLowerCase().includes(q) ||
          c.id?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [connections, selectedProvider, searchQuery]);

  const currentPage = pagination.currentPage || 1;
  const totalPages = pagination.totalPages || 1;
  const totalRecords = filteredConnections.length;

  const handleExecutePageJump = () => {
    const pageNum = parseInt(targetPageInput.trim(), 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum);
      setShowPageJumpModal(false);
      setTargetPageInput('');
    } else {
      Alert.alert('Invalid Page', `Please enter a valid page number between 1 and ${totalPages}.`);
    }
  };

  // Pagination Footer
  const renderPaginationFooter = () => {
    if (totalRecords === 0 || totalPages <= 1) return null;
    return (
      <View className="mt-4 pt-3 border-t border-border/40">
        <View className="flex-row items-center justify-between bg-card border border-border/60 p-2.5 rounded-xl shadow-xs">
          <TouchableOpacity
            onPress={() => { if (currentPage > 1) handlePageChange(currentPage - 1); }}
            disabled={currentPage <= 1 || isLoading}
            className={`flex-row items-center px-3.5 py-2 rounded-lg border ${
              currentPage <= 1 || isLoading
                ? 'bg-muted/40 border-border/40 opacity-40'
                : 'bg-blue-500/10 border-blue-500/20 active:opacity-70'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <ChevronLeft size={16} color={currentPage <= 1 || isLoading ? '#9ca3af' : '#2563eb'} className="me-1" />
            <Text className={`text-xs font-bold ${currentPage <= 1 || isLoading ? 'text-muted-foreground' : 'text-blue-600 dark:text-blue-400'}`}>
              Prev
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setTargetPageInput(String(currentPage));
              setShowPageJumpModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-muted/60 border border-border/60 flex-row items-center"
            accessibilityRole="button"
            accessibilityLabel="Current page"
          >
            <Text className="text-xs font-bold text-foreground">
              Page {currentPage} of {totalPages}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { if (currentPage < totalPages) handlePageChange(currentPage + 1); }}
            disabled={currentPage >= totalPages || isLoading}
            className={`flex-row items-center px-3.5 py-2 rounded-lg border ${
              currentPage >= totalPages || isLoading
                ? 'bg-muted/40 border-border/40 opacity-40'
                : 'bg-blue-500/10 border-blue-500/20 active:opacity-70'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Text className={`text-xs font-bold me-1 ${currentPage >= totalPages || isLoading ? 'text-muted-foreground' : 'text-blue-600 dark:text-blue-400'}`}>
              Next
            </Text>
            <ChevronRight size={16} color={currentPage >= totalPages || isLoading ? '#9ca3af' : '#2563eb'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenShell
      title="Integration Hub"
      subtitle="APIs & Payment Gateways"
      iconName="Layers"
      domainName="Administration & Security"
      sharedSlice="integrationHubSlice.ts"
      loading={false}
      error={error}
      onRetry={handleRefresh}
      headerRight={
        <TouchableOpacity
          onPress={openBankModal}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 active:bg-blue-500/20"
          accessibilityRole="button"
          accessibilityLabel="Banking Vault"
        >
          <Icon as={Landmark} size={15} className="text-blue-600" />
          <Text className="text-xs font-semibold text-blue-600">Vault</Text>
        </TouchableOpacity>
      }
    >
      <View className="flex-1 bg-background">
        {/* Search & Filter Bar */}
        <SearchFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search connections by name or provider..."
        />

        {/* Filter Chips */}
        <View className="px-3.5 py-1.5">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row items-center gap-2">
              {filterChips.map((chip) => {
                const isActive = selectedProvider === chip.id;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    onPress={() => handleSelectProvider(chip.id)}
                    activeOpacity={0.8}
                    className={`px-3.5 py-1.5 rounded-xl border flex-row items-center gap-1.5 ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 shadow-xs'
                        : 'bg-card border-border/80'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-foreground'}`}>
                      {chip.label}
                    </Text>
                    <View className={`px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20' : 'bg-muted-foreground/15'}`}>
                      <Text className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-muted-foreground'}`}>
                        {chip.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Provider Catalog Horizontal Carousel */}
        {catalog.length > 0 && (
          <View className="pt-2.5 pb-3 border-b border-border/40">
            <View className="flex-row items-center justify-between px-3.5 mb-2.5">
              <Text className="text-xs font-bold text-foreground tracking-tight text-start">
                Available Providers
              </Text>
              <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-primary">
                  {catalog.length} Available
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14 }}
            >
              <View className="flex-row items-center">
                {catalog.map((item) => {
                  const activeCount = connections.filter((c) => c.provider === item.id).length;
                  return (
                    <ProviderCard
                      key={item.id}
                      provider={item}
                      activeCount={activeCount}
                      onConnect={openConnectModal}
                    />
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* List Content */}
        {isLoading && filteredConnections.length === 0 ? (
          <View className="p-3.5">
            <SkeletonLoader count={4} variant="card" />
          </View>
        ) : filteredConnections.length === 0 ? (
          <View className="py-6 px-4">
            <EmptyState
              title={searchQuery ? 'No Matching Connections' : 'No Connections Configured'}
              description={
                searchQuery
                  ? `No connections found matching "${searchQuery}".`
                  : 'No integrations configured yet. Tap the button below to connect your first provider.'
              }
              actionLabel="Connect Provider"
              onAction={() => openConnectModal()}
            />
          </View>
        ) : (
          <FlatList
            data={filteredConnections}
            keyExtractor={(item) => item.id || String(Math.random())}
            ListHeaderComponent={
              <View className="flex-row items-center justify-between pb-2 pt-1 px-1">
                <Text className="text-xs font-bold text-foreground tracking-tight">
                  Configured Connections
                </Text>
                <View className="bg-muted px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-muted-foreground">
                    {filteredConnections.length} Active
                  </Text>
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <ConnectionCard
                connection={item}
                onPress={openDetailsModal}
                onEdit={openEditModal}
                onDisconnect={promptDelete}
              />
            )}
            contentContainerClassName="p-3 pb-28"
            ListFooterComponent={renderPaginationFooter}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={handleRefresh}
                colors={['#0d9488']}
                tintColor="#0d9488"
              />
            }
          />
        )}
      </View>

      {/* Connect Sheet Modal */}
      <ConnectModal
        visible={connectModalVisible}
        catalog={catalog}
        selectedCatalogItem={selectedCatalogItem}
        onSelectCatalogItem={setSelectedCatalogItem}
        onClose={closeConnectModal}
        onSubmit={handleConnectSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />

      {/* Banking Vault Details Modal */}
      <BankDetailsModal
        visible={bankModalVisible}
        onClose={closeBankModal}
        onSubmit={handleBankDetailsSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />

      {/* Edit Connection Label Modal */}
      <EditConnectionModal
        visible={editModalVisible}
        onClose={closeEditModal}
        connection={selectedConnection}
        onSubmit={handleUpdateLabelSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />

      {/* Connection Details Modal */}
      <ConnectionDetailsModal
        visible={detailsModalVisible}
        onClose={closeDetailsModal}
        connection={selectedConnection}
        onEdit={openEditModal}
        onDisconnect={promptDelete}
      />

      {/* Disconnect Confirmation Modal */}
      <ConfirmationModal
        visible={deleteModalVisible}
        title="Disconnect Integration"
        message={`Are you sure you want to disconnect ${targetConnection?.accountLabel || 'this integration'}? Active role bindings using this connection will stop functioning.`}
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
        variant="danger"
        loading={isLoading}
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />

      {/* Quick Jump To Page Modal */}
      <Modal visible={showPageJumpModal} transparent statusBarTranslucent={true} animationType="fade" onRequestClose={() => setShowPageJumpModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-center items-center bg-black/50 p-4">
            <View className="bg-card rounded-2xl p-5 border border-border w-full max-w-xs shadow-lg">
              <View className="flex-row items-center justify-between pb-2 border-b border-border mb-3">
                <View className="flex-row items-center">
                  <Hash size={18} color="#2563eb" className="me-2" />
                  <Text className="text-base font-bold text-foreground">Jump to Page</Text>
                </View>
                <TouchableOpacity onPress={() => setShowPageJumpModal(false)}>
                  <X size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs text-muted-foreground mb-3 text-start">
                Enter page number between <Text className="font-bold text-foreground">1</Text> and <Text className="font-bold text-foreground">{totalPages}</Text>:
              </Text>

              <TextInput
                value={targetPageInput}
                onChangeText={setTargetPageInput}
                placeholder={`1 - ${totalPages}`}
                keyboardType="number-pad"
                autoFocus
                className="mb-4"
              />

              <View className="flex-row items-center justify-end gap-2">
                <Button variant="outline" size="sm" onPress={() => setShowPageJumpModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onPress={handleExecutePageJump}
                  className="bg-blue-600 active:bg-blue-700"
                >
                  Go to Page
                </Button>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenShell>
  );
};

export default IntegrationHubScreen;
