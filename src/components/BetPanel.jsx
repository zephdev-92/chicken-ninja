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
          borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(15,23,38,0.6)', padding: '7px 8px',
          display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap',
        }}
      >
        <span style={{ color: '#8ab8ff', fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0 }}>Mise</span>
        <input
          type="number"
          min={minBet}
          max={Math.min(maxBet, balance)}
          step="1"
          value={bet}
          disabled={!isIdleLike}
          onChange={e => setBet(Number(e.target.value) || 0)}
          style={{
            width: '48px', minWidth: 0, flexShrink: 1,
            padding: '5px 6px', borderRadius: '8px',
            border: '1px solid #27303f', background: '#0a1220', color: 'white',
            fontSize: '13px', fontWeight: 600,
          }}
        />
        {[
          { label: 'Min', fn: () => setBet(minBet) },
          { label: '½',   fn: () => setBet(Math.max(minBet, Math.floor(bet / 2))) },
          { label: '2×',  fn: () => setBet(bet * 2) },
          { label: 'Max', fn: () => setBet(Math.min(maxBet, balance)) },
        ].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            disabled={!isIdleLike}
            style={{
              flexShrink: 0,
              padding: '4px 6px', borderRadius: '7px', border: '1px solid #27303f',
              background: '#0a1220', color: '#8ab8ff', fontSize: '11px', fontWeight: 600,
              cursor: isIdleLike ? 'pointer' : 'not-allowed', opacity: isIdleLike ? 1 : 0.5,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {isIdleLike ? (
          <button
            onClick={onStart}
            disabled={!canStart}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: '12px', border: 'none',
              background: canStart ? '#27c383' : '#1e2a3a',
              color: canStart ? '#091219' : '#4a6a8a',
              fontWeight: 700, fontSize: '14px', cursor: canStart ? 'pointer' : 'not-allowed',
            }}
          >
            {balance < bet ? 'Balance trop juste' : `Jouer — ${bet} €`}
          </button>
        ) : (
          <>
            <button
              onClick={onStep}
              disabled={!canStep}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: '12px', border: 'none',
                background: canStep ? '#4768ff' : '#1e2a3a',
                color: 'white', fontWeight: 700, fontSize: '14px',
                cursor: canStep ? 'pointer' : 'not-allowed',
              }}
            >
              Avancer
            </button>
            <button
              onClick={onCashOut}
              disabled={!canCashOut}
              style={{
                flex: 1, padding: '11px 14px', borderRadius: '12px', border: 'none',
                background: canCashOut ? '#ffb020' : '#1e2a3a',
                color: canCashOut ? '#091219' : '#4a6a8a', fontWeight: 700, fontSize: '14px',
                cursor: canCashOut ? 'pointer' : 'not-allowed',
              }}
            >
              Encaisser {step >= 1 ? `— ${(activeBet * multiplier).toFixed(2)} €` : ''}
            </button>
          </>
        )}
      </div>

      {betError && (
        <div style={{ color: '#ff7864', fontSize: '12px', paddingLeft: '4px' }}>{betError}</div>
      )}
    </div>
  );
}
