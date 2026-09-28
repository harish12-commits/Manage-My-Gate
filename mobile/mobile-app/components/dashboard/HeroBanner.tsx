import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Dimensions, TouchableOpacity, Image, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { useTranslation } from '../../src/utils/i18n';
import { Building2, ShieldCheck, Sparkles, Wallet } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = Math.min(SCREEN_WIDTH - 32, 400);
const BANNER_HEIGHT = Math.round((BANNER_WIDTH - 8) * (216 / 472));

export interface BannerItem {
  id: string;
  image: any;
  titleKey: string;
  defaultTitle: string;
  subTitleKey?: string;
  defaultSubTitle?: string;
  icon?: any;
  bgGradientClass?: string;
}

const BANNERS: BannerItem[] = [
  {
    id: '1',
    image: require('../../assets/images/banners/banner_community.png'),
    titleKey: 'banner_welcome_title',
    defaultTitle: 'Community',
    subTitleKey: 'banner_welcome_sub',
    defaultSubTitle: 'Connected harmony & security around home.',
    icon: Building2,
    bgGradientClass: 'bg-emerald-600',
  },
  {
    id: '2',
    image: require('../../assets/images/banners/banner_security.png'),
    titleKey: 'banner_qr_title',
    defaultTitle: 'Security Gate',
    subTitleKey: 'banner_qr_sub',
    defaultSubTitle: 'Create guest passes for touchless verification.',
    icon: ShieldCheck,
    bgGradientClass: 'bg-blue-600',
  },
  {
    id: '3',
    image: require('../../assets/images/banners/banner_amenities.png'),
    titleKey: 'banner_amenities_title',
    defaultTitle: 'Amenities',
    subTitleKey: 'banner_amenities_sub',
    defaultSubTitle: 'Reserve community facilities & sports courts.',
    icon: Sparkles,
    bgGradientClass: 'bg-purple-600',
  },
  {
    id: '4',
    image: require('../../assets/images/banners/banner_financial.png'),
    titleKey: 'banner_billing_title',
    defaultTitle: 'Financial Suite',
    subTitleKey: 'banner_billing_sub',
    defaultSubTitle: 'Pay maintenance dues & top up wallet.',
    icon: Wallet,
    bgGradientClass: 'bg-amber-600',
  },
];

interface HeroBannerProps {
  onBannerPress?: (banner: BannerItem) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onBannerPress }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const { t } = useTranslation();

  useEffect(() => {
    let isMounted = true;
    const timer = setInterval(() => {
      if (!isMounted) return;
      setActiveIndex((prev) => {
        if (!isMounted) return prev;
        const nextIndex = (prev + 1) % BANNERS.length;
        scrollViewRef.current?.scrollTo({
          x: nextIndex * BANNER_WIDTH,
          animated: true,
        });
        return nextIndex;
      });
    }, 4500);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleScrollEnd = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / BANNER_WIDTH);
    if (index >= 0 && index < BANNERS.length) {
      setActiveIndex(index);
    }
  };

  const handleImageError = (id: string) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  const handlePress = (banner: BannerItem) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (onBannerPress) {
      onBannerPress(banner);
    }
  };

  return (
    <View className="w-full py-1">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        decelerationRate="fast"
        snapToInterval={BANNER_WIDTH}
        snapToAlignment="center"
      >
        {BANNERS.map((banner) => {
          const isFailed = failedImages[banner.id];
          const IconComponent = banner.icon;

          return (
            <TouchableOpacity
              key={banner.id}
              activeOpacity={0.92}
              onPress={() => handlePress(banner)}
              style={{ width: BANNER_WIDTH }}
              className="px-1"
            >
              <View
                style={{
                  width: BANNER_WIDTH - 8,
                  height: BANNER_HEIGHT,
                }}
                className="rounded-3xl overflow-hidden border border-border/70 shadow-xs bg-card relative"
              >
                {!isFailed ? (
                  <Image
                    source={banner.image}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    onError={() => handleImageError(banner.id)}
                    accessibilityLabel={t(banner.titleKey, banner.defaultTitle)}
                  />
                ) : (
                  <View className={`w-full h-full p-4 flex-col justify-between ${banner.bgGradientClass || 'bg-primary'}`}>
                    <View className="flex-row items-center justify-between">
                      <View className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30">
                        {IconComponent ? <IconComponent size={24} color="#FFFFFF" /> : null}
                      </View>
                      <View className="px-2.5 py-1 rounded-full bg-white/20 border border-white/30">
                        <Text className="text-[10px] font-extrabold text-white font-sans uppercase tracking-wider">
                          NAHOM
                        </Text>
                      </View>
                    </View>
                    <View>
                      <Text className="text-lg font-black text-white font-sans tracking-tight">
                        {t(banner.titleKey, banner.defaultTitle)}
                      </Text>
                      {banner.subTitleKey ? (
                        <Text className="text-xs text-white/90 font-medium font-sans mt-0.5" numberOfLines={1}>
                          {t(banner.subTitleKey, banner.defaultSubTitle || '')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pagination Dots */}
      <View className="flex-row justify-center items-center gap-1.5 pt-1">
        {BANNERS.map((_, idx) => (
          <View
            key={idx}
            className={`h-1.5 rounded-full transition-all ${
              idx === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
            }`}
          />
        ))}
      </View>
    </View>
  );
};

export default HeroBanner;
