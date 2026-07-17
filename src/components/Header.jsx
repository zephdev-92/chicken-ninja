export default function Header({ balance, onMenuClick }) {
  return (
    <header
      style={{
        flex: '0 0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px',
        background: '#0d1420',
        borderBottom: '1px solid rgba(138,184,255,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '15px' }}>
        <span>🐔🥷</span>
        <span>Chicken Ninja</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            padding: '6px 12px', borderRadius: '999px', background: '#0a1220',
            border: '1px solid #27303f', fontSize: '13px', fontWeight: 700, color: '#27c383',
          }}
        >
          {balance.toFixed(2)} €
        </div>
        <button
          onClick={onMenuClick}
          aria-label="Menu"
          style={{
            width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #27303f',
            background: '#0a1220', color: '#8ab8ff', fontSize: '16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          ☰
        </button>
      </div>
    </header>
  );
}
