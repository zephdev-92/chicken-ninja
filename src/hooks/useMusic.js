import { useEffect, useSyncExternalStore } from 'react';
import { ambientMusic } from '../audio/AmbientMusic.js';

// Ambient music on/off state (persisted) + toggle. Starts the music engine on mount;
// actual sound waits for the player's first click/tap/key (browser autoplay rules).
export function useMusic() {
  const enabled = useSyncExternalStore(ambientMusic.subscribe, ambientMusic.getSnapshot);
  useEffect(() => { ambientMusic.start(); }, []);
  return { enabled, toggle: () => ambientMusic.toggle() };
}
