// Frontend-only UI tokens — never import from server code or src/shared/gameConfig.js
// (that file is pure game math shared with the Node server; this is presentation only).

export const theme = {
  bg: '#f5ead0',
  bgDeep: '#e9d8ae',
  surface: '#fffaf0',
  surfaceAlt: '#f2e4c4',
  overlay: 'rgba(26,14,10,0.55)',

  border: '#2a1810',
  borderSoft: 'rgba(42,24,16,0.25)',

  textPrimary: '#1a0e0a',
  textMuted: '#7a5a3a',
  textOnAccent: '#fff8e8',

  accent: '#c0392b',
  accentGold: '#f0a828',
  info: '#3a6ea8',

  success: '#2e8b57',
  successSoft: 'rgba(46,139,87,0.15)',
  danger: '#a8281f',
  dangerSoft: 'rgba(168,40,31,0.15)',
  warning: '#f0a828',
  warningSoft: 'rgba(240,168,40,0.18)',

  disabledBg: '#e2d2ae',
  disabledText: '#a89070',

  fontBody: "'Inter', Arial, sans-serif",
  fontDisplay: "'Bangers', 'Inter', Arial, sans-serif",
};
