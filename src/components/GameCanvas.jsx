import { useEffect, useRef, useState } from 'react';
import { PixiRenderer } from '../animation/PixiRenderer';

const RESIZE_DEBOUNCE_MS = 200;
const SIZE_CHANGE_THRESHOLD = 6; // ignore sub-pixel/scrollbar-induced jitter

export default function GameCanvas({ status, step, lanes, lastOutcome, difficulty }) {
  const containerRef  = useRef(null);
  const rendererRef   = useRef(null);
  const prevStatusRef = useRef(null);
  const liveRef       = useRef({});
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    liveRef.current = { status, step, lanes, lastOutcome, difficulty };
  });

  // Fills whatever space the flex parent gives it — tracks both dimensions,
  // not just width, since the game area is a flexible row in a fixed-viewport shell.
  useEffect(() => {
    const container = containerRef.current;
    setSize({ w: container.clientWidth, h: container.clientHeight });

    let timeout;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setSize(prev => (
          Math.abs(prev.w - w) > SIZE_CHANGE_THRESHOLD || Math.abs(prev.h - h) > SIZE_CHANGE_THRESHOLD
        ) ? { w, h } : prev);
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(container);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!size.w || !size.h) return;

    const container = containerRef.current;
    const renderer   = new PixiRenderer();
    rendererRef.current = renderer;

    renderer.init(container, size.w, size.h)
      .then(() => {
        if (rendererRef.current !== renderer) return;
        const { status, step, lastOutcome, difficulty } = liveRef.current;
        renderer.setDifficulty(difficulty);
        renderer.update({ status, step, lastOutcome });
      })
      .catch(err => console.error('[GameCanvas] PixiJS init failed:', err));

    return () => {
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [size.w, size.h]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;

    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    // A brand-new round starts: fresh chicken, fresh tiles.
    if (status === 'active' && step === 0 && prev !== 'active') {
      r.reset();
    }
    r.update({ status, step, lanes, lastOutcome });
  }, [status, step, lanes, lastOutcome]);

  useEffect(() => {
    rendererRef.current?.setDifficulty(difficulty);
  }, [difficulty]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 0 }} />;
}
