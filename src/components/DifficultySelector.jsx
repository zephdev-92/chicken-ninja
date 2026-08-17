import { theme } from '../theme';

const ACCENT = {
  easy:     '#2e8b57',
  medium:   '#f0a828',
  hard:     '#c0392b',
  hardcore: '#8b1a1a',
};

export default function DifficultySelector({ difficultyKeys, difficulties, selected, onSelect, disabled }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {difficultyKeys.map((key) => {
        const d = difficulties[key];
        const active = key === selected;
        const color = ACCENT[key] ?? theme.accent;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            disabled={disabled}
            style={{
              flex: '1 1 0',
              minHeight: '44px', boxSizing: 'border-box',
              padding: '9px 4px',
              borderRadius: '9px',
              border: `1px solid ${active ? color : theme.border}`,
              background: active ? `${color}22` : theme.surfaceAlt,
              color: active ? color : theme.textMuted,
              fontWeight: 700,
              fontSize: '11px',
              whiteSpace: 'nowrap',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled && !active ? 0.5 : 1,
              transition: 'background 150ms ease, border-color 150ms ease, opacity 150ms ease',
            }}
          >
            {d.label} <span style={{ fontWeight: 400, color: active ? color : theme.textMuted }}>{Math.round(d.deathChance * 100)}%</span>
          </button>
        );
      })}
    </div>
  );
}
