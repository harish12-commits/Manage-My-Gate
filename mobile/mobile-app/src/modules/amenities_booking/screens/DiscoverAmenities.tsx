import React, { useState, useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { Search, X, Sparkles, SlidersHorizontal, Building2 } from 'lucide-react-native';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AmenityCard } from '../components/AmenityCard';
import { FilterPills } from '../components/FilterPills';
import { MOCK_AMENITIES, MOCK_CATEGORIES } from '../data/mockAmenitiesData';
import { Amenity } from '../models/amenity.model';
import { useTranslation } from '@/src/utils/i18n';

export interface DiscoverAmenitiesProps {
  onSelectAmenity?: (amenity: Amenity) => void;
  navigation?: any;
}

export const DiscoverAmenities: React.FC<DiscoverAmenitiesProps> = ({
  onSelectAmenity,
  navigation,
}) => {
  const { translateText } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  // Filter amenities based on category pill & search query
  const filteredAmenities = useMemo(() => {
    return MOCK_AMENITIES.filter((amenity) => {
      const matchesCategory =
        selectedCategory === 'All' || amenity.category === selectedCategory;

      const matchesSearch =
        amenity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        amenity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (amenity.location && amenity.location.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  const handleCardPress = (amenity: Amenity) => {
    if (onSelectAmenity) {
      onSelectAmenity(amenity);
    } else if (navigation?.navigate) {
      navigation.navigate('AmenityDetails', { amenity });
    }
  };

  return (
    <ScreenShell
      title="Discover Amenities"
      subtitle="Book community facilities & spaces"
      headerRight={
        <View className="flex-row items-center rounded-full bg-primary/10 px-3 py-1">
          <Sparkles size={14} color="#2563eb" className="me-1" />
          <Text className="text-xs font-bold text-primary">6 Available</Text>
        </View>
      }
    >
      <View className="flex-1 bg-background">
        {/* Sticky Search & Filter Header Container */}
        <View className="border-b border-border/50 bg-background/95 pb-2">
          {/* Search Input Bar */}
          <View className="px-4 pt-2">
            <View className="min-h-[48px] flex-row items-center rounded-2xl border border-border bg-card px-3.5 shadow-sm">
              <Search size={18} color="#64748b" className="me-2.5" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={translateText('Search gym, pool, tennis, clubhouse...')}
                placeholderTextColor="#94a3b8"
                className="flex-1 text-sm font-medium text-foreground py-2 text-start"
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  className="p-1 rounded-full bg-muted"
                  accessibilityLabel="Clear search text"
                >
                  <X size={14} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Horizontally Scrolling Category Filter Pills */}
          <FilterPills
            categories={MOCK_CATEGORIES}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </View>

        {/* Catalog List Header Count */}
        <View className="flex-row items-center justify-between px-4 pt-3 pb-1">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Facilities ({filteredAmenities.length})
          </Text>
          <View className="flex-row items-center">
            <SlidersHorizontal size={12} color="#64748b" className="me-1" />
            <Text className="text-xs font-medium text-muted-foreground">
              {selectedCategory}
            </Text>
          </View>
        </View>

        {/* Vertically Scrolling Amenity Cards List */}
        <FlatList
          data={filteredAmenities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AmenityCard amenity={item} onPress={handleCardPress} />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#2563eb"
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={Building2}
              title="No Amenities Found"
              description={`We couldn't find any facilities matching "${searchQuery || selectedCategory}". Try adjusting your filters.`}
              actionLabel="Clear All Filters"
              onAction={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="py-12"
            />
          }
        />
      </View>
    </ScreenShell>
  );
};
