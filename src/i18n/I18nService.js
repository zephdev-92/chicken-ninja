import { Translator } from './Translator.js';
import { NumberFormats } from './NumberFormats.js';

// Owns the current language, country and currency, and hands out an immutable
// snapshot ({ t, translate, fmt, language, … }) that UI code reads from.
//
// Framework-agnostic: React subscribes through useI18n() (useSyncExternalStore on
// subscribe/getSnapshot), anything else can call subscribe() directly. A fresh
// snapshot object is built on every change so memoizing consumers (the React
// Compiler is enabled in vite.config.js) see a new reference and re-render.

export class I18nService {
  constructor({ languages, fallbackLanguage = 'en', detector, document = globalThis.document }) {
    this._languages = languages;           // { code: { name, messages } }
    this._fallbackLanguage = fallbackLanguage;
    this._detector = detector;
    this._document = document;
    this._listeners = new Set();

    const { language, country, currency } = detector.detect();
    this._language = language;
    this._country = country;
    this._currency = currency;
    this._rebuild();

    this.subscribe = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
  }

  get availableLanguages() {
    return Object.entries(this._languages).map(([code, { name }]) => ({ code, name }));
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  getSnapshot() {
    return this._snapshot;
  }

  // Player's explicit choice — remembered across visits.
  setLanguage(code) {
    if (!this._languages[code] || code === this._language) return;
    this._language = code;
    this._detector.rememberLanguage(code);
    this._rebuild();
  }

  // e.g. once a real-money platform session reports its wallet currency.
  setCurrency(code) {
    if (!/^[A-Z]{3}$/.test(code ?? '') || code === this._currency) return;
    this._currency = code;
    this._rebuild();
  }

  _rebuild() {
    const locale = this._country ? `${this._language}-${this._country}` : this._language;
    const fmt = new NumberFormats(locale, this._currency);
    const translator = new Translator({
      language: this._language,
      messages: this._languages[this._language].messages,
      fallbackMessages: this._languages[this._fallbackLanguage].messages,
      formats: fmt,
    });

    if (this._document?.documentElement) this._document.documentElement.lang = this._language;

    this._snapshot = Object.freeze({
      language: this._language,
      country: this._country,
      currency: this._currency,
      locale,
      fmt,
      t: translator.t.bind(translator),
      translate: translator.translate.bind(translator),
      languages: this.availableLanguages,
      setLanguage: (code) => this.setLanguage(code),
    });
    this._listeners.forEach(listener => listener());
  }
}
