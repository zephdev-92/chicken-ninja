import { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';
import { WOOD, frame, woodText } from './woodSkin';
import { useI18n } from '../i18n/react/useI18n';

// End-of-round board over the scene: BOARD-WIN after a cashout, BOARD-LOOSE after a
// ninja star. Appears once the chicken's own animation is over (roundAnimating false,
// plus a short settle delay so it never pops up before the bust sequence starts) and
// goes away on a new round, the store's auto-return to idle, a tap outside it or Esc.
//
// Sized in container units: the scene wrapper in App.jsx is a size container, so the
// board fits whatever height the scene has (phones in compact mode included); the board
// is itself an inline-size container, so its text scales with it.

const SHOW_DELAY_MS = 350;
const BOARD_RATIO = 591 / 378; // native size of both board PNGs

// Free area of each artwork (percent of the board), left clear of the chicken; the
// close button goes in an empty corner that the (right-aligned on loss) title avoids.
const LAYOUT = {
  win:  { left: '42%', right: '7%', top: '17%', bottom: '14%', align: 'center', close: { top: '10%', right: '6%' } },
  loss: { left: '10%', right: '8%', top: '13%', bottom: '12%', align: 'right', close: { top: '10%', left: '6%' } },
};

function ReplayButton({ onClick, disabled, children }) {
  const [pressed, setPressed] = useState(false);
  const img = disabled ? WOOD.playOff : pressed ? WOOD.playClick : WOOD.playActive;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...frame(img, '36 44', '1.8cqi 2.2cqi'),
        ...woodText,
        width: '100%', minHeight: '13cqi', padding: '0 1cqi',
        fontSize: '4.4cqi', fontVariant: 'small-caps', letterSpacing: '0.03em', lineHeight: 1.05,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: pressed && !disabled ? 'translateY(2px)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

export default function ResultBoard({ status, roundAnimating, result, bet, canReplay, onReplay }) {
  const { t } = useI18n();
  // Round number whose end has "settled" (animation over + delay elapsed). Visibility
  // is derived from it rather than toggled, so nothing is set synchronously in an effect.
  const [settledRound, setSettledRound] = useState(null);
  const [dismissedRound, setDismissedRound] = useState(null);
  const boardRef = useRef(null);

  const finished = (status === 'cashed' || status === 'busted') && result != null;
  const kind = status === 'cashed' ? 'win' : 'loss';
  const pendingRound = finished && !roundAnimating ? result.round : null;

  useEffect(() => {
    if (pendingRound == null) return undefined;
    const timer = setTimeout(() => setSettledRound(pendingRound), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pendingRound]);

  const open = pendingRound != null && settledRound === pendingRound && dismissedRound !== pendingRound;

  useEffect(() => {
    if (!open) return undefined;
    boardRef.current?.animate(
      [{ opacity: 0, transform: 'scale(0.82) translateY(12px)' }, { opacity: 1, transform: 'scale(1) translateY(0)' }],
      { duration: 280, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.15)' },
    );
    const onKey = (e) => { if (e.key === 'Escape') setDismissedRound(result.round); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, result]);

  if (!open) return null;

  const area = LAYOUT[kind];
  const dismiss = () => setDismissedRound(result.round);

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'absolute', inset: 0, zIndex: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(20,8,2,0.35)',
      }}
    >
      <div
        ref={boardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="result-board-title"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', containerType: 'inline-size',
          width: `min(92cqw, ${(88 * BOARD_RATIO).toFixed(1)}cqh, 600px)`, aspectRatio: `${BOARD_RATIO}`,
          background: `url(${kind === 'win' ? WOOD.boardWin : WOOD.boardLoss}) center / 100% 100% no-repeat`,
          filter: 'drop-shadow(0 8px 18px rgba(20,8,2,0.55))',
        }}
      >
        <div style={{
          position: 'absolute', left: area.left, right: area.right, top: area.top, bottom: area.bottom,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          alignItems: area.align === 'right' ? 'flex-end' : 'center', textAlign: area.align,
          gap: '2cqi',
        }}>
          {kind === 'win' ? (
            <div style={{ display: 'grid', gap: '1.2cqi', justifyItems: 'center' }}>
              <h2 id="result-board-title" style={{ ...woodText, margin: 0, fontSize: '7.5cqi', lineHeight: 1 }}>
                {t('result.winTitle')}
              </h2>
              <div style={{
                ...woodText, fontSize: '10cqi', lineHeight: 1, color: theme.accentGold,
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}>
                {t('result.winAmount', { amount: result.payout })}
              </div>
              <div style={{ ...woodText, fontWeight: 700, fontSize: '3.6cqi' }}>
                {t('result.winDetail', { multiplier: result.multiplier, step: result.step })}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1.4cqi', justifyItems: 'end', maxWidth: '78%' }}>
              <h2 id="result-board-title" style={{ ...woodText, margin: 0, fontSize: '7.5cqi', lineHeight: 1 }}>
                {t('result.lossTitle')}
              </h2>
              <div style={{ ...woodText, fontWeight: 700, fontSize: '3.8cqi' }}>
                {t('result.lossDetail', { step: result.step, amount: result.bet })}
              </div>
              <div style={{ ...woodText, fontSize: '4.6cqi', color: theme.accentGold }}>
                {t('result.lossRetry')}
              </div>
            </div>
          )}

          <div style={{ width: kind === 'win' ? '92%' : '52%' }}>
            <ReplayButton onClick={onReplay} disabled={!canReplay}>
              {t('result.playAgain', { amount: bet })}
            </ReplayButton>
          </div>
        </div>

        <button
          onClick={dismiss}
          aria-label={t('common.close')}
          style={{
            position: 'absolute', ...area.close,
            width: '7cqi', height: '7cqi', padding: 0, border: 'none', borderRadius: '50%',
            background: `url(${WOOD.checkOff}) center / 100% 100% no-repeat`,
            fontFamily: theme.fontWood, fontWeight: 800, fontSize: '3.6cqi', lineHeight: 1,
            color: theme.woodInk, cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
