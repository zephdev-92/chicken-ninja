// Single shared AudioContext for sound effects (hooks/useSound.js) and the ambient
// music (audio/AmbientMusic.js). Created lazily: browsers only let audio start after
// a user gesture, so the first call should come from (or after) one.

let ctx = null;

export function getAudioContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
