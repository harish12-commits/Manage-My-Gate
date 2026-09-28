import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';
import { I18nManager } from 'react-native';
import storage from '../storage';

import en from './en';
import ar from './ar';
import ta from './ta';
import hi from './hi';
import ml from './ml';
import te from './te';
import kn from './kn';

// Strictly lock LTR layout across all languages
try {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
} catch (e) {}

export type LanguageCode = 'en' | 'ta' | 'hi' | 'ml' | 'te' | 'kn' | 'ar' | string;

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeName: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English (US)', nativeName: 'English (US)' },
  { code: 'ar', label: 'العربية (Arabic)', nativeName: 'العربية' },
  { code: 'ta', label: 'தமிழ் (Tamil)', nativeName: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी (Hindi)', nativeName: 'हिन्दी' },
  { code: 'ml', label: 'മലയാളം (Malayalam)', nativeName: 'മലയാളം' },
  { code: 'te', label: 'తెలుగు (Telugu)', nativeName: 'తెలుగు' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', nativeName: 'ಕನ್ನಡ' },
];

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en,
  ar,
  ta,
  hi,
  ml,
  te,
  kn,
};

// Global bidirectional reverse-index (phrase -> canonical key)
const reverseLookupMap = new Map<string, string>();

function buildReverseMap() {
  reverseLookupMap.clear();
  for (const [langCode, dict] of Object.entries(TRANSLATIONS)) {
    if (!dict) continue;
    for (const [key, val] of Object.entries(dict)) {
      if (typeof val === 'string') {
        const cleanVal = val.trim().toLowerCase();
        if (cleanVal && !reverseLookupMap.has(cleanVal)) {
          reverseLookupMap.set(cleanVal, key);
        }
        const strippedVal = cleanVal.replace(/[.?]+$/, '');
        if (strippedVal && !reverseLookupMap.has(strippedVal)) {
          reverseLookupMap.set(strippedVal, key);
        }
      }
      // Also index key variants (e.g. "status_published" -> index "published" and "status_published")
      const cleanKey = key.toLowerCase();
      if (!reverseLookupMap.has(cleanKey)) {
        reverseLookupMap.set(cleanKey, key);
      }
      const strippedKey = cleanKey
        .replace(/^(status|priority|cat|role|feature)_/, '')
        .replace(/_name$|_sub$|_desc$/, '');
      if (strippedKey && !reverseLookupMap.has(strippedKey)) {
        reverseLookupMap.set(strippedKey, key);
      }
      const spaceKey = strippedKey.replace(/_/g, ' ');
      if (spaceKey && !reverseLookupMap.has(spaceKey)) {
        reverseLookupMap.set(spaceKey, key);
      }
    }
  }
}

// Build index on module load
buildReverseMap();

let currentLanguageCode: LanguageCode = 'en';
const listeners = new Set<(lang: LanguageCode) => void>();
const warnedKeys = new Set<string>();

export const registerLanguage = (
  code: string,
  label: string,
  nativeName: string,
  dictionary: Record<string, string>
) => {
  TRANSLATIONS[code] = dictionary;
  if (!LANGUAGE_OPTIONS.some((opt) => opt.code === code)) {
    LANGUAGE_OPTIONS.push({ code, label, nativeName });
  }
  buildReverseMap();
  listeners.forEach((fn) => fn(currentLanguageCode));
};

export const i18n = {
  getCurrentLanguage: (): LanguageCode => currentLanguageCode,

  hasKey: (key?: string): boolean => {
    if (!key) return false;
    const dict = TRANSLATIONS[currentLanguageCode] || TRANSLATIONS.en;
    return Boolean(dict && dict[key]);
  },

  subscribe: (listener: (lang: LanguageCode) => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setLanguage: async (code: LanguageCode): Promise<void> => {
    if (currentLanguageCode === code) return;
    currentLanguageCode = code;
    try {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    } catch (e) {}

    if (typeof document !== 'undefined') {
      try {
        document.documentElement.setAttribute('dir', 'ltr');
        document.documentElement.setAttribute('lang', code);
        document.documentElement.setAttribute('data-lang', code);
        document.documentElement.style.direction = 'ltr';
        if (document.body) {
          document.body.setAttribute('dir', 'ltr');
          document.body.setAttribute('lang', code);
          document.body.setAttribute('data-lang', code);
          document.body.style.direction = 'ltr';
        }
      } catch (e) {}
    }

    listeners.forEach((fn) => fn(code));

    try {
      await storage.setItem('language_preference', code);
    } catch (e) {
      console.warn('Failed to save language preference:', e);
    }
  },

  initLanguage: async (): Promise<LanguageCode> => {
    try {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    } catch (e) {}
    try {
      const saved = await storage.getItem('language_preference');
      if (
        saved &&
        (saved === 'en' ||
          saved === 'ar' ||
          saved === 'ta' ||
          saved === 'hi' ||
          saved === 'ml' ||
          saved === 'te' ||
          saved === 'kn')
      ) {
        currentLanguageCode = saved as LanguageCode;
      }
    } catch (e) {
      console.warn('Failed to init language preference:', e);
    }
    if (typeof document !== 'undefined') {
      try {
        document.documentElement.setAttribute('dir', 'ltr');
        document.documentElement.setAttribute('lang', currentLanguageCode);
        document.documentElement.setAttribute('data-lang', currentLanguageCode);
        document.documentElement.style.direction = 'ltr';
        if (document.body) {
          document.body.setAttribute('dir', 'ltr');
          document.body.setAttribute('lang', currentLanguageCode);
          document.body.setAttribute('data-lang', currentLanguageCode);
          document.body.style.direction = 'ltr';
        }
      } catch (e) {}
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const enKeys = Object.keys(en);
      const targetLanguages: LanguageCode[] = ['ar', 'ta', 'hi', 'ml', 'te', 'kn'];
      targetLanguages.forEach((l) => {
        const missing = enKeys.filter((k) => !TRANSLATIONS[l][k]);
        if (missing.length > 0) {
          console.warn(`[i18n Parity Warning] Language "${l}" missing ${missing.length} keys:`, missing.slice(0, 5));
        }
      });
    }
    return currentLanguageCode;
  },

  t: (
    key: string,
    fallbackOrParams?: string | Record<string, any>,
    params?: Record<string, any>
  ): string => {
    let fallback: string | undefined;
    let interpolationParams: Record<string, any> | undefined;

    if (typeof fallbackOrParams === 'object' && fallbackOrParams !== null) {
      interpolationParams = fallbackOrParams;
      fallback = undefined;
    } else {
      fallback = fallbackOrParams;
      interpolationParams = params;
    }

    const dict = TRANSLATIONS[currentLanguageCode] || TRANSLATIONS.en;
    let text = dict[key];

    if (!text) {
      // 1. Direct normalization fallback (e.g., dot notation "common.status.available" -> "status_available" or "available")
      const dotToUnderscore = key.toLowerCase().replace(/\./g, '_').replace(/^_+|_+$/g, '');
      const cleanNormalized = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const suffixOnly = key.includes('.') ? key.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') : '';
      const statusKey = `status_${cleanNormalized.replace(/^status_|^common_status_/, '')}`;

      if (dict[dotToUnderscore]) {
        text = dict[dotToUnderscore];
      } else if (dict[cleanNormalized]) {
        text = dict[cleanNormalized];
      } else if (dict[statusKey]) {
        text = dict[statusKey];
      } else if (suffixOnly && dict[suffixOnly]) {
        text = dict[suffixOnly];
      } else if (fallback) {
        text = i18n.translateText(fallback);
      } else {
        text = TRANSLATIONS.en[key] || TRANSLATIONS.en[cleanNormalized] || key;
      }

      if (
        !dict[key] &&
        !dict[dotToUnderscore] &&
        !dict[cleanNormalized] &&
        !dict[statusKey] &&
        !fallback &&
        /^[a-zA-Z0-9_.-]+$/.test(key) &&
        typeof __DEV__ !== 'undefined' &&
        __DEV__ &&
        currentLanguageCode !== 'en'
      ) {
        const warnTag = `${currentLanguageCode}:${key}`;
        if (!warnedKeys.has(warnTag)) {
          warnedKeys.add(warnTag);
          console.warn(`[i18n Dev Warning] Missing translation key "${key}" in "${currentLanguageCode}"`);
        }
      }
    }

    if (interpolationParams && text) {
      Object.keys(interpolationParams).forEach((pKey) => {
        const val = interpolationParams[pKey];
        text = text.replace(new RegExp(`\\{${pKey}\\}|\\{\\{${pKey}\\}\\}`, 'g'), String(val));
      });
    }

    return text;
  },

  tRole: (role?: string, fallback?: string): string => {
    if (!role) return fallback || 'Resident';
    const cleanRole = String(role).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const roleKey = `role_${cleanRole}`;
    const dict = TRANSLATIONS[currentLanguageCode] || TRANSLATIONS.en;
    if (dict) {
      if (dict[roleKey]) return dict[roleKey];
      if (dict[cleanRole]) return dict[cleanRole];
    }
    return fallback ? i18n.translateText(fallback) : String(role);
  },

  tFeatureName: (id?: string, fallback?: string): string => {
    if (!id) return fallback || '';
    const cleanId = String(id).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const dict = TRANSLATIONS[currentLanguageCode] || TRANSLATIONS.en;
    if (dict) {
      if (dict[`feature_${cleanId}_name`]) return dict[`feature_${cleanId}_name`];
      if (dict[`feature_${cleanId}`]) return dict[`feature_${cleanId}`];
      if (dict[cleanId]) return dict[cleanId];
    }
    return fallback ? i18n.translateText(fallback) : (fallback || cleanId);
  },

  tFeatureSubtitle: (id?: string, fallback?: string): string => {
    if (!id) return fallback || '';
    const cleanId = String(id).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const dict = TRANSLATIONS[currentLanguageCode] || TRANSLATIONS.en;
    if (dict) {
      if (dict[`feature_${cleanId}_sub`]) return dict[`feature_${cleanId}_sub`];
      if (dict[`feature_${cleanId}_desc`]) return dict[`feature_${cleanId}_desc`];
      if (dict[`${cleanId}_desc`]) return dict[`${cleanId}_desc`];
      if (dict[`${cleanId}_sub`]) return dict[`${cleanId}_sub`];
      if (dict[cleanId]) return dict[cleanId];
    }
    return fallback ? i18n.translateText(fallback) : '';
  },

  tCategoryName: (key?: string, fallback?: string): string => {
    if (!key) return fallback || '';
    const cleanKey = String(key).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const dict = TRANSLATIONS[currentLanguageCode] || TRANSLATIONS.en;
    if (dict) {
      if (dict[`cat_${cleanKey}`]) return dict[`cat_${cleanKey}`];
      if (dict[cleanKey]) return dict[cleanKey];
    }
    return fallback ? i18n.translateText(fallback) : cleanKey;
  },

  /**
   * Universal multi-way text translator.
   * Matches raw text in ANY language via pre-computed reverse index and renders the active target language.
   */
  translateText: (rawText?: string): string => {
    if (!rawText || typeof rawText !== 'string') {
      return rawText || '';
    }

    const trimmed = rawText.trim();
    if (!trimmed) return rawText;

    // 0. Language display names protection: Never translate language options / native names
    const cleanLower = trimmed.toLowerCase();
    const isLanguageOption = LANGUAGE_OPTIONS.some(
      (opt) =>
        opt.label.toLowerCase() === cleanLower ||
        opt.nativeName.toLowerCase() === cleanLower ||
        opt.code.toLowerCase() === cleanLower ||
        `${opt.nativeName} (${opt.label})`.toLowerCase() === cleanLower
    );
    if (
      isLanguageOption ||
      cleanLower === 'english' ||
      cleanLower === 'english (us)' ||
      cleanLower === 'english (uk)' ||
      cleanLower === 'arabic' ||
      cleanLower === 'العربية' ||
      cleanLower === 'العربية (arabic)' ||
      cleanLower === 'tamil' ||
      cleanLower === 'தமிழ்' ||
      cleanLower === 'தமிழ் (tamil)' ||
      cleanLower === 'hindi' ||
      cleanLower === 'हिन्दी' ||
      cleanLower === 'हिन्दी (hindi)' ||
      cleanLower === 'malayalam' ||
      cleanLower === 'മലയാളം' ||
      cleanLower === 'മലയാളം (malayalam)' ||
      cleanLower === 'telugu' ||
      cleanLower === 'తెలుగు' ||
      cleanLower === 'తెలుగు (telugu)' ||
      cleanLower === 'kannada' ||
      cleanLower === 'ಕನ್ನಡ' ||
      cleanLower === 'ಕನ್ನಡ (kannada)'
    ) {
      const matchedOpt = LANGUAGE_OPTIONS.find(
        (opt) =>
          opt.label.toLowerCase() === cleanLower ||
          opt.nativeName.toLowerCase() === cleanLower ||
          opt.code.toLowerCase() === cleanLower
      );
      return matchedOpt ? matchedOpt.label : rawText;
    }

    const dict = TRANSLATIONS[currentLanguageCode] || TRANSLATIONS.en;
    if (!dict) return rawText;

    // 1. Exact direct key match
    if (dict[trimmed]) {
      return dict[trimmed];
    }

    // 2. Normalized key match (e.g. "active_quick_actions")
    if (!trimmed.includes(':')) {
      const normalizedKey = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (dict[normalizedKey]) {
        return dict[normalizedKey];
      }

      // Direct taxonomy prefix checks
      if (dict[`status_${normalizedKey}`]) return dict[`status_${normalizedKey}`];
      if (dict[`priority_${normalizedKey}`]) return dict[`priority_${normalizedKey}`];
      if (dict[`cat_${normalizedKey}`]) return dict[`cat_${normalizedKey}`];
      if (dict[`role_${normalizedKey}`]) return dict[`role_${normalizedKey}`];
      if (dict[`feature_${normalizedKey}_name`]) return dict[`feature_${normalizedKey}_name`];
      if (dict[`feature_${normalizedKey}`]) return dict[`feature_${normalizedKey}`];
    } else {
      // Compound key-value pairs (e.g. "Status: CONFIRMED", "Payment: PAID", "Search: text")
      const colonMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        const prefix = colonMatch[1].trim();
        const value = colonMatch[2].trim();
        if (currentLanguageCode === 'en') {
          return rawText;
        }
        const translatedPrefix = i18n.translateText(prefix);
        const translatedValue = i18n.translateText(value);
        return `${translatedPrefix}: ${translatedValue}`;
      }
    }

    // 3. Bidirectional multi-way match across ALL languages (English, Arabic, Tamil, Hindi, etc.)
    const resolvedKey =
      reverseLookupMap.get(cleanLower) ||
      reverseLookupMap.get(cleanLower.replace(/[.?]+$/, ''));
    if (resolvedKey) {
      if (dict[resolvedKey]) {
        return dict[resolvedKey];
      }
      if (TRANSLATIONS.en?.[resolvedKey]) {
        return TRANSLATIONS.en[resolvedKey];
      }
    }

    // 4. Known compound phrases (e.g. "Villa A-104", "الفيلا A-104", "Flat 404-B", "Building B")
    const villaPrefixMatch = trimmed.match(/^(Villa|Unit|Flat|Building|الفيلا|الوحدة|الشقة|المبنى)\s+(.+)$/i);
    if (villaPrefixMatch) {
      const prefix = villaPrefixMatch[1].toLowerCase();
      const unitCode = villaPrefixMatch[2];
      const prefixKey = reverseLookupMap.get(prefix);
      const translatedPrefix = (prefixKey && dict[prefixKey]) || dict[prefix] || villaPrefixMatch[1];
      return `${translatedPrefix} ${unitCode}`;
    }

    // 5. Dynamic compound pattern: Waiting Xm
    const waitingMatch = trimmed.match(/^(Waiting|قيد الانتظار|காத்திருக்கிறது|प्रतीक्षारत)\s+(\d+)\s*(m|min|mins)?$/i);
    if (waitingMatch) {
      const num = waitingMatch[2];
      const waitingWord = dict.waiting || 'Waiting';
      const minsUnit = dict.mins_unit || 'm';
      return `${waitingWord} ${num}${minsUnit}`;
    }

    // 6. Dynamic compound pattern: Max X persons
    const maxPersonsMatch = trimmed.match(/^(Max|الحد الأقصى|அதிகபட்சம்|अधिकतम)\s+(\d+)\s*(persons|person|أشخاص|நபர்கள்|व्यक्ति)?$/i);
    if (maxPersonsMatch) {
      const num = maxPersonsMatch[2];
      const maxWord = dict.max || 'Max';
      const personsWord = dict.persons || 'persons';
      return `${maxWord} ${num} ${personsWord}`;
    }

    // 7. Dynamic compound pattern: Xm slots
    const slotsMatch = trimmed.match(/^(\d+)\s*(m|min|mins)\s+(slots|slot|فترات|இடங்கள்|स्लॉट)$/i);
    if (slotsMatch) {
      const num = slotsMatch[1];
      const minsUnit = dict.mins_unit || 'm';
      const slotsWord = dict.slots || 'slots';
      return `${num}${minsUnit} ${slotsWord}`;
    }

    // 8. Dynamic compound pattern: Welcome to <Community Name>
    const welcomeMatch = trimmed.match(/^(Welcome to|مرحباً بكم في|مرحبا بكم في|வரவேற்கிறோம்|में आपका स्वागत है|స్వాగతం|ലേക്ക് സ്വാഗതം|ಗೆ ಸ್ವಾಗತ)\s+(.+)$/i);
    if (welcomeMatch) {
      const communityName = welcomeMatch[2];
      const welcomePrefix = dict.welcome_to || dict.welcome || 'Welcome to';
      return currentLanguageCode === 'hi'
        ? `${communityName} ${welcomePrefix}`
        : `${welcomePrefix} ${communityName}`;
    }

    if (currentLanguageCode === 'en') {
      return rawText;
    }

    return rawText;
  },
};

export interface I18nContextType {
  language: LanguageCode;
  languageCode: LanguageCode;
  t: (key: string, fallbackOrParams?: string | Record<string, any>, params?: Record<string, any>) => string;
  translateText: (rawText?: string) => string;
  tRole: (role?: string, fallback?: string) => string;
  tFeatureName: (id?: string, fallback?: string) => string;
  tFeatureSubtitle: (id?: string, fallback?: string) => string;
  tCategoryName: (key?: string, fallback?: string) => string;
  setLanguage: (code: LanguageCode) => Promise<void>;
  hasKey: (key?: string) => boolean;
  isRTL: boolean;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<LanguageCode>(i18n.getCurrentLanguage());

  useEffect(() => {
    return i18n.subscribe((newLang) => {
      setLang(newLang);
    });
  }, []);

  const value = useMemo<I18nContextType>(
    () => ({
      language: lang,
      languageCode: lang,
      t: (k, f, p) => i18n.t(k, f, p),
      translateText: (text) => i18n.translateText(text),
      tRole: (r, f) => i18n.tRole(r, f),
      tFeatureName: (id, f) => i18n.tFeatureName(id, f),
      tFeatureSubtitle: (id, f) => i18n.tFeatureSubtitle(id, f),
      tCategoryName: (k, f) => i18n.tCategoryName(k, f),
      setLanguage: i18n.setLanguage,
      hasKey: i18n.hasKey,
      isRTL: lang === 'ar',
    }),
    [lang]
  );

  return React.createElement(I18nContext.Provider, { value }, children);
};

export const useTranslation = (): I18nContextType => {
  const context = useContext(I18nContext);
  const [localLang, setLocalLang] = useState<LanguageCode>(i18n.getCurrentLanguage());

  useEffect(() => {
    if (!context) {
      return i18n.subscribe((newLang) => {
        setLocalLang(newLang);
      });
    }
  }, [context]);

  if (context) {
    return context;
  }

  // Fallback for components mounted outside I18nProvider
  return {
    language: localLang,
    languageCode: localLang,
    t: (k: string, f?: any, p?: any) => i18n.t(k, f, p),
    translateText: (text?: string) => i18n.translateText(text),
    tRole: (r?: string, f?: string) => i18n.tRole(r, f),
    tFeatureName: (id?: string, f?: string) => i18n.tFeatureName(id, f),
    tFeatureSubtitle: (id?: string, f?: string) => i18n.tFeatureSubtitle(id, f),
    tCategoryName: (k?: string, f?: string) => i18n.tCategoryName(k, f),
    setLanguage: i18n.setLanguage,
    hasKey: i18n.hasKey,
    isRTL: localLang === 'ar',
  };
};

export const STATUS_KEY_MAP: Record<string, string> = {
  active: 'status_active',
  available: 'status_available',
  unavailable: 'status_unavailable',
  pending: 'status_pending',
  approved: 'status_approved',
  rejected: 'status_rejected',
  revoked: 'status_revoked',
  expired: 'status_expired',
  open: 'status_open',
  in_progress: 'status_in_progress',
  'in progress': 'status_in_progress',
  assigned: 'status_assigned',
  resolved: 'status_resolved',
  closed: 'status_closed',
  paid: 'status_paid',
  unpaid: 'status_unpaid',
  overdue: 'status_overdue',
  partial: 'status_partial',
  cancelled: 'status_cancelled',
  general: 'cat_all',
  maintenance: 'cat_maintenance',
  management: 'cat_management',
  security: 'cat_security',
  staff: 'cat_staff',
  resident: 'cat_resident',
};

export const getStatusTranslationKey = (status?: string): string => {
  if (!status) return 'status';
  const clean = String(status).toLowerCase().trim().replace(/[\s\/-]+/g, '_');
  return STATUS_KEY_MAP[clean] || `status_${clean}`;
};

export const translateText = i18n.translateText;
export const t = i18n.t;
export const tRole = i18n.tRole;
export const tFeatureName = i18n.tFeatureName;
export const tFeatureSubtitle = i18n.tFeatureSubtitle;
export const tCategoryName = i18n.tCategoryName;

export default i18n;
