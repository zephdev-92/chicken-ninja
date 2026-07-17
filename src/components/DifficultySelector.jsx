const ACCENT = {
  easy:     '#27c383',
  medium:   '#ffb020',
  hard:     '#ff7864',
  hardcore: '#ff4d6d',
};

export default function DifficultySelector({ difficultyKeys, difficulties, selected, onSelect, disabled }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {difficultyKeys.map((key) => {
        const d = difficulties[key];
        const active = key === selected;
        const color = ACCENT[key] ?? '#8ab8ff';
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            disabled={disabled}
            style={{
              flex: '1 1 0',
              padding: '7px 4px',
              borderRadius: '9px',
              border: `1px solid ${active ? color : '#27303f'}`,
              background: active ? `${color}22` : '#0a1220',
              color: active ? color : '#8ab8ff',
              fontWeight: 700,
              fontSize: '11px',
              whiteSpace: 'nowrap',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled && !active ? 0.5 : 1,
              transition: 'all 0.15s',
            }}
          >
            {d.label} <span style={{ fontWeight: 400, color: active ? color : '#4a6a8a' }}>{Math.round(d.deathChance * 100)}%</span>
          </button>
        );
      })}
    </div>
  );
}
