// Publisher / host details shown in the "Legal notice" and "Privacy" sections of
// InfoPanel.jsx — frontend only, the single place to edit them.
//
// Any value left as `null` is rendered as a highlighted "To be completed" marker in the
// panel, so a missing legal detail is visible on screen instead of silently blank.

export const LEGAL = {
  rulesVersion: '2026-10-17', // ISO date, formatted in the player's language

  publisher: {
    name: 'AMAPI Conseil',
    email: 'contact@amapiconseil.fr', // used for GDPR requests in the "Privacy" section
  },

  host: {
    name: null,             // hosting provider's company name
    address: null,
    phone: null,
  },
};
