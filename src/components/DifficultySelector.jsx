import { theme } from '../theme';
import { skinStyle } from './buttonSkin';

export default function DifficultySelector({ difficultyKeys, difficulties, selected, onSelect, disabled }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {difficultyKeys.map((key) => {
        const d = difficulties[key];
        const active = key === selected;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            disabled={disabled}
            style={{
              ...skinStyle('level', { disabled: disabled && !active }),
              // Zoomed in past `cover` so the target rings read larger behind the label
              backgroundSize: 'auto 150%',
              ...(active && {
                boxShadow: `0 0 0 3px ${theme.accentGold}, 0 3px 0 3px ${theme.accentDeep}`,
              }),
              textShadow: `0 0 3px ${theme.surface}, 0 0 2px ${theme.surface}`,
              flex: '1 1 0',
              minHeight: '44px',
              padding: '9px 4px',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              transition: 'opacity 150ms ease',
            }}
          >
            {d.label} {Math.round(d.deathChance * 100)}%
          </button>
        );
      })}
    </div>
  );
}
