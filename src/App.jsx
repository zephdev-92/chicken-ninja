import { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import CashoutFeed from './components/CashoutFeed';
import GameCanvas from './components/GameCanvas';
import MultiplierLadder from './components/MultiplierLadder';
import DifficultySelector from './components/DifficultySelector';
import BetPanel from './components/BetPanel';
import Drawer from './components/Drawer';
import { useChickenGame } from './hooks/useChickenGame';
import { useSound } from './hooks/useSound';

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
    <div style={{ position: 'fixed', inset: 0, background: '#05070c', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%', maxWidth: '480px', height: '100dvh',
          display: 'flex', flexDirection: 'column',
          background: '#0b0f18', color: 'white', fontFamily: 'Inter, Arial, sans-serif',
          overflow: 'hidden', boxShadow: '0 0 60px rgba(0,0,0,0.6)',
        }}
      >
        <Header balance={balance} onMenuClick={() => setDrawerOpen(true)} />
        <CashoutFeed feed={cashoutFeed} />

        <div style={{ flex: 1, minHeight: 0 }}>
          <GameCanvas status={status} step={step_} lanes={lanes} lastOutcome={lastOutcome} />
        </div>

        <MultiplierLadder difficulty={status === 'active' ? difficulty : selectedDifficulty} step={step_} />

        <div style={{ flex: '0 0 auto', padding: '10px 12px', display: 'grid', gap: '8px', background: '#0d1420', borderTop: '1px solid rgba(138,184,255,0.08)' }}>
          <DifficultySelector
            difficultyKeys={difficultyKeys}
            difficulties={difficulties}
            selected={selectedDifficulty}
            onSelect={setDifficulty}
            disabled={!isIdleLike}
          />

          <div style={{ fontSize: '11px', color: '#8a9cb4', minHeight: '14px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span>{message}</span>
            {status === 'active' && (
              <span style={{ color: '#ffb020', fontWeight: 700 }}>
                · {lanesRemaining} restante{lanesRemaining > 1 ? 's' : ''}
              </span>
            )}
            {status === 'cashed' && cashoutMultiplier != null && (
              <span style={{ color: '#27c383', fontWeight: 700 }}>· {cashoutMultiplier.toFixed(2)}x</span>
            )}
          </div>

          <BetPanel
            bet={bet} setBet={setBet} betError={betError}
            minBet={minBet} maxBet={maxBet} balance={balance}
            status={status} isIdleLike={isIdleLike} actionPending={actionPending}
            step={step_} multiplier={multiplier} activeBet={activeBet}
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
