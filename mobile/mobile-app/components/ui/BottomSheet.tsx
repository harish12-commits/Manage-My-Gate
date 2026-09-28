import {
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
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
}: AppBottomSheetProps) {
  if (!visible) return null;

  const screenHeight = Dimensions.get('window').height;
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
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
          style={{ maxHeight: sheetMaxHeight, maxWidth: '100%' }}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export {
  BottomSheet,
  bottomSheetHeaderVariants,
  bottomSheetTitleVariants,
};
