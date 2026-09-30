import React from 'react';
import { View, Image, ImageSourcePropType } from 'react-native';
import { Text } from '@/components/ui/text';
import { FileImage } from 'lucide-react-native';
import { cn } from '../../lib/utils';

export interface ConceptualImageReferenceProps {
  source?: ImageSourcePropType;
  altText: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export const ConceptualImageReference = ({
  source,
  altText,
  width = '100%',
  height = 200,
  className,
}: ConceptualImageReferenceProps) => {
  return (
    <View
      style={{ width: width as any, height: height as any }}
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-muted',
        className
      )}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          accessibilityLabel={altText}
        />
      ) : (
        <View className="flex-1 items-center justify-center p-4">
          <FileImage size={40} className="mb-2 text-slate-300 dark:text-slate-700" />
          <Text className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
            [Image Reference]
          </Text>
          <Text className="mt-1 text-center text-xs text-slate-400 dark:text-slate-500">
            {altText}
          </Text>
        </View>
      )}
    </View>
  );
};
