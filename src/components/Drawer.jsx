import ProvablyFair from './ProvablyFair';
import { theme } from '../theme';
import { useI18n } from '../i18n/react/useI18n';

export default function Drawer({
  open, onClose,
  walletBalance, balance, depositToBankroll, withdrawFromBankroll,
  provablyFair, onSetClientSeed, status,
  history, difficulties, onOpenInfo,
}) {
  const { t, fmt, language, languages, setLanguage, currency } = useI18n();
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: theme.overlay,
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(360px, 92vw)', height: '100%', background: theme.surface,
          overflowY: 'auto', padding: '16px', boxSizing: 'border-box',
          display: 'grid', gap: '16px', alignContent: 'start',
          color: theme.textPrimary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>{t('common.menu')}</span>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              width: '30px', height: '30px', borderRadius: '9px', border: 'none',
              background: theme.surfaceAlt, color: theme.accent, fontSize: '15px', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: theme.textMuted }}>
            {t('common.language')}
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: '8px', border: `1px solid ${theme.border}`,
                background: theme.surface, color: theme.textPrimary, fontSize: '13px',
              }}
            >
              {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </label>
          <span style={{ fontSize: '12px', color: theme.textMuted }}>
            {t('common.currency')} <strong style={{ color: theme.textPrimary }}>{currency}</strong>
          </span>
        </div>

        <div style={{ borderRadius: '16px', border: `1px solid ${theme.borderSoft}`, background: theme.surfaceAlt, padding: '14px', display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: theme.surface }}>
              <div style={{ color: theme.accent, fontSize: '11px' }}>{t('drawer.wallet')}</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{fmt.money(walletBalance)}</div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: theme.surface }}>
              <div style={{ color: theme.accent, fontSize: '11px' }}>{t('drawer.gameBalance')}</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{fmt.money(balance)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ color: theme.textMuted, fontSize: '11px', marginRight: '2px' }}>{t('drawer.walletToBalance')}</span>
            <button onClick={() => depositToBankroll(10)}  style={walletBtn(theme.info, theme.textOnAccent)}>+{fmt.moneyShort(10)}</button>
            <button onClick={() => depositToBankroll(50)}  style={walletBtn(theme.info, theme.textOnAccent)}>+{fmt.moneyShort(50)}</button>
            <button onClick={() => withdrawFromBankroll(10)} style={walletBtn(theme.dangerSoft, theme.danger)}>-{fmt.moneyShort(10)}</button>
            <button onClick={() => withdrawFromBankroll(50)} style={walletBtn(theme.dangerSoft, theme.danger)}>-{fmt.moneyShort(50)}</button>
          </div>
        </div>

        <ProvablyFair provablyFair={provablyFair} onSetClientSeed={onSetClientSeed} status={status} />

        <div>
          <div style={{ color: theme.accent, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            {t('drawer.history')}
          </div>
          {history.length === 0 ? (
            <p style={{ color: theme.textMuted, fontSize: '12px' }}>{t('drawer.noHistory')}</p>
          ) : (
            // contain:'paint' isolates this list's own compositing/paint from the rest of
            // the drawer — without it, once the list is full (10 entries, capped in
            // chickenStore.addHistory) Chrome intermittently fails to repaint the
            // ProvablyFair block above it (present and correct in the DOM/inspector, just
            // not painted) until a full reload. Confirmed by toggling this list's
            // display:none in devtools, which made ProvablyFair reappear immediately.
            <div style={{ display: 'grid', gap: '6px', contain: 'paint' }}>
              {history.map((entry, index) => {
                const isBust = entry.result === 'busted';
                return (
                  <div key={index} style={{ padding: '8px 10px', borderRadius: '10px', background: theme.surfaceAlt }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: theme.textMuted, flexShrink: 0 }}>#{entry.round}</span>
                      <span style={{
                        padding: '1px 7px', borderRadius: '999px',
                        background: isBust ? theme.dangerSoft : theme.successSoft,
                        color:      isBust ? theme.danger : theme.success,
                        fontSize: '11px', fontWeight: 700,
                      }}>
                        {difficulties[entry.difficulty] ? t(`difficulty.${entry.difficulty}`) : entry.difficulty}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: isBust ? theme.danger : theme.success }}>
                        {isBust ? t('drawer.busted') : t('drawer.cashedOut')}
                      </span>
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '11px', color: theme.textMuted }}>
                      {isBust
                        ? t('drawer.entryLost', { bet: entry.bet, step: entry.step, amount: Math.abs(entry.profit) })
                        : t('drawer.entryWon', { bet: entry.bet, step: entry.step, multiplier: entry.multiplier ?? 0, amount: entry.payout ?? 0 })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={onOpenInfo}
          style={{
            padding: '10px 12px', borderRadius: '10px', border: `1px solid ${theme.borderSoft}`,
            background: theme.surfaceAlt, color: theme.textPrimary, cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, textAlign: 'left',
          }}
        >
          ⓘ {t('drawer.infoLink')}
        </button>
      </div>
    </div>
  );
}

function walletBtn(bg, color) {
  return {
    padding: '5px 9px', borderRadius: '8px', border: 'none',
    background: bg, color, cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  };
}
