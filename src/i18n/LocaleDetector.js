import { currencyForCountry } from './countryCurrencies.js';

// Works out which language, country and currency to start with.
//
// Priority, highest first:
//   language: launch URL `?lang=` → the player's own earlier choice (storage) →
//             first supported browser language → default (English)
//   country:  launch URL `?country=` → region of the browser languages ("fr-BE" → BE)
//   currency: launch URL `?currency=` → currency of the detected country → default (EUR)
//
// Launch params are what an aggregator (Hub88 /game/url, see HUB88_INTEGRATION.md)
// passes to the game. socketClient.js strips them from the address bar right after
// load, so they are also kept in sessionStorage: a reload in the same tab keeps the
// operator's language/currency instead of falling back to the browser's.

const LAUNCH_KEY = 'chicken:launch';
const LANGUAGE_KEY = 'chicken:lang';
const CURRENCY_RE = /^[A-Z]{3}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
// "XXX" is the ISO code for "no currency" — Hub88 uses it for fun-mode sessions.
const NO_CURRENCY = 'XXX';

function safeStorage(getStorage) {
  try { return getStorage(); } catch { return null; }
}

export class LocaleDetector {
  constructor({
    supportedLanguages,
    defaultLanguage = 'en',
    defaultCurrency = 'EUR',
    location = globalThis.location,
    navigator = globalThis.navigator,
    localStorage = safeStorage(() => globalThis.localStorage),
    sessionStorage = safeStorage(() => globalThis.sessionStorage),
  }) {
    this.supportedLanguages = supportedLanguages;
    this.defaultLanguage = defaultLanguage;
    this.defaultCurrency = defaultCurrency;
    this._location = location;
    this._navigator = navigator;
    this._local = localStorage;
    this._session = sessionStorage;
  }

  // "pt-BR" → { language: 'pt', region: 'BR' }
  static parseTag(tag) {
    const [language = '', ...rest] = String(tag ?? '').replace('_', '-').split('-');
    const region = rest.find(part => /^[A-Za-z]{2}$/.test(part));
    return { language: language.toLowerCase(), region: region?.toUpperCase() ?? null };
  }

  detect() {
    const launch = this._launchParams();
    const country = this._detectCountry(launch);
    return {
      language: this._detectLanguage(launch),
      country,
      currency: this._detectCurrency(launch, country),
    };
  }

  rememberLanguage(language) {
    try { this._local?.setItem(LANGUAGE_KEY, language); } catch { /* storage unavailable */ }
  }

  _supports(language) {
    return this.supportedLanguages.includes(language);
  }

  _browserTags() {
    const nav = this._navigator;
    return (nav?.languages?.length ? nav.languages : [nav?.language]).filter(Boolean);
  }

  _detectLanguage(launch) {
    const fromLaunch = LocaleDetector.parseTag(launch.lang).language;
    if (this._supports(fromLaunch)) return fromLaunch;

    let stored = null;
    try { stored = this._local?.getItem(LANGUAGE_KEY); } catch { /* storage unavailable */ }
    if (this._supports(stored)) return stored;

    for (const tag of this._browserTags()) {
      const { language } = LocaleDetector.parseTag(tag);
      if (this._supports(language)) return language;
    }
    return this.defaultLanguage;
  }

  _detectCountry(launch) {
    const fromLaunch = String(launch.country ?? '').toUpperCase();
    if (COUNTRY_RE.test(fromLaunch)) return fromLaunch;
    for (const tag of this._browserTags()) {
      const { region } = LocaleDetector.parseTag(tag);
      if (region) return region;
    }
    return null;
  }

  _detectCurrency(launch, country) {
    const fromLaunch = String(launch.currency ?? '').toUpperCase();
    if (CURRENCY_RE.test(fromLaunch) && fromLaunch !== NO_CURRENCY) return fromLaunch;
    return currencyForCountry(country) ?? this.defaultCurrency;
  }

  // Reads ?lang / ?country / ?currency from the URL; when present they replace what
  // this tab saved before, otherwise the saved set (from an earlier load) is reused.
  _launchParams() {
    const params = new URLSearchParams(this._location?.search ?? '');
    const fromUrl = {};
    for (const key of ['lang', 'country', 'currency']) {
      const value = params.get(key);
      if (value) fromUrl[key] = value;
    }
    if (Object.keys(fromUrl).length) {
      try { this._session?.setItem(LAUNCH_KEY, JSON.stringify(fromUrl)); } catch { /* storage unavailable */ }
      return fromUrl;
    }
    try { return JSON.parse(this._session?.getItem(LAUNCH_KEY) ?? '{}') ?? {}; } catch { return {}; }
  }
}
