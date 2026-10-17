// ISO 3166-1 alpha-2 country → ISO 4217 currency, for currency detection when the
// launch URL doesn't name one (see LocaleDetector.js). Unlisted countries fall back
// to the detector's default currency.

const EURO_COUNTRIES = [
  'AD', 'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU',
  'LV', 'MC', 'ME', 'MT', 'NL', 'PT', 'SI', 'SK', 'SM', 'VA', 'XK',
  // French overseas departments/collectivities using the euro
  'GF', 'GP', 'MQ', 'RE', 'YT', 'PM', 'BL', 'MF',
];

const CURRENCY_BY_COUNTRY = {
  ...Object.fromEntries(EURO_COUNTRIES.map(code => [code, 'EUR'])),
  // Europe (non-euro)
  GB: 'GBP', CH: 'CHF', LI: 'CHF', NO: 'NOK', SE: 'SEK', DK: 'DKK', IS: 'ISK', PL: 'PLN',
  CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', RS: 'RSD', BA: 'BAM', MK: 'MKD', AL: 'ALL',
  MD: 'MDL', UA: 'UAH', BY: 'BYN', RU: 'RUB', TR: 'TRY', GE: 'GEL', AM: 'AMD', AZ: 'AZN',
  // Americas
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
  UY: 'UYU', PY: 'PYG', BO: 'BOB', VE: 'VES', EC: 'USD', SV: 'USD', PA: 'PAB', CR: 'CRC',
  GT: 'GTQ', HN: 'HNL', NI: 'NIO', DO: 'DOP', JM: 'JMD', TT: 'TTD', PR: 'USD',
  // Africa / Middle East
  MA: 'MAD', DZ: 'DZD', TN: 'TND', EG: 'EGP', ZA: 'ZAR', NG: 'NGN', KE: 'KES', GH: 'GHS',
  SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', BJ: 'XOF', TG: 'XOF', NE: 'XOF',
  CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF',
  AO: 'AOA', MZ: 'MZN', TZ: 'TZS', UG: 'UGX', ET: 'ETB', MU: 'MUR', MG: 'MGA',
  IL: 'ILS', AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', JO: 'JOD',
  LB: 'LBP', IQ: 'IQD', IR: 'IRR',
  // Asia / Pacific
  JP: 'JPY', CN: 'CNY', HK: 'HKD', MO: 'MOP', TW: 'TWD', KR: 'KRW', IN: 'INR', PK: 'PKR',
  BD: 'BDT', LK: 'LKR', NP: 'NPR', ID: 'IDR', MY: 'MYR', SG: 'SGD', TH: 'THB', VN: 'VND',
  PH: 'PHP', KH: 'KHR', MM: 'MMK', KZ: 'KZT', UZ: 'UZS', MN: 'MNT',
  AU: 'AUD', NZ: 'NZD', FJ: 'FJD', PF: 'XPF', NC: 'XPF', WF: 'XPF',
};

export function currencyForCountry(country) {
  return country ? CURRENCY_BY_COUNTRY[country] ?? null : null;
}
