import { useState } from 'react';
import { theme } from '../theme';
import { WOOD, frame, woodText, inkText } from './woodSkin';

// Tracks hover/press so image-swapped controls (arrows, play plank) can show their
// ON/CLICK artwork — pressed implies hovered on touch devices too.
function usePress() {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const handlers = {
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => { setHover(false); setPressed(false); },
    onPointerDown:  () => setPressed(true),
    onPointerUp:    () => setPressed(false),
  };
  return { hover, pressed, handlers };
}

function ArrowButton({ dir, onClick, disabled, label }) {
  const { hover, pressed, handlers } = usePress();
  const lit = !disabled && (hover || pressed);
  const img = dir === 'up' ? (lit ? WOOD.upOn : WOOD.upOff) : (lit ? WOOD.downOn : WOOD.downOff);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      {...handlers}
      style={{
        width: '22px', height: '18px', padding: 0, border: 'none',
        background: `url(${img}) center / contain no-repeat`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transform: pressed && !disabled ? 'scale(0.9)' : 'none',
      }}
    />
  );
}

function QuickButton({ onClick, disabled, children }) {
  const { pressed, handlers } = usePress();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...handlers}
      style={{
        ...frame(WOOD.miseBtn, 8, '4px'),
        ...woodText,
        flex: '1 1 0', minWidth: '38px', maxWidth: '64px', height: '58px', padding: 0,
        fontSize: '16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transform: pressed && !disabled ? 'translateY(2px)' : 'none',
        transition: 'transform 100ms ease, opacity 150ms ease',
      }}
    >
      {children}
    </button>
  );
}

// "Mise" counter (MISE-COUNTER: light-wood label on the left, paper field on the
// right with up/down arrows) followed by the Min/½/2×/Max wood blocks.
export function BetControls({ bet, setBet, betError, minBet, maxBet, balance, isIdleLike }) {
  const disabled = !isIdleLike;
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{
          position: 'relative', flex: '1 1 168px', minWidth: '128px', maxWidth: '200px', height: '64px',
          background: `url(${WOOD.miseCounter}) center / 100% 100% no-repeat`,
          opacity: disabled ? 0.75 : 1,
        }}>
          <span style={{
            ...inkText, position: 'absolute', left: 0, width: '34%', top: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px',
          }}>
            Mise
          </span>
          {/* Paper field of the artwork spans ~36%→95% horizontally, ~20%→80% vertically */}
          <div style={{
            position: 'absolute', left: '37%', right: '6%', top: '18%', bottom: '18%',
            display: 'flex', alignItems: 'center', gap: '2px', paddingLeft: '6px',
          }}>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Mise"
              value={bet}
              disabled={disabled}
              onChange={e => setBet(Number(e.target.value.replace(/\D/g, '')) || 0)}
              style={{
                ...inkText, flex: '1 1 auto', minWidth: 0, width: '100%',
                border: 'none', background: 'transparent', outline: 'none', padding: 0,
                fontSize: '20px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                cursor: disabled ? 'not-allowed' : 'text',
              }}
            />
            <span style={{ ...inkText, fontSize: '20px', flexShrink: 0 }}>€</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0, marginLeft: '2px' }}>
              <ArrowButton dir="up" label="Augmenter la mise" disabled={disabled}
                onClick={() => setBet(Math.min(maxBet, bet + 1))} />
              <ArrowButton dir="down" label="Diminuer la mise" disabled={disabled}
                onClick={() => setBet(Math.max(minBet, bet - 1))} />
            </div>
          </div>
        </div>

        {[
          { label: 'Min', fn: () => setBet(minBet) },
          { label: '½',   fn: () => setBet(Math.max(minBet, Math.floor(bet / 2))) },
          { label: '2×',  fn: () => setBet(bet * 2) },
          { label: 'Max', fn: () => setBet(Math.min(maxBet, balance)) },
        ].map(({ label, fn }) => (
          <QuickButton key={label} onClick={fn} disabled={disabled}>{label}</QuickButton>
        ))}
      </div>

      {betError && (
        <div style={{ ...woodText, fontWeight: 700, color: theme.accentGold, fontSize: '13px', paddingLeft: '4px' }}>{betError}</div>
      )}
    </div>
  );
}

// Red plank (PLAY-BTN-ACTIVE), orange while pressed (PLAY-BTN-CLICK), weathered
// grey-brown when unavailable (PLAY-BTN-OFF). The cashout plank uses the weathered
// PLAY-BTN-OFF artwork as its normal look so it reads apart from "Avancer" — its
// disabled state is therefore faded out instead of swapping artwork.
function PlankButton({ onClick, disabled, children, tall, cashout = false }) {
  const { pressed, handlers } = usePress();
  const img = pressed && !disabled ? WOOD.playClick
    : disabled || cashout ? WOOD.playOff
    : WOOD.playActive;
  const faded = disabled && cashout;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      {...handlers}
      style={{
        ...frame(img, '36 44', '16px 20px'),
        ...woodText,
        flex: '1 1 0', minWidth: 0,
        minHeight: tall ? '84px' : '72px', padding: '0 6px',
        fontSize: tall ? '26px' : '22px', fontVariant: 'small-caps', letterSpacing: '0.04em',
        lineHeight: 1.05,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled && !cashout ? theme.disabledBg : theme.woodText,
        opacity: faded ? 0.55 : 1,
        filter: faded ? 'grayscale(0.6)' : 'none',
        transform: pressed && !disabled ? 'translateY(2px)' : 'none',
        transition: 'transform 100ms ease, opacity 150ms ease',
      }}
    >
      {children}
    </button>
  );
}

export function ActionButtons({
  bet, balance, minBet, status, isIdleLike, step, multiplier, activeBet, actionPending, roundAnimating,
  onStart, onStep, onCashOut, tall = false,
}) {
  // isIdleLike flips true the instant a round busts/cashes out, but the road
  // still needs ~half a second to play out the shuriken/KO animation — starting
  // a new round before that finishes yanks the scene out from under it (see
  // PixiRenderer.reset()), so the button stays locked until roundAnimating clears.
  const canStart = isIdleLike && !roundAnimating && balance >= bet && bet >= minBet;
  const canStep = status === 'active' && !actionPending;
  const canCashOut = status === 'active' && step >= 1 && !actionPending;

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {isIdleLike ? (
        <PlankButton onClick={onStart} disabled={!canStart} tall={tall}>
          {balance < bet ? 'Balance trop juste' : `Jouer — ${bet} €`}
        </PlankButton>
      ) : (
        <>
          <PlankButton onClick={onStep} disabled={!canStep} tall={tall}>
            Avancer →
          </PlankButton>
          <PlankButton onClick={onCashOut} disabled={!canCashOut} tall={tall} cashout>
            Encaisser{step >= 1 ? ` ${(activeBet * multiplier).toFixed(2)} €` : ''}
          </PlankButton>
        </>
      )}
    </div>
  );
}
