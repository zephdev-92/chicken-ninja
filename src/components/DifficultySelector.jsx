import { theme } from '../theme';
import { WOOD, frame, woodText, inkText } from './woodSkin';

// Four wood tiles: red plank (LEVEL-ON) for the selected level, raw wood (LEVEL-OFF)
// for the others. Each carries a radio-style disc (BTN-CHECK-ON/OFF), ticked on the
// selected one only — dropped on compact screens, where the red tile alone marks it.
// Columns are minmax(0, …) so the tiles always shrink to the block, never overflow it.
export default function DifficultySelector({ difficultyKeys, difficulties, selected, onSelect, disabled, compact = false, fixedWidth = false, narrow = false }) {
  return (
    // Wide screens: fixed-width tiles so the wood texture isn't stretched into long planks
    <div style={{
      display: 'grid', gap: compact ? '5px' : '8px', minWidth: 0,
      gridTemplateColumns: `repeat(${difficultyKeys.length}, ${fixedWidth ? (compact ? '96px' : narrow ? '100px' : '112px') : 'minmax(0, 1fr)'})`,
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
              ...frame(active ? WOOD.levelOn : WOOD.levelOff, 12, compact ? '4px' : '6px'),
              ...(active ? woodText : inkText),
              minWidth: 0, overflow: 'hidden',
              height: compact ? '46px' : '82px',
              padding: '0 2px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: compact ? 0 : '2px',
              fontSize: compact ? '12px' : '15px', lineHeight: 1.1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: dim ? 0.55 : 1,
              filter: dim ? 'grayscale(0.4)' : 'none',
              transition: 'opacity 150ms ease, transform 120ms ease',
              boxShadow: active ? `0 0 0 2px ${theme.accentGold}` : 'none',
              borderRadius: '6px',
            }}
          >
            <span style={{ whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
            <span style={{ fontSize: '1.15em' }}>{Math.round(d.deathChance * 100)}%</span>
            {!compact && (
              <span style={{
                width: '20px', height: '20px', marginTop: '2px',
                backgroundImage: `url(${active ? WOOD.checkOn : WOOD.checkOff})`, backgroundSize: '100% 100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', lineHeight: 1, color: theme.accent, textShadow: 'none',
              }}>
                {active ? '✓' : ''}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
