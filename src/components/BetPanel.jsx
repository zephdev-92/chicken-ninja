import { useState } from 'react';
import { theme } from '../theme';
import { WOOD, frame, woodText, inkText } from './woodSkin';
import { useI18n } from '../i18n/react/useI18n';

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

function ArrowButton({ dir, onClick, disabled, label, compact }) {
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
        width: compact ? '16px' : '22px', height: compact ? '13px' : '18px', padding: 0, border: 'none',
        background: `url(${img}) center / contain no-repeat`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transform: pressed && !disabled ? 'scale(0.9)' : 'none',
      }}
    />
  );
}

function QuickButton({ onClick, disabled, children, compact }) {
  const { pressed, handlers } = usePress();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...handlers}
      style={{
        ...frame(WOOD.miseBtn, 8, compact ? '3px' : '4px'),
        ...woodText,
        minWidth: 0, width: '100%', height: '100%', padding: 0, overflow: 'hidden',
        fontSize: compact ? '13px' : '16px',
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
//
// One grid row whose columns are all minmax(0, …): the counter takes ~1.8 shares and
// each quick button one, so the whole row always shrinks to fit its block.
export function BetControls({ bet, setBet, betError, minBet, maxBet, balance, isIdleLike, compact = false, width = '100%' }) {
  const { t, translate, fmt } = useI18n();
  const disabled = !isIdleLike;
  const betLabel = t('game.bet');
  // The label sits in the fixed light-wood third of the counter artwork: longer
  // words ("Einsatz", "Puntata") get a smaller size instead of spilling out of it.
  const labelSize = (compact ? 13 : 17) * Math.min(1, 6 / Math.max(6, betLabel.length));
  const symbol = <span style={{ ...inkText, fontSize: compact ? '15px' : '20px', flexShrink: 0 }}>{fmt.currencySymbol}</span>;
  return (
    <div style={{ display: 'grid', gap: '4px', width, maxWidth: '100%', minWidth: 0 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `${compact ? 'minmax(0, 2.2fr)' : 'minmax(150px, 2fr)'} repeat(4, minmax(0, 1fr))`,
        gap: compact ? '4px' : '6px', height: compact ? '44px' : '60px', alignItems: 'stretch',
      }}>
        <div style={{
          position: 'relative', minWidth: 0,
          background: `url(${WOOD.miseCounter}) center / 100% 100% no-repeat`,
          opacity: disabled ? 0.75 : 1,
        }}>
          <span style={{
            ...inkText, position: 'absolute', left: 0, width: '34%', top: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${labelSize.toFixed(1)}px`,
            whiteSpace: 'nowrap', overflow: 'hidden',
          }}>
            {betLabel}
          </span>
          {/* Paper field of the artwork spans ~36%→95% horizontally, ~20%→80% vertically */}
          <div style={{
            position: 'absolute', left: '37%', right: '6%', top: '18%', bottom: '18%',
            display: 'flex', alignItems: 'center', gap: '2px', paddingLeft: compact ? '3px' : '6px',
          }}>
            {fmt.currencySymbolFirst && symbol}
            <input
              type="text"
              inputMode="numeric"
              aria-label={betLabel}
              value={bet}
              disabled={disabled}
              onChange={e => setBet(Number(e.target.value.replace(/\D/g, '')) || 0)}
              style={{
                ...inkText, flex: '1 1 auto', minWidth: 0, width: '100%',
                border: 'none', background: 'transparent', outline: 'none', padding: 0,
                fontSize: compact ? '15px' : '20px', textAlign: fmt.currencySymbolFirst ? 'left' : 'right', fontVariantNumeric: 'tabular-nums',
                cursor: disabled ? 'not-allowed' : 'text',
              }}
            />
            {!fmt.currencySymbolFirst && symbol}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0, marginLeft: '2px' }}>
              <ArrowButton dir="up" label={t('game.increaseBet')} disabled={disabled} compact={compact}
                onClick={() => setBet(Math.min(maxBet, bet + 1))} />
              <ArrowButton dir="down" label={t('game.decreaseBet')} disabled={disabled} compact={compact}
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
          <QuickButton key={label} onClick={fn} disabled={disabled} compact={compact}>{label}</QuickButton>
        ))}
      </div>

      {betError && (
        <div style={{ ...woodText, fontWeight: 700, color: theme.accentGold, fontSize: compact ? '11px' : '13px', paddingLeft: '4px' }}>{translate(betError)}</div>
      )}
    </div>
  );
}

// Red plank (PLAY-BTN-ACTIVE), orange while pressed (PLAY-BTN-CLICK), weathered
// grey-brown when unavailable (PLAY-BTN-OFF). The cashout plank uses the weathered
// PLAY-BTN-OFF artwork as its normal look so it reads apart from "Avancer" — its
// disabled state is therefore faded out instead of swapping artwork.
function PlankButton({ onClick, disabled, children, tall, compact, cashout = false }) {
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
        ...frame(img, '36 44', compact ? '10px 13px' : '16px 20px'),
        ...woodText,
        flex: '1 1 0', minWidth: 0, overflow: 'hidden',
        minHeight: compact ? '50px' : tall ? '84px' : '72px', padding: '0 4px',
        // Wide screens: scales with the viewport so two planks side by side still fit their labels
        fontSize: compact ? '17px' : tall ? 'clamp(15px, 1.35vw, 26px)' : '22px', fontVariant: 'small-caps', letterSpacing: '0.04em',
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
  onStart, onStep, onCashOut, tall = false, compact = false,
}) {
  const { t } = useI18n();
  // isIdleLike flips true the instant a round busts/cashes out, but the road
  // still needs ~half a second to play out the shuriken/KO animation — starting
  // a new round before that finishes yanks the scene out from under it (see
  // PixiRenderer.reset()), so the button stays locked until roundAnimating clears.
  const canStart = isIdleLike && !roundAnimating && balance >= bet && bet >= minBet;
  const canStep = status === 'active' && !actionPending;
  const canCashOut = status === 'active' && step >= 1 && !actionPending;

  return (
    <div style={{ display: 'flex', gap: compact ? '6px' : '8px', minWidth: 0 }}>
      {isIdleLike ? (
        <PlankButton onClick={onStart} disabled={!canStart} tall={tall} compact={compact}>
          {balance < bet ? t('game.insufficientBalance') : t('game.play', { amount: bet })}
        </PlankButton>
      ) : (
        <>
          <PlankButton onClick={onStep} disabled={!canStep} tall={tall} compact={compact}>
            {t('game.advance')}
          </PlankButton>
          <PlankButton onClick={onCashOut} disabled={!canCashOut} tall={tall} compact={compact} cashout>
            {step >= 1 ? t('game.cashOutAmount', { amount: activeBet * multiplier }) : t('game.cashOut')}
          </PlankButton>
        </>
      )}
    </div>
  );
}
