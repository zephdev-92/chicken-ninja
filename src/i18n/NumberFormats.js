// Locale- and currency-aware number formatting (Intl.NumberFormat), one instance per
// (locale, currency) pair. Methods are also usable as Translator `{name:format}`
// formatters — see Translator.js.

export class NumberFormats {
  constructor(locale, currency) {
    this.locale = locale;
    this.currency = currency;
    this._money = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
    // Whole amounts (bets, quick deposits) read better without ",00".
    this._moneyWhole = new Intl.NumberFormat(locale, {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0,
    });
    this._fractionDigits = this._money.resolvedOptions().maximumFractionDigits;
  }

  // Balance-style amount: always the currency's standard decimals (2 for EUR, 0 for JPY…).
  money(amount) {
    return this._money.format(Number(amount) || 0);
  }

  // Bet-style amount: decimals only when the value actually has some.
  moneyShort(amount) {
    const n = Number(amount) || 0;
    return (Number.isInteger(n) ? this._moneyWhole : this._money).format(n);
  }

  get currencySymbol() {
    const part = this._money.formatToParts(0).find(p => p.type === 'currency');
    return part?.value ?? this.currency;
  }

  // true for "$10" / "CHF 10", false for "10 €" — lets a custom amount field put the
  // symbol on the side the locale expects.
  get currencySymbolFirst() {
    const parts = this._money.formatToParts(1);
    return parts.findIndex(p => p.type === 'currency') < parts.findIndex(p => p.type === 'integer');
  }

  get fractionDigits() {
    return this._fractionDigits;
  }

  number(value, digits = 0) {
    return new Intl.NumberFormat(this.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
      .format(Number(value) || 0);
  }

  // 0.97 → "97.0%" / "97,0 %"
  percent(ratio, digits = 1) {
    return new Intl.NumberFormat(this.locale, {
      style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(Number(ratio) || 0);
  }

  percentWhole(ratio) {
    return this.percent(ratio, 0);
  }

  // 1.02 → "1.02x" / "1,02x"
  multiplier(value) {
    return `${this.number(value, 2)}x`;
  }
}
