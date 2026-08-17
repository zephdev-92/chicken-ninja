import { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import CashoutFeed from './components/CashoutFeed';
import GameCanvas from './components/GameCanvas';
import DifficultySelector from './components/DifficultySelector';
import BetPanel from './components/BetPanel';
import Drawer from './components/Drawer';
import { useChickenGame } from './hooks/useChickenGame';
import { useSound } from './hooks/useSound';
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
  const prevStatus = useRef(status);
  const prevStep   = useRef(step_);

  useEffect(() => {
    if (status === 'active' && step_ > prevStep.current) sound.hop();
    if (status === 'busted' && prevStatus.current !== 'busted') sound.bust();
    if (status === 'cashed' && prevStatus.current !== 'cashed') sound.cashout();
    prevStatus.current = status;
    prevStep.current   = step_;
  }, [status, step_, sound]);

  return (
    // The frame is capped in both directions (maxWidth AND maxHeight), then centered —
    // on a real phone (<=900px tall) nothing changes, it still fills the screen exactly
    // like before. On a desktop browser it stops stretching into an impossibly tall
    // phone and instead reads as a mockup centered in the window, like the games it's
    // inspired by: no leftover height left to show up as dead space inside the game.
    <div style={{ position: 'fixed', inset: 0, background: theme.bgDeep, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          width: '100%', maxWidth: '480px', height: '100%', maxHeight: '860px',
          display: 'flex', flexDirection: 'column',
          background: theme.bg, color: theme.textPrimary, fontFamily: theme.fontBody,
          overflow: 'hidden', boxShadow: '0 0 60px rgba(26,14,10,0.35)',
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
          />
        </div>

        {/* Sized to its own content, pinned to the bottom — no flex:1/justify-center,
            which was centering the controls inside leftover space and reading as a
            blank cream void instead of "generous padding". */}
        <div style={{ flex: '0 0 auto', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: '16px', background: theme.bgDeep, borderTop: `1px solid ${theme.borderSoft}` }}>
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

          <BetPanel
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
