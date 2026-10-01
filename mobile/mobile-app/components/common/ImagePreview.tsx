import React, { useState } from 'react';
import { View, Image, ImageSourcePropType } from 'react-native';
import { Image as ImageIcon } from 'lucide-react-native';
import { cn } from '../../lib/utils';
import { Text } from '../ui/text';

export interface ImagePreviewProps {
  source?: ImageSourcePropType | null | any;
  altText: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export const ImagePreview = ({
  source,
  altText,
  width = '100%',
  height = 200,
  className,
}: ImagePreviewProps) => {
  const [hasError, setHasError] = useState(false);

  return (
    <View
      style={{ width: width as any, height: height as any }}
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-muted items-center justify-center',
        className
      )}
    >
      {source && !hasError ? (
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          accessibilityLabel={altText}
          onError={(e) => {
            console.error('ImagePreview load error for:', source);
            setHasError(true);
          }}
        />
      ) : (
        <View className="items-center justify-center p-4">
          <ImageIcon size={32} className="mb-1.5 text-muted-foreground/40" />
          <Text className="text-center text-xs font-medium text-muted-foreground">
            Image Preview Unavailable
          </Text>
        </View>
      )}
    </View>
  );
};
