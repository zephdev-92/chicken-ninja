import { theme } from '../theme';
import { WOOD, frame, woodText, inkText } from './woodSkin';

// Four wood tiles: red plank (LEVEL-ON) for the selected level, raw wood (LEVEL-OFF)
// for the others. Each carries a radio-style disc (BTN-CHECK-ON/OFF), ticked on the
// selected one only.
export default function DifficultySelector({ difficultyKeys, difficulties, selected, onSelect, disabled, compact = false }) {
  return (
    // Wide screens: fixed-width tiles so the wood texture isn't stretched into long planks
    <div style={{
      display: 'grid', gap: '8px',
      gridTemplateColumns: `repeat(${difficultyKeys.length}, ${compact ? 'minmax(0, 1fr)' : '112px'})`,
    }}>
      {difficultyKeys.map((key) => {
        const d = difficulties[key];
        const active = key === selected;
        const dim = disabled && !active;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            disabled={disabled}
            aria-pressed={active}
            style={{
              ...frame(active ? WOOD.levelOn : WOOD.levelOff, 12, '6px'),
              ...(active ? woodText : inkText),
              minHeight: compact ? '74px' : '82px',
              padding: '4px 2px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
              fontSize: compact ? '14px' : '15px', lineHeight: 1.1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: dim ? 0.55 : 1,
              filter: dim ? 'grayscale(0.4)' : 'none',
              transition: 'opacity 150ms ease, transform 120ms ease',
              boxShadow: active ? `0 0 0 2px ${theme.accentGold}` : 'none',
              borderRadius: '6px',
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>{d.label}</span>
            <span style={{ fontSize: '1.15em' }}>{Math.round(d.deathChance * 100)}%</span>
            <span style={{
              position: 'relative', width: '20px', height: '20px', marginTop: '2px',
              backgroundImage: `url(${active ? WOOD.checkOn : WOOD.checkOff})`, backgroundSize: '100% 100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', lineHeight: 1, color: theme.accent, textShadow: 'none',
            }}>
              {active ? '✓' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
