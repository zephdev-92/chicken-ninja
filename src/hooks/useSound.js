// Web Audio API — aucune dépendance externe.
// AudioContext créé au premier appel (après interaction utilisateur, requis par les navigateurs).
import crashSfxUrl   from '../assets/sounds/crash.mp3';
import cashoutSfxUrl from '../assets/sounds/cashout.mp3';

let _ctx = null;

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Fichiers audio réels ─────────────────────────────────────────────────────
// fetch + decodeAudioData une seule fois par URL (résultat mis en cache), puis
// rejoué depuis un AudioBufferSourceNode neuf à chaque appel — contrairement à un
// <audio> partagé, ça permet à deux déclenchements rapprochés de se superposer
// sans se couper l'un l'autre.
const _bufferCache = new Map();

function loadBuffer(url) {
  if (!_bufferCache.has(url)) {
    _bufferCache.set(url, fetch(url)
      .then(res => res.arrayBuffer())
      .then(data => getCtx().decodeAudioData(data)));
  }
  return _bufferCache.get(url);
}

function playBuffer(url) {
  loadBuffer(url)
    .then(buffer => {
      const c      = getCtx();
      const source = c.createBufferSource();
      source.buffer = buffer;
      source.connect(c.destination);
      source.start();
    })
    .catch(() => { /* fichier manquant ou décodage impossible */ });
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

// Étoile ninja touchée — fichier fourni (src/assets/sounds/crash.mp3).
function playBust() {
  playBuffer(crashSfxUrl);
}

// Encaissement — fichier fourni (src/assets/sounds/cashout.mp3).
function playCashout() {
  playBuffer(cashoutSfxUrl);
}

// Shuriken raté planté dans une cible en bois — synthétisé (pas de fichier) :
// un "thump" grave et bref (corps du bois) + une courte salve de bruit filtré
// (craquement de la surface), le tout sur ~80-90ms pour rester percussif.
function playTargetHit() {
  try {
    const c  = getCtx();
    const t0 = c.currentTime;

    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(85, t0 + 0.07);
    gain.gain.setValueAtTime(0.22, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    osc.start(t0);
    osc.stop(t0 + 0.09);

    const bufferSize = c.sampleRate * 0.05;
    const buffer      = c.createBuffer(1, bufferSize, c.sampleRate);
    const data        = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise  = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1300, t0);
    filter.Q.value = 0.7;
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.16, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(c.destination);
    noise.start(t0);
  } catch { /* contexte non disponible */ }
}

// ── Hook React ─────────────────────────────────────────────────────────────
const _sound = { hop: playHop, bust: playBust, cashout: playCashout, targetHit: playTargetHit };
export function useSound() {
  return _sound;
}
