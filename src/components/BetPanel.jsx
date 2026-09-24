import { useState } from 'react';
import { theme } from '../theme';
import { skinStyle } from './buttonSkin';

function PressButton({ onClick, disabled, style, children }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...style,
        transition: 'transform 160ms ease-out, opacity 150ms ease',
        transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
      }}
    >
      {children}
    </button>
  );
}

export default function BetPanel({
  bet, setBet, betError, minBet, maxBet, balance,
  status, isIdleLike, step, multiplier, activeBet, actionPending, roundAnimating,
  onStart, onStep, onCashOut,
}) {
  // isIdleLike flips true the instant a round busts/cashes out, but the road
  // still needs ~half a second to play out the shuriken/KO animation — starting
  // a new round before that finishes yanks the scene out from under it (see
  // PixiRenderer.reset()), so the button stays locked until roundAnimating clears.
  const canStart = isIdleLike && !roundAnimating && balance >= bet && bet >= minBet;
  const canStep = status === 'active' && !actionPending;
  const canCashOut = status === 'active' && step >= 1 && !actionPending;

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <div
        style={{
          borderRadius: '12px', border: `1px solid ${theme.borderSoft}`,
          background: theme.surface, padding: '9px 10px',
          display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap',
        }}
      >
        <span style={{ color: theme.accent, fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>Mise</span>
        <input
          type="number"
          min={minBet}
          max={Math.min(maxBet, balance)}
          step="1"
          value={bet}
          disabled={!isIdleLike}
          onChange={e => setBet(Number(e.target.value) || 0)}
          style={{
            ...skinStyle('beige', { disabled: !isIdleLike }),
            cursor: isIdleLike ? 'text' : 'not-allowed',
            width: '56px', minWidth: 0, minHeight: '44px', flexShrink: 1,
            padding: '5px 6px', borderRadius: '10px',
            color: theme.textPrimary, fontSize: '14px',
          }}
        />
        {[
          { label: 'Min', fn: () => setBet(minBet) },
          { label: '½',   fn: () => setBet(Math.max(minBet, Math.floor(bet / 2))) },
          { label: '2×',  fn: () => setBet(bet * 2) },
          { label: 'Max', fn: () => setBet(Math.min(maxBet, balance)) },
        ].map(({ label, fn }) => (
          <PressButton
            key={label}
            onClick={fn}
            disabled={!isIdleLike}
            style={{
              ...skinStyle('beige', { round: true, disabled: !isIdleLike }),
              flexShrink: 0, width: '44px', height: '44px', padding: 0, fontSize: '12px',
            }}
          >
            {label}
          </PressButton>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {isIdleLike ? (
          <PressButton
            onClick={onStart}
            disabled={!canStart}
            style={{
              ...skinStyle('vert', { disabled: !canStart }),
              flex: 1, minHeight: '48px', padding: '11px 14px',
              fontSize: '15px', textTransform: 'uppercase',
            }}
          >
            {balance < bet ? 'Balance trop juste' : `Jouer — ${bet} €`}
          </PressButton>
        ) : (
          <>
            <PressButton
              onClick={onStep}
              disabled={!canStep}
              style={{
                ...skinStyle('bleu', { disabled: !canStep }),
                flex: 1, minHeight: '48px', padding: '11px 14px',
                fontSize: '15px', textTransform: 'uppercase',
              }}
            >
              Avancer →
            </PressButton>
            <PressButton
              onClick={onCashOut}
              disabled={!canCashOut}
              style={{
                ...skinStyle('jaune', { disabled: !canCashOut }),
                flex: 1, minHeight: '48px', padding: '11px 14px',
                fontSize: '15px', textTransform: 'uppercase',
              }}
            >
              Encaisser {step >= 1 ? `— ${(activeBet * multiplier).toFixed(2)} €` : ''}
            </PressButton>
          </>
        )}
      </div>

      {betError && (
        <div style={{ color: theme.danger, fontSize: '12px', paddingLeft: '4px' }}>{betError}</div>
      )}
    </div>
  );
}
