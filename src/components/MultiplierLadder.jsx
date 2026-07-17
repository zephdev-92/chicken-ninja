import { useEffect, useRef } from 'react';
import { DIFFICULTIES, buildMultiplierLadder } from '../shared/gameConfig';

export default function MultiplierLadder({ difficulty, step }) {
  const key = difficulty ?? 'easy';
  const { deathChance, lanes } = DIFFICULTIES[key];
  const ladder = buildMultiplierLadder(deathChance, lanes);
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [step]);

  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex', gap: '5px', overflowX: 'auto', padding: '7px 8px',
        background: '#0a1220', borderTop: '1px solid rgba(138,184,255,0.06)',
      }}
    >
      {ladder.map((mult, i) => {
        const lane   = i + 1;
        const isDone = lane <= step;
        const isNow  = lane === step + 1;
        return (
          <div
            key={lane}
            ref={isNow ? activeRef : null}
            style={{
              flex: '0 0 auto',
              minWidth: '44px',
              textAlign: 'center',
              padding: '4px 3px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              background: isNow ? 'rgba(255,176,32,0.18)' : isDone ? 'rgba(39,195,131,0.1)' : '#0f1726',
              color:      isNow ? '#ffb020' : isDone ? '#27c383' : '#5a7a9a',
              border:     `1px solid ${isNow ? '#ffb020' : isDone ? 'rgba(39,195,131,0.3)' : 'transparent'}`,
            }}
          >
            {mult.toFixed(2)}x
          </div>
        );
      })}
    </div>
  );
}
