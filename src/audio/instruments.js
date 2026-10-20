// Synthesized Japanese-flavoured instruments for the ambient music (no audio files):
// each function schedules one note at an exact AudioContext time and routes it into
// `out` (the music bus). All voices clean up after themselves (oscillators stopped).

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

let noiseBuffer = null;
function getNoise(ctx) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    const len = ctx.sampleRate; // 1 s, looped where needed
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Synthetic hall reverb: a convolver fed with exponentially decaying stereo noise.
export function createReverb(ctx, seconds = 3.2, decay = 2.6) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

// Koto: bright plucked string — triangle + detuned octave, a filter that closes as
// the note rings out, and a tiny noise "pick" transient.
export function koto(ctx, out, time, midi, { velocity = 1, length = 1.8 } = {}) {
  const freq = midiToFreq(midi);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(Math.min(9000, freq * 9), time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.5), time + length * 0.6);

  const peak = 0.22 * velocity;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.006);
  gain.gain.exponentialRampToValueAtTime(peak * 0.35, time + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length);

  for (const [type, mult, level] of [['triangle', 1, 1], ['sine', 2.003, 0.35], ['square', 1, 0.05]]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, time);
    g.gain.value = level;
    osc.connect(g).connect(filter);
    osc.start(time);
    osc.stop(time + length + 0.05);
  }

  const pick = ctx.createBufferSource();
  pick.buffer = getNoise(ctx);
  const pickFilter = ctx.createBiquadFilter();
  pickFilter.type = 'highpass';
  pickFilter.frequency.value = 2500;
  const pickGain = ctx.createGain();
  pickGain.gain.setValueAtTime(0.05 * velocity, time);
  pickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
  pick.connect(pickFilter).connect(pickGain).connect(out);
  pick.start(time, Math.random() * 0.5, 0.04);

  filter.connect(gain).connect(out);
}

// Shakuhachi: breathy bamboo flute — soft sine/triangle body that slides up into the
// pitch (meri → kari), delayed vibrato, and band-passed breath noise on top.
export function shakuhachi(ctx, out, time, midi, duration, { velocity = 1 } = {}) {
  const freq = midiToFreq(midi);
  const end = time + duration;
  const release = Math.min(0.5, duration * 0.4);
  const body = ctx.createGain();
  const level = 0.11 * velocity;
  body.gain.setValueAtTime(0.0001, time);
  body.gain.exponentialRampToValueAtTime(level, time + 0.18);
  body.gain.setValueAtTime(level, end - release);
  body.gain.exponentialRampToValueAtTime(0.0001, end);

  const vibrato = ctx.createOscillator();
  const vibratoDepth = ctx.createGain();
  vibrato.frequency.value = 5.2;
  vibratoDepth.gain.setValueAtTime(0, time);
  vibratoDepth.gain.linearRampToValueAtTime(freq * 0.012, time + Math.min(0.9, duration * 0.6));
  vibrato.connect(vibratoDepth);

  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = freq * 4;
  for (const [type, level2] of [['sine', 1], ['triangle', 0.25]]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * 0.97, time);              // starts a little flat…
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.22); // …and bends up to pitch
    vibratoDepth.connect(osc.frequency);
    g.gain.value = level2;
    osc.connect(g).connect(tone);
    osc.start(time);
    osc.stop(end + 0.05);
  }
  tone.connect(body).connect(out);

  const breath = ctx.createBufferSource();
  breath.buffer = getNoise(ctx);
  breath.loop = true;
  const breathFilter = ctx.createBiquadFilter();
  breathFilter.type = 'bandpass';
  breathFilter.frequency.value = freq * 2;
  breathFilter.Q.value = 1.2;
  const breathGain = ctx.createGain();
  breathGain.gain.setValueAtTime(0.0001, time);
  breathGain.gain.exponentialRampToValueAtTime(0.035 * velocity, time + 0.08);
  breathGain.gain.exponentialRampToValueAtTime(0.008 * velocity, time + 0.4);
  breathGain.gain.exponentialRampToValueAtTime(0.0001, end);
  breath.connect(breathFilter).connect(breathGain).connect(out);
  breath.start(time);
  breath.stop(end + 0.05);

  vibrato.start(time);
  vibrato.stop(end + 0.05);
}

// Taiko: deep pitched thump plus a short felt-mallet noise burst.
export function taiko(ctx, out, time, { velocity = 1 } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(95, time);
  osc.frequency.exponentialRampToValueAtTime(48, time + 0.35);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.45 * velocity, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);
  osc.connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + 0.75);

  const hit = ctx.createBufferSource();
  hit.buffer = getNoise(ctx);
  const hitFilter = ctx.createBiquadFilter();
  hitFilter.type = 'lowpass';
  hitFilter.frequency.value = 900;
  const hitGain = ctx.createGain();
  hitGain.gain.setValueAtTime(0.12 * velocity, time);
  hitGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
  hit.connect(hitFilter).connect(hitGain).connect(out);
  hit.start(time, Math.random() * 0.5, 0.1);
}

// Drone: very soft low fifth that swells in and out under a whole section.
export function drone(ctx, out, time, duration, midis, { velocity = 1 } = {}) {
  const gain = ctx.createGain();
  const level = 0.05 * velocity;
  const fade = Math.min(3, duration / 3);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(level, time + fade);
  gain.gain.setValueAtTime(level, time + duration - fade);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  for (const midi of midis) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = midiToFreq(midi);
    osc.detune.value = (Math.random() - 0.5) * 8;
    osc.connect(filter);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }
  filter.connect(gain).connect(out);
}
