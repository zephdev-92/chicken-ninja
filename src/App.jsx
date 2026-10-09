import { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import CashoutFeed from './components/CashoutFeed';
import GameCanvas from './components/GameCanvas';
import DifficultySelector from './components/DifficultySelector';
import { BetControls, ActionButtons } from './components/BetPanel';
import { WOOD, frame, woodText } from './components/woodSkin';
import Drawer from './components/Drawer';
import { useChickenGame } from './hooks/useChickenGame';
import { useSound } from './hooks/useSound';
import { useMediaQuery } from './hooks/useMediaQuery';
import { theme } from './theme';

const sceneEdge = {
  position: 'absolute', left: 0, right: 0, zIndex: 2, pointerEvents: 'none',
  background: `url(${WOOD.edge}) left center / auto 100% repeat-x`,
  boxShadow: '0 0 6px rgba(20,8,2,0.5)',
};

export default function App() {
  const {
    walletBalance, balance,
    bet, setBet, betError,
    status, difficulty, lanes, step_, multiplier, lanesRemaining, activeBet,
    lastOutcome, cashoutMultiplier, message, history, cashoutFeed,
    selectedDifficulty, setDifficulty, isIdleLike, actionPending,
    startRound, step, cashOut,
    setClientSeed, depositToBankroll, withdrawFromBankroll,
    difficulties, difficultyKeys, provablyFair, minBet, maxBet,
  } = useChickenGame();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [roundAnimating, setRoundAnimating] = useState(false);
  const sound      = useSound();
  // Wide screens (desktop, tablet landscape) lay the control tray out as a single
  // horizontal bar across the full width instead of the stacked phone column, so the
  // road keeps as much height as possible.
  const wide       = useMediaQuery('(min-width: 900px)');
  // Only very wide screens have room for levels and bet controls side by side
  // inside the board; between 900 and 1400px they stack (board stays compact).
  const xwide      = useMediaQuery('(min-width: 1400px)');
  // Laptop-sized windows (wide enough for the side-by-side board, but short) also
  // switch to it, so the stacked board doesn't eat half the height.
  const shortWide  = useMediaQuery('(min-width: 1260px) and (max-height: 800px)');
  // Phone held sideways: very little height, plenty of width — controls go in a row.
  const landscapeShort = useMediaQuery('(orientation: landscape) and (max-height: 520px)');
  // Short or narrow viewports (real phones once browser chrome is subtracted, e.g.
  // ~360×560 on Android Firefox): every control shrinks and the cosmetic wins ticker
  // is hidden, so the road always keeps a usable share of the height.
  // Laptops (wide but ~650px tall) keep the full-size controls: only phones and
  // genuinely short windows go compact.
  const compact    = useMediaQuery('(max-width: 899px) and (max-height: 760px), (max-height: 600px), (max-width: 380px)');
  const rowTray    = wide || landscapeShort; // board | action planks side by side
  const boardRow   = xwide || shortWide || landscapeShort; // levels | bet side by side inside the board
  const prevStatus = useRef(status);

  // Cashout has no multi-stage animation ahead of it (the bounce starts the same
  // frame the round ends), so it's still safe to trigger straight off the React
  // status transition. Hop/bust are driven by GameCanvas's onSound instead — the
  // bust sequence (hop → suspense → shuriken flight) plays out ~800ms after the
  // server's status:'busted' arrives, so firing off the status change read as
  // badly out of sync with what's on screen.
  useEffect(() => {
    if (status === 'cashed' && prevStatus.current !== 'cashed') sound.cashout();
    prevStatus.current = status;
  }, [status, sound]);

  const handleGameSound = (event) => {
    if (event === 'hop') sound.hop();
    else if (event === 'impact') sound.bust();
    else if (event === 'target-hit') sound.targetHit();
  };

  return (
    // Fullscreen responsive: the game fills the whole viewport in both directions —
    // no more capped/centered phone frame. Only the control tray's arrangement changes
    // with the width (see `wide` above); the road canvas just takes whatever is left.
    <div style={{
      position: 'fixed', inset: 0, background: theme.bgDeep,
      // True app root: Drawer renders as a *sibling* of the game frame below, not a
      // child of it, so fontFamily has to live here to reach both — putting it only on
      // the frame div left the Drawer with no font-family anywhere in its ancestry,
      // falling back to the browser's serif default.
      fontFamily: theme.fontBody,
    }}>
      <div
        style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          background: theme.bg, color: theme.textPrimary,
          overflow: 'hidden',
        }}
      >
        <Header balance={balance} onMenuClick={() => setDrawerOpen(true)} compact={compact} />
        {!compact && <CashoutFeed feed={cashoutFeed} />}

        {/* The road is the game — it grows to fill whatever space the control tray below
            doesn't need, instead of sitting in a fixed compact band with a dead gap
            beneath it (PixiRenderer is height-agnostic: track stays bottom-anchored). */}
        <div style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
          <GameCanvas
            status={status} step={step_} lanes={lanes} lastOutcome={lastOutcome}
            difficulty={status === 'active' ? difficulty : selectedDifficulty}
            onBusyChange={setRoundAnimating}
            onSound={handleGameSound}
          />
          {/* Wood moulding framing the scene top and bottom — overlaid (not extra rows)
              so the canvas size and PixiRenderer layout stay untouched. */}
          <div style={{ ...sceneEdge, height: compact ? '12px' : '23px', top: 0 }} />
          <div style={{ ...sceneEdge, height: compact ? '12px' : '23px', bottom: 0 }} />
        </div>

        {/* Sized to its own content, pinned to the bottom — no flex:1/justify-center,
            which was centering the controls inside leftover space and reading as a
            blank cream void instead of "generous padding". Wood board (BOARD-WOOD,
            nine-sliced so it spans any width) holds levels/status/bet; the play plank
            sits below it on phones, to its right on wide screens. */}
        <div style={{
          flex: '0 0 auto', minWidth: 0, background: theme.bgDeep, borderTop: `1px solid ${theme.borderSoft}`,
          display: 'grid', alignItems: 'center',
          ...(rowTray
            ? {
                padding: compact ? '6px 10px' : '12px 20px', gap: compact ? '10px' : '20px',
                // Wide: board sized to its fixed-width tiles, planks take the rest.
                // Landscape phone: fluid board, narrower plank column.
                gridTemplateColumns: wide ? 'auto minmax(280px, 1fr)' : 'minmax(0, 2.6fr) minmax(140px, 1fr)',
              }
            : { padding: compact ? '6px 6px 8px' : '10px 10px 12px', gap: compact ? '6px' : '10px', gridTemplateColumns: 'minmax(0, 1fr)' }),
        }}>
          <div style={{
            ...frame(WOOD.board, 42, compact ? '10px' : rowTray ? '22px' : '16px'),
            backgroundColor: theme.woodDark, backgroundClip: 'padding-box',
            padding: compact ? '0' : rowTray ? '4px 6px' : '2px',
            minWidth: 0,
            display: 'grid', gap: compact ? '5px' : rowTray ? '18px' : '10px', alignItems: 'center',
            gridTemplateColumns: boardRow ? (wide ? 'auto auto' : 'minmax(0, 1fr) minmax(0, 1.15fr)') : 'minmax(0, 1fr)',
          }}>
            <div style={{ display: 'grid', gap: compact ? '4px' : '8px', minWidth: 0 }}>
              <DifficultySelector
                difficultyKeys={difficultyKeys}
                difficulties={difficulties}
                selected={selectedDifficulty}
                onSelect={setDifficulty}
                disabled={!isIdleLike}
                compact={compact}
                fixedWidth={wide}
                narrow={boardRow}
              />

              <div style={{
                ...(compact ? {} : frame(WOOD.cartoucheWood, 22, '8px 12px')),
                ...woodText, fontWeight: 700, fontSize: compact ? '11px' : '14px',
                minHeight: compact ? '16px' : '36px', padding: compact ? '0 4px' : '0 6px',
                display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center',
                flexWrap: compact ? 'nowrap' : 'wrap', whiteSpace: compact ? 'nowrap' : 'normal',
                overflow: 'hidden', textAlign: 'center', minWidth: 0,
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{message}</span>
                {status === 'active' && (
                  <span style={{ color: theme.accentGold, flexShrink: 0 }}>
                    · {lanesRemaining} restante{lanesRemaining > 1 ? 's' : ''}
                  </span>
                )}
                {status === 'cashed' && cashoutMultiplier != null && (
                  <span style={{ color: theme.accentGold, flexShrink: 0 }}>· {cashoutMultiplier.toFixed(2)}x</span>
                )}
              </div>
            </div>

            <BetControls
              bet={bet} setBet={setBet} betError={betError}
              minBet={minBet} maxBet={maxBet} balance={balance}
              isIdleLike={isIdleLike}
              compact={compact}
              width={boardRow && wide ? '400px' : '100%'}
            />
          </div>

          <ActionButtons
            tall={rowTray && !compact}
            compact={compact}
            bet={bet} balance={balance} minBet={minBet}
            status={status} isIdleLike={isIdleLike} actionPending={actionPending}
            step={step_} multiplier={multiplier} activeBet={activeBet}
            roundAnimating={roundAnimating}
            onStart={startRound} onStep={step} onCashOut={cashOut}
          />
        </div>
      </div>

      <Drawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        walletBalance={walletBalance} balance={balance}
        depositToBankroll={depositToBankroll} withdrawFromBankroll={withdrawFromBankroll}
        provablyFair={provablyFair} onSetClientSeed={setClientSeed} status={status}
        history={history} difficulties={difficulties}
      />
    </div>
  );
}
