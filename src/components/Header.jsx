import { theme } from '../theme';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { WOOD, frame, inkText, woodText } from './woodSkin';

export default function Header({ balance, onMenuClick }) {
  const wide = useMediaQuery('(min-width: 900px)');
  return (
    <header
      style={{
        flex: '0 0 auto',
        height: wide ? '84px' : '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: wide ? '0 16px' : '0 10px',
        position: 'relative',
        // BG-HEADER (logo baked in) pinned left and fitted to the header height; its right
        // edge fades out to cream, which runs on into theme.surface beyond it. Phones shift
        // it left a little so the baked-in logo clears the balance and menu buttons.
        background: `url(${WOOD.headerBg}) ${wide ? 'left' : '-64px'} center / auto 100% no-repeat, ${theme.surface}`,
        borderBottom: `1px solid ${theme.borderSoft}`,
      }}
    >
      {/* The wordmark is painted into BG-HEADER, so this empty heading carries its
          accessible name/tooltip. */}
      <h1
        role="img"
        aria-label="CHICKEN NINJA"
        title="CHICKEN NINJA"
        style={{ margin: 0, alignSelf: 'stretch', width: wide ? '420px' : '220px', flexShrink: 1, minWidth: 0 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: 'auto', position: 'relative' }}>
        <div
          style={{
            ...frame(WOOD.cartoucheWhite, 26, '8px 10px'),
            ...inkText, padding: '2px 10px', fontSize: '16px', fontVariantNumeric: 'tabular-nums',
          }}
        >
          {balance.toFixed(2)} €
        </div>
        <button
          onClick={onMenuClick}
          aria-label="Menu"
          style={{
            ...frame(WOOD.miseBtn, 8, '4px'),
            ...woodText,
            width: '40px', height: '46px', padding: 0, fontSize: '20px', lineHeight: 1,
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ☰
        </button>
      </div>
    </header>
  );
}
