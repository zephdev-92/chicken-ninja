import { DIFFICULTIES } from '../shared/gameConfig';
import { theme } from '../theme';
import iconStar from '../assets/icons/icon-star.png';

// Compact horizontal ticker — sits as a thin strip between the header and the
// game canvas, mirrors the "Live wins" bar of reference casino games.
export default function CashoutFeed({ feed }) {
  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', overflowX: 'auto',
        background: theme.surfaceAlt, borderBottom: `1px solid ${theme.borderSoft}`,
        fontSize: '12px', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: theme.textMuted, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
        <img src={iconStar} alt="" width={14} height={14} /> Gains récents
      </span>
      {feed.length === 0 ? (
        <span style={{ color: theme.disabledText }}>en attente des premiers gains…</span>
      ) : (
        feed.map((entry, i) => (
          <span
            key={i}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px',
              padding: '3px 9px', borderRadius: '999px',
              background: theme.successSoft, border: `1px solid ${theme.success}33`,
            }}
          >
            <span style={{ color: theme.textMuted, fontFamily: theme.fontMono, fontSize: '11px' }}>#{entry.shortId}</span>
            <span style={{ color: theme.textMuted }}>{DIFFICULTIES[entry.difficulty]?.label ?? entry.difficulty}</span>
            <span style={{ color: theme.success, fontWeight: 700 }}>{entry.multiplier.toFixed(2)}x</span>
            <span style={{ color: theme.success, fontWeight: 700 }}>+{entry.payout} €</span>
          </span>
        ))
      )}
    </div>
  );
}
