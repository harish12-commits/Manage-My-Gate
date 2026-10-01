import {
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
  Platform,
  Keyboard,
} from 'react-native';
import { Text } from './text';
import { X } from 'lucide-react-native';
import { cva } from 'class-variance-authority';

import { SheetGrabHandle } from './SheetGrabHandle';
import { KeyboardAwareScrollView } from '../layout/KeyboardAwareScrollView';

export interface AppBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  enableDynamicSizing?: boolean;
  contentContainerStyle?: any;
}

const bottomSheetHeaderVariants = cva(
  'w-full pb-2.5 border-b border-border/80 items-center justify-between flex-row px-5 py-3.5'
);

const bottomSheetTitleVariants = cva(
  'text-[17px] font-bold font-sans text-foreground tracking-tight'
);

const bottomSheetContentVariants = cva('px-4 pb-6');

function BottomSheet({
  visible,
  onClose,
  title,
  children,
  contentContainerStyle,
  footer,
}: AppBottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  if (!visible) return null;

  const sheetMaxHeight = Platform.OS === 'web'
    ? Math.min(Math.round(screenHeight * 0.85), 680)
    : Math.round(screenHeight * 0.88);
  const scrollMaxHeight = sheetMaxHeight - 65;

  const handleClose = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View
        style={{ flex: 1 }}
        className="flex-1 justify-end items-center"
      >
        {/* Backdrop */}
        <Pressable 
          className="absolute inset-0 bg-black/60" 
          onPress={handleClose} 
        />
        
        {/* Content Box */}
        <View
          style={{ height: sheetMaxHeight, maxWidth: '100%' }}
          className="bg-card border-t border-border/80 rounded-t-3xl sm:rounded-3xl sm:border sm:mb-4 shadow-2xl overflow-hidden flex-col w-full max-w-md mx-auto"
        >
          {/* Top grab handle */}
          <SheetGrabHandle onClose={onClose} />

          {/* Title Header with Close X */}
          {Boolean(title) && (
            <View className={bottomSheetHeaderVariants()}>
              <Text className={bottomSheetTitleVariants()}>{title}</Text>
              <TouchableOpacity
                onPress={handleClose}
                activeOpacity={0.7}
                className="p-1.5 rounded-full bg-secondary border border-border/60"
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={16} className="text-foreground" />
              </TouchableOpacity>
            </View>
          )}

          {/* Scrollable Body Content */}
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            extraScrollHeight={48}
            contentContainerStyle={[
              { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48, flexGrow: 1 },
              contentContainerStyle,
            ]}
            showsVerticalScrollIndicator={true}
            bounces={true}
            alwaysBounceVertical={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            {children}
          </KeyboardAwareScrollView>
          {footer && (
            <View className="pb-8 pt-3 px-4 border-t border-border/80 bg-card">
              {footer}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export {
  BottomSheet,
  bottomSheetHeaderVariants,
  bottomSheetTitleVariants,
};
