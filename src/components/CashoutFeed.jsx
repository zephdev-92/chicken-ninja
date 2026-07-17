import { DIFFICULTIES } from '../shared/gameConfig';

// Compact horizontal ticker — sits as a thin strip between the header and the
// game canvas, mirrors the "Live wins" bar of reference casino games.
export default function CashoutFeed({ feed }) {
  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', overflowX: 'auto',
        background: '#0a1220', borderBottom: '1px solid rgba(138,184,255,0.06)',
        fontSize: '12px', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: '#4a6a8a', flexShrink: 0 }}>🏆 Gains récents</span>
      {feed.length === 0 ? (
        <span style={{ color: '#3a4a5f' }}>en attente des premiers gains…</span>
      ) : (
        feed.map((entry, i) => (
          <span
            key={i}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px',
              padding: '3px 9px', borderRadius: '999px',
              background: 'rgba(39,195,131,0.08)', border: '1px solid rgba(39,195,131,0.15)',
            }}
          >
            <span style={{ color: '#7a8fa8', fontFamily: 'monospace', fontSize: '11px' }}>#{entry.shortId}</span>
            <span style={{ color: '#9aa5b8' }}>{DIFFICULTIES[entry.difficulty]?.label ?? entry.difficulty}</span>
            <span style={{ color: '#27c383', fontWeight: 700 }}>{entry.multiplier.toFixed(2)}x</span>
            <span style={{ color: '#27c383', fontWeight: 700 }}>+{entry.payout} €</span>
          </span>
        ))
      )}
    </div>
  );
}
