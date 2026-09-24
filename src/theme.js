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
  accentDeep: '#8e2a1f',   // bottom "3D" edge under skinned buttons
  navy: '#052a75',         // text on blue/green skins
  // Flat fill of each src/assets/ui/bouton-background-*.png, under its transparent corners
  skinBeige: '#f2e4c4',
  skinBleu: '#67ccd1',
  skinJaune: '#fdcb50',
  skinVert: '#b1d952',
  skinLevel: '#fadebb',
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
  fontDisplay: "'Bangers', 'Inter', Arial, sans-serif", // wordmark/logo only
  fontMono: "'JetBrains Mono', 'Courier New', monospace", // seeds/hashes/ids
};
