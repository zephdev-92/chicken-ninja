import { useSyncExternalStore } from 'react';
import { i18n } from '../index.js';

// Current i18n snapshot: { t, translate, fmt, language, country, currency, locale,
// languages, setLanguage }. Re-renders the caller whenever the language/currency changes.
export function useI18n() {
  return useSyncExternalStore(i18n.subscribe, i18n.getSnapshot);
}
