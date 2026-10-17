import { I18nService } from './I18nService.js';
import { LocaleDetector } from './LocaleDetector.js';
import { LANGUAGES, DEFAULT_LANGUAGE } from './locales/index.js';

// App-wide i18n instance. Imported by main.jsx *before* App so detection reads the
// launch URL's ?lang/?country/?currency before socketClient.js strips them.
export const i18n = new I18nService({
  languages: LANGUAGES,
  fallbackLanguage: DEFAULT_LANGUAGE,
  detector: new LocaleDetector({
    supportedLanguages: Object.keys(LANGUAGES),
    defaultLanguage: DEFAULT_LANGUAGE,
    defaultCurrency: 'EUR',
  }),
});

export { isDescriptor } from './Translator.js';
