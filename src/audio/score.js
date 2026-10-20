// "Dojo du désert" — ambient loop for Chicken Ninja, in the miyako-bushi scale on D
// (D Eb G A Bb), the pentatonic mode of traditional koto/shamisen music.
// Time unit: the eighth note. 16 bars of 4/4 = 128 eighths ≈ 53 s at 72 bpm.
//
// Four 4-bar sections: koto alone → shakuhachi enters → taiko joins, koto thins out →
// everything together, resolving back onto D so the loop restarts seamlessly.

export const TEMPO_BPM = 72;
export const LOOP_EIGHTHS = 128;

const NOTE = {
  D2: 38, A2: 45, D3: 50, Eb3: 51, G3: 55, A3: 57, Bb3: 58,
  D4: 62, Eb4: 63, G4: 67, A4: 69, Bb4: 70, D5: 74, Eb5: 75, G5: 79,
};

// One bar of koto arpeggio (8 eighths, null = rest).
const KOTO = {
  a: ['D3', 'A3', 'D4', 'Eb4', 'A4', null, 'D4', null],
  b: ['G3', 'D4', 'G4', 'A4', 'Bb4', null, 'A4', null],
  c: ['Bb3', 'D4', 'A4', 'Bb4', 'D5', null, 'A4', 'G4'],
  d: ['A3', 'Eb4', 'A4', 'Bb4', 'A4', 'G4', 'Eb4', null],
  end: ['D3', 'A3', 'D4', null, 'G4', null, 'A4', null],
};

// Shakuhachi phrases: [start eighth within the section, note, length in eighths].
const FLUTE = {
  call: [[0, 'A4', 6], [6, 'Bb4', 2], [8, 'A4', 4], [12, 'G4', 4], [16, 'Eb4', 6], [22, 'D4', 2], [24, 'D4', 8]],
  rise: [[0, 'D5', 6], [6, 'Eb5', 2], [8, 'D5', 4], [12, 'Bb4', 4], [16, 'A4', 8], [24, 'G4', 4], [28, 'A4', 4]],
  home: [[0, 'G4', 4], [4, 'A4', 4], [8, 'Bb4', 6], [14, 'A4', 2], [16, 'G4', 4], [20, 'Eb4', 4], [24, 'D4', 8]],
};

const SECTIONS = [
  { koto: ['a', 'b', 'a', 'd'], kotoVelocity: 0.8, drone: 0.6 },
  { koto: ['a', 'b', 'c', 'd'], flute: 'call', drone: 1 },
  { koto: ['b', 'c', 'a', 'd'], sparse: true, flute: 'rise', taiko: true, drone: 1 },
  { koto: ['a', 'b', 'd', 'end'], flute: 'home', taiko: true, roll: true, drone: 1 },
];

function buildEvents() {
  const events = [];
  SECTIONS.forEach((section, s) => {
    const sectionStart = s * 32;
    events.push({ at: sectionStart, type: 'drone', length: 32, notes: [NOTE.D2, NOTE.A2], velocity: section.drone });

    section.koto.forEach((patternName, bar) => {
      KOTO[patternName].forEach((note, eighth) => {
        if (!note) return;
        if (section.sparse && eighth % 4 !== 0) return; // only the downbeat notes
        const accent = eighth === 0 ? 1 : 0.75;
        events.push({ at: sectionStart + bar * 8 + eighth, type: 'koto', note: NOTE[note], velocity: accent * (section.kotoVelocity ?? 1) });
      });
    });

    if (section.flute) {
      for (const [at, note, length] of FLUTE[section.flute]) {
        events.push({ at: sectionStart + at, type: 'flute', note: NOTE[note], length });
      }
    }

    if (section.taiko) {
      for (let bar = 0; bar < 4; bar++) {
        events.push({ at: sectionStart + bar * 8, type: 'taiko', velocity: 1 });
        events.push({ at: sectionStart + bar * 8 + 6, type: 'taiko', velocity: 0.45 });
      }
    }
    if (section.roll) {
      [28, 29, 30, 31].forEach((at, i) => events.push({ at: sectionStart + at, type: 'taiko', velocity: 0.35 + i * 0.15 }));
    }
  });
  return events.sort((a, b) => a.at - b.at);
}

export const EVENTS = buildEvents();
