// Shared event bus — framework-agnostic.
// socketClient dispatches here; chickenStore and hooks subscribe.
export const gameEvents = new EventTarget();
