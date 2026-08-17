import { theme } from '../theme';

export default function Header({ balance, onMenuClick }) {
  return (
    <header
      style={{
        flex: '0 0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px',
        background: theme.surface,
        borderBottom: `1px solid ${theme.borderSoft}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            fontFamily: theme.fontDisplay, fontSize: '19px', letterSpacing: '0.02em',
            color: theme.accent, textShadow: `1px 1px 0 ${theme.textPrimary}`,
          }}
        >
          CHICKEN NINJA
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            padding: '6px 12px', borderRadius: '999px', background: theme.surfaceAlt,
            border: `1px solid ${theme.border}`, fontSize: '13px', fontWeight: 700, color: theme.success,
          }}
        >
          {balance.toFixed(2)} €
        </div>
        <button
          onClick={onMenuClick}
          aria-label="Menu"
          style={{
            width: '34px', height: '34px', borderRadius: '10px', border: `1px solid ${theme.border}`,
            background: theme.surfaceAlt, color: theme.accent, fontSize: '16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          ☰
        </button>
      </div>
    </header>
  );
}
