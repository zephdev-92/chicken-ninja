// Resolves dotted message keys ("game.play") against one language's dictionary, with
// a fallback dictionary (English) for any key that language hasn't translated yet.
//
// Message syntax:
//   "Play — {amount:money}"   → `{name}` interpolates params.name; `{name:format}` runs it
//                                through a NumberFormats method first (money, percent,
//                                multiplier, number).
//   { one: "…", other: "…" }  → plural forms, picked with Intl.PluralRules on params.count.
//
// A param can itself be a message descriptor ({ key, params }) — it is translated
// first, so e.g. a difficulty name travels as `{ key: 'difficulty.hard' }` and comes
// out in the current language.

const PLACEHOLDER = /\{(\w+)(?::(\w+))?\}/g;

export function isDescriptor(value) {
  return value !== null && typeof value === 'object' && typeof value.key === 'string';
}

export class Translator {
  constructor({ language, messages, fallbackMessages, formats }) {
    this.language = language;
    this._messages = messages;
    this._fallback = fallbackMessages;
    this._formats = formats;
    this._plurals = new Intl.PluralRules(language);
  }

  has(key) {
    return Translator._lookup(this._messages, key) !== undefined;
  }

  t(key, params = {}) {
    let entry = Translator._lookup(this._messages, key);
    if (entry === undefined) entry = Translator._lookup(this._fallback, key);
    if (entry === undefined) {
      if (import.meta.env?.DEV) console.warn(`[i18n] missing key "${key}"`);
      return key;
    }
    if (typeof entry === 'object') entry = this._pluralForm(entry, params.count);
    return this._interpolate(String(entry), params);
  }

  // Accepts a plain string (returned as-is), a descriptor, or null.
  translate(message) {
    if (message == null) return '';
    if (isDescriptor(message)) return this.t(message.key, message.params);
    return String(message);
  }

  _pluralForm(forms, count) {
    const category = this._plurals.select(Number(count ?? 0));
    return forms[category] ?? forms.other ?? '';
  }

  _interpolate(text, params) {
    return text.replace(PLACEHOLDER, (match, name, format) => {
      if (!(name in params)) return match;
      let value = params[name];
      if (isDescriptor(value)) value = this.translate(value);
      if (format) {
        const formatter = this._formats?.[format];
        if (typeof formatter === 'function') return formatter.call(this._formats, value);
      }
      return String(value);
    });
  }

  static _lookup(dict, key) {
    return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);
  }
}
