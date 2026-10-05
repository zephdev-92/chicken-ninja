import { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import CashoutFeed from './components/CashoutFeed';
import GameCanvas from './components/GameCanvas';
import DifficultySelector from './components/DifficultySelector';
import BetPanel from './components/BetPanel';
import Drawer from './components/Drawer';
import { useChickenGame } from './hooks/useChickenGame';
import { useSound } from './hooks/useSound';
import { useMediaQuery } from './hooks/useMediaQuery';
import { theme } from './theme';

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
        <Header balance={balance} onMenuClick={() => setDrawerOpen(true)} />
        <CashoutFeed feed={cashoutFeed} />

        {/* The road is the game — it grows to fill whatever space the control tray below
            doesn't need, instead of sitting in a fixed compact band with a dead gap
            beneath it (PixiRenderer is height-agnostic: track stays bottom-anchored). */}
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
          <GameCanvas
            status={status} step={step_} lanes={lanes} lastOutcome={lastOutcome}
            difficulty={status === 'active' ? difficulty : selectedDifficulty}
            onBusyChange={setRoundAnimating}
            onSound={handleGameSound}
          />
        </div>

        {/* Sized to its own content, pinned to the bottom — no flex:1/justify-center,
            which was centering the controls inside leftover space and reading as a
            blank cream void instead of "generous padding". Stacked column on phones,
            one full-width row (difficulty+status | bet+actions) on wide screens. */}
        <div style={{
          flex: '0 0 auto', background: theme.bgDeep, borderTop: `1px solid ${theme.borderSoft}`,
          ...(wide
            ? { padding: '16px 24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: '24px', alignItems: 'center' }
            : { padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }),
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: wide ? '10px' : '16px', minWidth: 0 }}>
            <DifficultySelector
              difficultyKeys={difficultyKeys}
              difficulties={difficulties}
              selected={selectedDifficulty}
              onSelect={setDifficulty}
              disabled={!isIdleLike}
            />

            <div style={{ fontSize: '11px', color: theme.textMuted, minHeight: '14px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span>{message}</span>
              {status === 'active' && (
                <span style={{ color: theme.warning, fontWeight: 700 }}>
                  · {lanesRemaining} restante{lanesRemaining > 1 ? 's' : ''}
                </span>
              )}
              {status === 'cashed' && cashoutMultiplier != null && (
                <span style={{ color: theme.success, fontWeight: 700 }}>· {cashoutMultiplier.toFixed(2)}x</span>
              )}
            </div>
          </div>

          <BetPanel
            wide={wide}
            bet={bet} setBet={setBet} betError={betError}
            minBet={minBet} maxBet={maxBet} balance={balance}
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
