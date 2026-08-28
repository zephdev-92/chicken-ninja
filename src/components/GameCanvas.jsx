import { useEffect, useRef } from 'react';
import { PixiRenderer } from '../animation/PixiRenderer';
import { theme } from '../theme';

const RESIZE_DEBOUNCE_MS = 200;
const SIZE_CHANGE_THRESHOLD = 6; // ignore sub-pixel/scrollbar-induced jitter

export default function GameCanvas({ status, step, lanes, lastOutcome, difficulty, onBusyChange, onSound }) {
  const containerRef  = useRef(null);
  const rendererRef   = useRef(null);
  const prevStatusRef = useRef(null);
  const liveRef       = useRef({});

  useEffect(() => {
    liveRef.current = { status, step, lanes, lastOutcome, difficulty, onBusyChange, onSound };
  });

  // Single lifecycle owner for the PixiRenderer: created once with the container's
  // current size, resized in place afterwards, destroyed only on unmount.
  //
  // This used to destroy() and recreate a brand-new PixiRenderer on every debounced
  // size correction — including one that reliably fires a few hundred ms after a
  // fresh page load, once web fonts finish loading and reflow the layout. The
  // replacement instance always starts from its own fresh idle state (chicken at
  // lane 0, every tile pending) with no memory of the round actually in progress —
  // which read as the road randomly "restarting" mid-round, especially noticeable
  // right around a cashout. resize() (see PixiRenderer.js) repositions the existing
  // scene instead, so in-progress round state is never lost to a layout hiccup.
  useEffect(() => {
    const container = containerRef.current;

    const createOrResize = (w, h) => {
      if (!w || !h) return;
      if (rendererRef.current) {
        rendererRef.current.resize(w, h);
        return;
      }
      const renderer = new PixiRenderer();
      rendererRef.current = renderer;
      renderer.setBusyListener(v => liveRef.current.onBusyChange?.(v));
      renderer.setSoundListener(evt => liveRef.current.onSound?.(evt));

      renderer.init(container, w, h)
        .then(() => {
          if (rendererRef.current !== renderer) return;
          const { status, step, lastOutcome, difficulty } = liveRef.current;
          renderer.setDifficulty(difficulty);
          renderer.update({ status, step, lastOutcome });
        })
        .catch(err => console.error('[GameCanvas] PixiJS init failed:', err));
    };

    createOrResize(container.clientWidth, container.clientHeight);

    let timeout;
    let lastW = container.clientWidth;
    let lastH = container.clientHeight;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (Math.abs(lastW - w) <= SIZE_CHANGE_THRESHOLD && Math.abs(lastH - h) <= SIZE_CHANGE_THRESHOLD) return;
        lastW = w;
        lastH = h;
        createOrResize(w, h);
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(container);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;

    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    // A brand-new round starts: fresh chicken, fresh tiles. Same when the
    // store auto-returns to idle after a finished round times out — the road
    // needs to visually reset even though the player never pressed "Jouer".
    if ((status === 'active' && step === 0 && prev !== 'active')
        || (status === 'idle' && (prev === 'busted' || prev === 'cashed'))) {
      r.reset();
    }
    r.update({ status, step, lanes, lastOutcome });
  }, [status, step, lanes, lastOutcome]);

  useEffect(() => {
    rendererRef.current?.setDifficulty(difficulty);
  }, [difficulty]);

  // Explicit background so the brief gap before init() resolves (WebGL setup +
  // texture loading) shows the scene's own paper color instead of the browser's
  // default white — or near-black in some dark-mode browsers — background.
  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 0, background: theme.bg }} />;
}
