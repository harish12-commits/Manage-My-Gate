import React from 'react';
import { View, Dimensions } from 'react-native';
import { ScanLine, Barcode, QrCode } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '../../lib/utils';

export interface QRScannerOverlayProps {
  instruction?: string;
  mode?: 'barcode' | 'qr';
  frameWidth?: number;
  frameHeight?: number;
  className?: string;
}

export const QRScannerOverlay: React.FC<QRScannerOverlayProps> = ({
  instruction = 'Align QR Code / Pass within frame',
  mode = 'qr',
  frameWidth: customWidth,
  frameHeight: customHeight,
  className,
}) => {
  const { width: screenWidth } = Dimensions.get('window');

  // Barcode dimensions fit wide 1D barcodes and 2D QR passes cleanly
  const frameWidth = customWidth || (mode === 'barcode' ? Math.min(screenWidth - 48, 320) : Math.min(screenWidth - 48, 300));
  const frameHeight = customHeight || (mode === 'barcode' ? 160 : Math.min(screenWidth - 48, 300));

  const scanLineOffset = useSharedValue(0);

  React.useEffect(() => {
    scanLineOffset.value = withRepeat(
      withSequence(
        withTiming(frameHeight - 12, { duration: 1600 }),
        withTiming(6, { duration: 1600 })
      ),
      -1
    );
  }, [frameHeight]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineOffset.value }],
  }));

  return (
    <View className={cn('absolute inset-0 flex-col', className)} style={{ pointerEvents: 'box-none' }}>
      {/* Top Dimmed Letterbox */}
      <View className="flex-1 bg-black/60 items-center justify-end pb-5 px-6">
        <View className="flex-row items-center gap-2 bg-black/80 px-3.5 py-1.5 rounded-full border border-white/20 shadow-md">
          {mode === 'barcode' ? (
            <Barcode size={15} color="#22c55e" />
          ) : (
            <QrCode size={15} color="#22c55e" />
          )}
          <Text className="text-white text-[11px] font-bold tracking-wider uppercase">
            {mode === 'barcode' ? 'Barcode Scanner Active' : 'QR Scanner Active'}
          </Text>
        </View>
      </View>

      {/* Center Row: Left Dimmed Mask | 100% CLEAR BRIGHT APERTURE | Right Dimmed Mask */}
      <View className="flex-row items-center justify-center shrink-0" style={{ height: frameHeight }}>
        <View className="flex-1 h-full bg-black/60" />

        {/* The Crystal Clear Bright Scanner Window (Zero tint over camera feed) */}
        <View
          style={{ width: frameWidth, height: frameHeight }}
          className="relative bg-transparent border border-emerald-500/30 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Top-Left Corner HUD */}
          <View className="absolute left-0 top-0 h-7 w-7 border-l-4 border-t-4 border-emerald-400 rounded-tl-xl shadow-sm" />
          {/* Top-Right Corner HUD */}
          <View className="absolute right-0 top-0 h-7 w-7 border-r-4 border-t-4 border-emerald-400 rounded-tr-xl shadow-sm" />
          {/* Bottom-Left Corner HUD */}
          <View className="absolute bottom-0 left-0 h-7 w-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl shadow-sm" />
          {/* Bottom-Right Corner HUD */}
          <View className="absolute bottom-0 right-0 h-7 w-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl shadow-sm" />

          {/* Center Subtle Alignment Crosshairs */}
          <View className="absolute inset-0 items-center justify-center pointer-events-none opacity-40">
            <View className="w-6 h-0.5 bg-emerald-400/80" />
            <View className="w-0.5 h-6 bg-emerald-400/80 absolute" />
          </View>

          {/* Glowing Neon Laser Beam */}
          <Animated.View
            style={scanLineStyle}
            className="absolute left-2 right-2 h-1 rounded-full bg-emerald-400 shadow-md shadow-emerald-400"
          >
            {/* Luminous Glow Halo */}
            <View className="absolute -top-1 -bottom-1 left-0 right-0 bg-emerald-300/30 rounded-full" />
          </Animated.View>
        </View>

        <View className="flex-1 h-full bg-black/60" />
      </View>

      {/* Bottom Dimmed Letterbox with Instructions */}
      <View className="flex-1 bg-black/60 items-center justify-start pt-5 px-6 gap-3">
        <Text className="text-center font-bold text-xs text-white/90 tracking-wide uppercase">
          {instruction}
        </Text>

        <View className="flex-row items-center rounded-full bg-black/80 border border-emerald-500/40 px-3.5 py-1.5 shadow-md">
          <ScanLine size={13} color="#22c55e" />
          <Text className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase ms-1.5">
            Auto-Detect QR / Barcode
          </Text>
        </View>
      </View>
    </View>
  );
};

