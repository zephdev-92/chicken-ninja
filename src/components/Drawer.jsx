import ProvablyFair from './ProvablyFair';

export default function Drawer({
  open, onClose,
  walletBalance, balance, depositToBankroll, withdrawFromBankroll,
  provablyFair, onSetClientSeed, status,
  history, difficulties,
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(360px, 92vw)', height: '100%', background: '#111820',
          overflowY: 'auto', padding: '16px', boxSizing: 'border-box',
          display: 'grid', gap: '16px', alignContent: 'start',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Menu</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: '30px', height: '30px', borderRadius: '9px', border: 'none',
              background: '#0a1220', color: '#8ab8ff', fontSize: '15px', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ borderRadius: '16px', border: '1px solid rgba(138,184,255,0.1)', background: 'rgba(15,23,38,0.6)', padding: '14px', display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#0a1220' }}>
              <div style={{ color: '#8ab8ff', fontSize: '11px' }}>Wallet</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{walletBalance.toFixed(2)} €</div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#0a1220' }}>
              <div style={{ color: '#8ab8ff', fontSize: '11px' }}>Balance jeu</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{balance.toFixed(2)} €</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ color: '#4a6a8a', fontSize: '11px', marginRight: '2px' }}>wallet ↔ balance</span>
            <button onClick={() => depositToBankroll(10)}  style={walletBtn('#1e3a7a', '#8ab8ff')}>+10 €</button>
            <button onClick={() => depositToBankroll(50)}  style={walletBtn('#1e3a7a', '#8ab8ff')}>+50 €</button>
            <button onClick={() => withdrawFromBankroll(10)} style={walletBtn('#3a1a1a', '#ff8a7a')}>-10 €</button>
            <button onClick={() => withdrawFromBankroll(50)} style={walletBtn('#3a1a1a', '#ff8a7a')}>-50 €</button>
          </div>
        </div>

        <ProvablyFair provablyFair={provablyFair} onSetClientSeed={onSetClientSeed} status={status} />

        <div>
          <div style={{ color: '#8ab8ff', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Historique
          </div>
          {history.length === 0 ? (
            <p style={{ color: '#7e8ca4', fontSize: '12px' }}>Aucun tour terminé pour le moment.</p>
          ) : (
            <div style={{ display: 'grid', gap: '6px' }}>
              {history.map((entry, index) => {
                const isBust = entry.result === 'busted';
                return (
                  <div key={index} style={{ padding: '8px 10px', borderRadius: '10px', background: '#0f1726' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#4a6a8a', flexShrink: 0 }}>#{entry.round}</span>
                      <span style={{
                        padding: '1px 7px', borderRadius: '999px',
                        background: isBust ? '#2d1111' : '#0a2d1e',
                        color:      isBust ? '#ff5a5a' : '#27c383',
                        fontSize: '11px', fontWeight: 700,
                      }}>
                        {difficulties[entry.difficulty]?.label ?? entry.difficulty}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: isBust ? '#ff5a5a' : '#27c383' }}>
                        {isBust ? 'Étoile' : 'Encaissé'}
                      </span>
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#5a7a9a' }}>
                      {entry.bet} € · case {entry.step} ·{' '}
                      {isBust
                        ? `perdu ${Math.abs(entry.profit).toFixed(2)} €`
                        : `${entry.multiplier?.toFixed(2)}x · +${entry.payout?.toFixed(2)} €`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function walletBtn(bg, color) {
  return {
    padding: '5px 9px', borderRadius: '8px', border: 'none',
    background: bg, color, cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  };
}
