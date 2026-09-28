import React, { useState, useMemo } from 'react';
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput as RNTextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  X,
  MapPin,
  LocateFixed,
  ChevronRight,
  Search,
  Check,
  Globe,
  Building2,
  Navigation,
  ArrowLeft,
} from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/common/Chip';
import { SheetGrabHandle } from '@/components/ui/SheetGrabHandle';
import { useTranslation } from '@/src/utils/i18n';
import {
  COUNTRIES_DATA,
  POPULAR_LOCATIONS,
  reverseGeocodeCoords,
  CountryData,
  StateData,
} from '../data/locationData';

export interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  currentValue?: string;
  onSelectLocation: (location: string) => void;
}

type PickerStep = 'country' | 'state' | 'city';

export function LocationPickerModal({
  visible,
  onClose,
  currentValue = '',
  onSelectLocation,
}: LocationPickerModalProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<PickerStep>('country');
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [selectedState, setSelectedState] = useState<StateData | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [customCity, setCustomCity] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Initialize or reset state when opening
  React.useEffect(() => {
    if (visible) {
      setStep('country');
      setSelectedCountry(null);
      setSelectedState(null);
      setSelectedCity('');
      setCustomCity('');
      setSearchQuery('');
      setLocationError(null);
    }
  }, [visible]);

  // Handle GPS / Current Location Detection
  const handleDetectCurrentLocation = () => {
    setIsDetectingLocation(true);
    setLocationError(null);

    const handleSuccess = async (latitude: number, longitude: number) => {
      try {
        const formatted = await reverseGeocodeCoords(latitude, longitude);
        if (formatted) {
          onSelectLocation(formatted);
          onClose();
        } else {
          setLocationError(t('location_not_resolved', 'Could not resolve address details. Please choose manually.'));
        }
      } catch (err: any) {
        setLocationError(t('reverse_geo_failed', 'Unable to detect location. Please choose from the list.'));
      } finally {
        setIsDetectingLocation(false);
      }
    };

    const handleError = (error: any) => {
      console.warn('[LocationPicker] Geolocation error:', error);
      setIsDetectingLocation(false);
      let msg = t('location_permission_denied', 'Location permission denied or unavailable. Please choose from the list.');
      if (error?.message) {
        msg = `${msg} (${error.message})`;
      }
      setLocationError(msg);
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleSuccess(position.coords.latitude, position.coords.longitude);
        },
        handleError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setIsDetectingLocation(false);
      setLocationError(t('location_not_supported', 'Geolocation not supported on this device. Please select manually.'));
    }
  };

  // Direct quick search matches across all countries, states, and cities
  const directSearchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const matches: { formatted: string; country: string; state: string; city: string }[] = [];

    for (const c of COUNTRIES_DATA) {
      if (c.name.toLowerCase().includes(q)) {
        matches.push({
          formatted: `${c.name}`,
          country: c.name,
          state: '',
          city: '',
        });
      }
      for (const s of c.states) {
        if (s.name.toLowerCase().includes(q)) {
          matches.push({
            formatted: `${s.name}, ${c.name}`,
            country: c.name,
            state: s.name,
            city: '',
          });
        }
        for (const city of s.cities) {
          if (city.toLowerCase().includes(q)) {
            matches.push({
              formatted: `${city}, ${s.name}, ${c.name}`,
              country: c.name,
              state: s.name,
              city,
            });
          }
          if (matches.length >= 25) break;
        }
        if (matches.length >= 25) break;
      }
      if (matches.length >= 25) break;
    }

    return matches;
  }, [searchQuery]);

  // Step 1: Filtered Countries
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return COUNTRIES_DATA;
    return COUNTRIES_DATA.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Step 2: Filtered States
  const filteredStates = useMemo(() => {
    if (!selectedCountry) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return selectedCountry.states;
    return selectedCountry.states.filter((s) => s.name.toLowerCase().includes(q));
  }, [selectedCountry, searchQuery]);

  // Step 3: Filtered Cities
  const filteredCities = useMemo(() => {
    if (!selectedState) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return selectedState.cities;
    return selectedState.cities.filter((city) => city.toLowerCase().includes(q));
  }, [selectedState, searchQuery]);

  const handleSelectCountry = (country: CountryData) => {
    setSelectedCountry(country);
    setSelectedState(null);
    setSelectedCity('');
    setSearchQuery('');
    setStep('state');
  };

  const handleSelectState = (state: StateData) => {
    setSelectedState(state);
    setSelectedCity('');
    setSearchQuery('');
    setStep('city');
  };

  const handleSelectCity = (city: string) => {
    setSelectedCity(city);
    const finalLocation = `${city}, ${selectedState?.name}, ${selectedCountry?.name}`;
    onSelectLocation(finalLocation);
    onClose();
  };

  const handleConfirmCustomCity = () => {
    const city = customCity.trim() || selectedCity.trim();
    if (!city) return;
    const finalLocation = `${city}, ${selectedState?.name}, ${selectedCountry?.name}`;
    onSelectLocation(finalLocation);
    onClose();
  };

  const handleSelectQuickLocation = (loc: string) => {
    onSelectLocation(loc);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        className="flex-1 justify-end bg-black/60"
      >
        <Pressable className="absolute inset-0" onPress={onClose} />

        <View className="bg-card rounded-t-3xl border-t border-border overflow-hidden max-h-[90%] shadow-2xl">
          <SheetGrabHandle onClose={onClose} />

          {/* Modal Header */}
          <View className="px-5 pt-1 pb-3 flex-row items-center justify-between border-b border-border/60">
            <View className="flex-row items-center gap-2.5 flex-1 me-2">
              {step !== 'country' ? (
                <Pressable
                  onPress={() => {
                    if (step === 'city') setStep('state');
                    else if (step === 'state') setStep('country');
                  }}
                  className="p-1.5 rounded-xl bg-secondary/80 active:bg-secondary border border-border/60"
                  accessibilityLabel="Go Back"
                >
                  <ArrowLeft size={16} className="text-foreground" />
                </Pressable>
              ) : (
                <View className="size-8 rounded-xl bg-primary/10 items-center justify-center border border-primary/20">
                  <MapPin size={18} className="text-primary" />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-bold text-foreground">
                  {step === 'country' && t('select_country', 'Select Country')}
                  {step === 'state' && `${selectedCountry?.flag || ''} ${t('select_state', 'Select State / Region')}`}
                  {step === 'city' && t('select_city', 'Select City / Area')}
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {step === 'country' && t('choose_country_desc', 'Select your country or use current GPS')}
                  {step === 'state' && `${selectedCountry?.name}`}
                  {step === 'city' && `${selectedState?.name}, ${selectedCountry?.name}`}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              className="size-8 rounded-full bg-secondary/80 items-center justify-center active:bg-secondary border border-border/60"
              accessibilityLabel="Close"
            >
              <X size={16} className="text-muted-foreground" />
            </Pressable>
          </View>

          {/* Breadcrumb Steps Navigation */}
          <View className="flex-row items-center px-5 py-2 bg-muted/20 border-b border-border/40 gap-1.5">
            <Pressable
              onPress={() => setStep('country')}
              className={`px-2.5 py-1 rounded-lg ${step === 'country' ? 'bg-primary/15 border border-primary/30' : 'bg-transparent'}`}
            >
              <Text className={`text-xs font-semibold ${step === 'country' ? 'text-primary' : 'text-muted-foreground'}`}>
                1. {selectedCountry ? selectedCountry.name : t('country', 'Country')}
              </Text>
            </Pressable>

            <ChevronRight size={12} className="text-muted-foreground/60" />

            <Pressable
              disabled={!selectedCountry}
              onPress={() => setStep('state')}
              className={`px-2.5 py-1 rounded-lg ${step === 'state' ? 'bg-primary/15 border border-primary/30' : 'bg-transparent'}`}
            >
              <Text className={`text-xs font-semibold ${step === 'state' ? 'text-primary' : selectedCountry ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                2. {selectedState ? selectedState.name : t('state', 'State')}
              </Text>
            </Pressable>

            <ChevronRight size={12} className="text-muted-foreground/60" />

            <View className={`px-2.5 py-1 rounded-lg ${step === 'city' ? 'bg-primary/15 border border-primary/30' : 'bg-transparent'}`}>
              <Text className={`text-xs font-semibold ${step === 'city' ? 'text-primary' : 'text-muted-foreground/40'}`}>
                3. {selectedCity ? selectedCity : t('city', 'City')}
              </Text>
            </View>
          </View>

          {/* 1-Tap "Use Current Location" Action Button */}
          <View className="px-5 pt-3 pb-2">
            <Pressable
              onPress={handleDetectCurrentLocation}
              disabled={isDetectingLocation}
              className="flex-row items-center justify-between p-3 rounded-2xl bg-primary/10 border border-primary/30 active:bg-primary/20 shadow-2xs"
            >
              <View className="flex-row items-center gap-2.5 flex-1 me-2">
                <View className="size-9 rounded-xl bg-primary/20 items-center justify-center border border-primary/30">
                  {isDetectingLocation ? (
                    <ActivityIndicator size="small" color="#EA580C" />
                  ) : (
                    <LocateFixed size={18} className="text-primary" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-foreground">
                    {t('use_current_location', 'Use Current Location')}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {isDetectingLocation
                      ? t('detecting_location', 'Detecting GPS and city...')
                      : t('auto_detect_location', 'Auto-detect city, state & country')}
                  </Text>
                </View>
              </View>
              <Navigation size={15} className="text-primary shrink-0" />
            </Pressable>

            {locationError && (
              <View className="mt-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl">
                <Text className="text-xs text-destructive font-medium">{locationError}</Text>
              </View>
            )}
          </View>

          {/* Quick Popular Locations Section */}
          <View className="px-5 py-2">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              {t('popular_locations', 'Popular Locations')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5 pb-1">
              {POPULAR_LOCATIONS.slice(0, 8).map((loc) => {
                const cityName = loc.split(',')[0];
                const isSelected = currentValue === loc;
                return (
                  <Chip
                    key={loc}
                    label={cityName}
                    selected={isSelected}
                    shape="pill"
                    onPress={() => handleSelectQuickLocation(loc)}
                    className="me-1.5"
                  />
                );
              })}
            </ScrollView>
          </View>

          {/* Search Bar */}
          <View className="px-5 py-2">
            <View className="flex-row items-center bg-secondary/60 rounded-xl border border-border/80 px-3 py-2">
              <Search size={16} className="text-muted-foreground me-2" />
              <RNTextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={
                  step === 'country'
                    ? t('search_country_or_city', 'Search country, state or city...')
                    : step === 'state'
                    ? t('search_state', 'Search state / province...')
                    : t('search_city', 'Search city / locality...')
                }
                placeholderTextColor="#9ca3af"
                className="flex-1 text-sm text-foreground py-0.5 outline-none font-medium"
                autoCapitalize="none"
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')} className="p-1">
                  <X size={14} className="text-muted-foreground" />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Main List Content */}
          <ScrollView
            className="flex-1 px-5 py-2 max-h-[360px]"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {/* If searching globally and has direct multi-tier matches */}
            {searchQuery.trim().length >= 2 && directSearchMatches.length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                  {t('search_results', 'Instant Location Results')} ({directSearchMatches.length})
                </Text>
                <View className="gap-1.5">
                  {directSearchMatches.map((item, idx) => (
                    <Pressable
                      key={`${item.formatted}-${idx}`}
                      onPress={() => handleSelectQuickLocation(item.formatted)}
                      className="flex-row items-center justify-between p-3 rounded-xl bg-card border border-border/70 active:bg-secondary/60"
                    >
                      <View className="flex-row items-center gap-2.5 flex-1 me-2">
                        <MapPin size={15} className="text-primary shrink-0" />
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                            {item.city || item.state || item.country}
                          </Text>
                          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                            {item.formatted}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={15} className="text-muted-foreground" />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* STEP 1: Country Selection */}
            {step === 'country' && (
              <View className="gap-1.5 pb-4">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {t('all_countries', 'All Countries')} ({filteredCountries.length})
                </Text>
                {filteredCountries.map((c) => {
                  const isSelected = selectedCountry?.code === c.code;
                  return (
                    <Pressable
                      key={c.code}
                      onPress={() => handleSelectCountry(c)}
                      className={`flex-row items-center justify-between p-3 rounded-xl border ${
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border/70 active:bg-secondary/60'
                      }`}
                    >
                      <View className="flex-row items-center gap-3">
                        <Text className="text-lg">{c.flag}</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {c.name}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-xs text-muted-foreground font-medium">
                          {c.states.length} {t('states', 'regions')}
                        </Text>
                        <ChevronRight size={15} className="text-muted-foreground" />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* STEP 2: State Selection */}
            {step === 'state' && selectedCountry && (
              <View className="gap-1.5 pb-4">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {selectedCountry.flag} {selectedCountry.name} {t('states_provinces', 'States / Provinces')}
                  </Text>
                  <Text className="text-xs text-muted-foreground font-medium">
                    {filteredStates.length} {t('available', 'available')}
                  </Text>
                </View>

                {filteredStates.map((s) => {
                  const isSelected = selectedState?.name === s.name;
                  return (
                    <Pressable
                      key={s.name}
                      onPress={() => handleSelectState(s)}
                      className={`flex-row items-center justify-between p-3 rounded-xl border ${
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border/70 active:bg-secondary/60'
                      }`}
                    >
                      <View className="flex-row items-center gap-2.5">
                        <Building2 size={16} className="text-muted-foreground" />
                        <Text className="text-sm font-semibold text-foreground">
                          {s.name}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-xs text-muted-foreground font-medium">
                          {s.cities.length} {t('cities', 'cities')}
                        </Text>
                        <ChevronRight size={15} className="text-muted-foreground" />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* STEP 3: City Selection + Custom City input */}
            {step === 'city' && selectedState && selectedCountry && (
              <View className="gap-2.5 pb-4">
                <View className="p-3 bg-secondary/50 rounded-xl border border-border/80">
                  <Text className="text-xs font-bold text-foreground mb-1">
                    {t('enter_custom_city', 'Enter Specific City / Town / Locality')}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    <RNTextInput
                      value={customCity}
                      onChangeText={setCustomCity}
                      placeholder={t('eg_locality', 'e.g. Indiranagar, Whitefield, Downtown')}
                      placeholderTextColor="#9ca3af"
                      className="flex-1 bg-card rounded-xl px-3 py-2 text-sm text-foreground border border-border"
                    />
                    <Button
                      size="sm"
                      variant="default"
                      disabled={!customCity.trim()}
                      onPress={handleConfirmCustomCity}
                      className="px-3"
                    >
                      <Text className="text-xs font-bold text-white">{t('apply', 'Apply')}</Text>
                    </Button>
                  </View>
                </View>

                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
                  {t('popular_cities_in', 'Major Cities in')} {selectedState.name}
                </Text>

                <View className="gap-1.5">
                  {filteredCities.map((city) => {
                    const isSelected = selectedCity === city;
                    return (
                      <Pressable
                        key={city}
                        onPress={() => handleSelectCity(city)}
                        className={`flex-row items-center justify-between p-3 rounded-xl border ${
                          isSelected
                            ? 'bg-primary/10 border-primary'
                            : 'bg-card border-border/70 active:bg-secondary/60'
                        }`}
                      >
                        <View className="flex-row items-center gap-2.5">
                          <MapPin size={16} className="text-primary" />
                          <Text className="text-sm font-semibold text-foreground">
                            {city}
                          </Text>
                        </View>
                        {isSelected ? (
                          <Check size={16} className="text-primary" />
                        ) : (
                          <ChevronRight size={15} className="text-muted-foreground" />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer action row if a selection is in progress */}
          <View className="p-4 border-t border-border/60 bg-card flex-row items-center justify-between gap-2">
            <Button
              variant="outline"
              size="default"
              onPress={onClose}
              className="flex-1 rounded-xl"
            >
              <Text className="text-sm font-semibold text-foreground">{t('cancel', 'Cancel')}</Text>
            </Button>

            {currentValue ? (
              <Button
                variant="secondary"
                size="default"
                onPress={() => {
                  onSelectLocation(currentValue);
                  onClose();
                }}
                className="flex-1 rounded-xl"
              >
                <Text className="text-sm font-semibold text-foreground">{t('keep_current', 'Keep Current')}</Text>
              </Button>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default LocationPickerModal;
