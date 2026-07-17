// Web Audio API — aucune dépendance externe.
// AudioContext créé au premier appel (après interaction utilisateur, requis par les navigateurs).

let _ctx = null;

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Sons individuels ───────────────────────────────────────────────────────

// Petit "hop" — case franchie sans encombre.
function playHop() {
  try {
    const c    = getCtx();
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type            = 'triangle';
    osc.frequency.setValueAtTime(420, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(620, c.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.1);
  } catch { /* contexte non disponible */ }
}

// Sifflement + impact — étoile ninja lancée puis touchée.
function playBust() {
  try {
    const c = getCtx();
    // Sifflement du shuriken (bruit blanc filtré, pitch descendant)
    const bufferSize = c.sampleRate * 0.18;
    const buffer      = c.createBuffer(1, bufferSize, c.sampleRate);
    const data        = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise  = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type            = 'bandpass';
    filter.frequency.setValueAtTime(2200, c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.18);
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.12, c.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(c.destination);
    noise.start(c.currentTime);

    // Arpège descendant style "game over" (accent sur l'impact)
    [392, 330, 262, 196].forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type            = 'square';
      osc.frequency.value = freq;
      const t = c.currentTime + 0.14 + i * 0.09;
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch { /* AudioContext unavailable */ }
}

function playCashout() {
  try {
    const c = getCtx();
    // Arpège ascendant (mi-sol-si) — son de victoire
    [330, 415, 494].forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type            = 'sine';
      osc.frequency.value = freq;
      const t = c.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  } catch { /* AudioContext unavailable */ }
}

// ── Hook React ─────────────────────────────────────────────────────────────
const _sound = { hop: playHop, bust: playBust, cashout: playCashout };
export function useSound() {
  return _sound;
}
