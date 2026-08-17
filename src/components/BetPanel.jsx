import { useState } from 'react';
import { theme } from '../theme';
import buttonPlayImg from '../assets/ui/button-play.png';
import tokenBetImg from '../assets/ui/token-bet.png';

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
        transition: 'transform 160ms ease-out, background 150ms ease, opacity 150ms ease',
        transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
      }}
    >
      {children}
    </button>
  );
}

export default function BetPanel({
  bet, setBet, betError, minBet, maxBet, balance,
  status, isIdleLike, step, multiplier, activeBet, actionPending,
  onStart, onStep, onCashOut,
}) {
  const canStart = isIdleLike && balance >= bet && bet >= minBet;
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
            width: '52px', minWidth: 0, minHeight: '44px', flexShrink: 1, boxSizing: 'border-box',
            padding: '5px 6px', borderRadius: '8px',
            border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.textPrimary,
            fontSize: '14px', fontWeight: 600,
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
              flexShrink: 0, minWidth: '44px', minHeight: '44px', boxSizing: 'border-box',
              padding: '4px 6px', borderRadius: '7px', border: `1px solid ${theme.border}`,
              backgroundColor: theme.surfaceAlt,
              backgroundImage: `url(${tokenBetImg})`, backgroundSize: '16px 16px',
              backgroundPosition: 'top 2px right 2px', backgroundRepeat: 'no-repeat',
              color: theme.accent, fontSize: '12px', fontWeight: 600,
              cursor: isIdleLike ? 'pointer' : 'not-allowed', opacity: isIdleLike ? 1 : 0.5,
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
              flex: 1, minHeight: '48px', boxSizing: 'border-box',
              padding: '13px 14px', borderRadius: '12px', border: 'none',
              backgroundColor: canStart ? theme.accent : theme.disabledBg,
              backgroundImage: canStart ? `url(${buttonPlayImg})` : 'none',
              backgroundSize: 'cover', backgroundPosition: 'center', backgroundBlendMode: 'multiply',
              color: canStart ? theme.textOnAccent : theme.disabledText,
              fontWeight: 700, fontSize: '15px', cursor: canStart ? 'pointer' : 'not-allowed',
              textShadow: canStart ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
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
                flex: 1, minHeight: '48px', boxSizing: 'border-box',
                padding: '13px 14px', borderRadius: '12px', border: 'none',
                background: canStep ? theme.info : theme.disabledBg,
                color: canStep ? theme.textOnAccent : theme.disabledText,
                fontWeight: 700, fontSize: '15px',
                cursor: canStep ? 'pointer' : 'not-allowed',
              }}
            >
              Avancer
            </PressButton>
            <PressButton
              onClick={onCashOut}
              disabled={!canCashOut}
              style={{
                flex: 1, minHeight: '48px', boxSizing: 'border-box',
                padding: '13px 14px', borderRadius: '12px', border: 'none',
                background: canCashOut ? theme.warning : theme.disabledBg,
                color: canCashOut ? theme.textPrimary : theme.disabledText, fontWeight: 700, fontSize: '15px',
                cursor: canCashOut ? 'pointer' : 'not-allowed',
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
