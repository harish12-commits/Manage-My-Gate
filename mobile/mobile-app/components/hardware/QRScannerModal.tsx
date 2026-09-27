import React, { useState, useEffect } from 'react';
import { View, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/forms/TextInput';
import { QRScannerOverlay } from './QRScannerOverlay';
import { FlashlightToggle } from './FlashlightToggle';
import { ScanLine, X, CameraOff } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanCode: (code: string) => void;
  title?: string;
  instruction?: string;
  barcodeTypes?: ('qr' | 'code128' | 'code39')[];
}

/**
 * Standard Hardware QR Scanner Modal Component.
 * Unified camera scanner dialog with viewfinder overlay, torch toggle, and manual input fallback.
 */
export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onScanCode,
  title = 'QR Code Scanner',
  instruction = 'Align QR Code inside Frame',
  barcodeTypes = ['qr', 'code128', 'code39'],
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setTorchOn(false);
      setManualCode('');
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || !data) return;
    setScanned(true);
    onScanCode(data.trim());
    onClose();
  };

  const handleManualScan = () => {
    if (manualCode.trim()) {
      onScanCode(manualCode.trim());
      setManualCode('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-black pt-12">
          {/* Camera-first header */}
          <View className="px-5 pb-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
                <ScanLine size={21} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-base font-extrabold text-white">{title}</Text>
                <Text className="text-xs text-white/60">Point camera at the facility pass</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              className="p-2.5 rounded-full bg-white/15 active:bg-white/25"
              accessibilityRole="button"
              accessibilityLabel="Close scanner"
            >
              <X size={19} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Full-width live viewfinder */}
          <View className="flex-1 mx-4 mb-4 bg-zinc-900 rounded-3xl overflow-hidden relative border border-white/15 justify-center items-center">
            {!permission ? (
              <Text className="text-white text-xs">Checking camera status...</Text>
            ) : !permission.granted ? (
              <View className="p-4 items-center justify-center gap-2 text-center">
                <View className="w-14 h-14 rounded-full bg-white/10 items-center justify-center mb-1">
                  <CameraOff size={28} color="#ffffff" />
                </View>
                <Text className="text-white font-bold text-center">Camera Access Required</Text>
                <Text className="text-white/60 text-xs text-center px-4">
                  Enable camera to scan and verify QR codes or barcodes.
                </Text>
                <Button variant="default" size="sm" onPress={requestPermission} className="mt-2">
                  <Text className="text-white font-bold text-xs">Enable Camera</Text>
                </Button>
              </View>
            ) : (
              <>
                <CameraView
                  facing="back"
                  enableTorch={torchOn}
                  barcodeScannerSettings={{
                    barcodeTypes,
                  }}
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                  style={{ width: '100%', height: '100%' }}
                />

                {/* Reusable Viewfinder Overlay */}
                <QRScannerOverlay instruction={instruction} />

                {/* Torch Control Button */}
                <View className="absolute top-3 end-3 z-10">
                  <FlashlightToggle isOn={torchOn} onToggle={() => setTorchOn(!torchOn)} />
                </View>
              </>
            )}
          </View>

          {/* Manual fallback stays outside the camera frame and above the keyboard. */}
          <View className="bg-card rounded-t-3xl px-5 pt-4 pb-8 gap-2 border-t border-border">
            <Text className="text-xs font-semibold text-muted-foreground">Having trouble scanning?</Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-1 min-w-0">
              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="Or enter pass/ref code..."
                autoCapitalize="characters"
              />
              </View>
              <Button
                variant="default"
                onPress={handleManualScan}
                disabled={!manualCode.trim()}
                className="h-11 px-4 rounded-xl"
                accessibilityRole="button"
                accessibilityLabel="Verify code manually"
              >
                Verify
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default QRScannerModal;
