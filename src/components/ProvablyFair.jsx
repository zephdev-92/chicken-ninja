import { useState } from 'react';
import {
  DIFFICULTIES, DIFFICULTY_KEYS,
  hmacMessage, hexToUnitInterval, outcomeFromUnitInterval, computeStepMultiplier,
} from '../shared/gameConfig';
import { theme } from '../theme';
import { useI18n } from '../i18n/react/useI18n';

// Web Crypto — même algorithme que le serveur (Node `crypto`), calculé côté client.
async function computeStepOutcome(serverSeed, clientSeed, nonce, step, deathChance) {
  const enc     = new TextEncoder();
  const keyData = enc.encode(serverSeed);
  const msgData = enc.encode(hmacMessage(clientSeed, nonce, step));
  const key = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const r       = hexToUnitInterval(hex);
  const outcome = outcomeFromUnitInterval(r, deathChance);
  return { outcome, r };
}

function CopyButton({ text }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} style={{
      padding: '3px 8px', borderRadius: '6px', border: 'none',
      background: copied ? theme.successSoft : theme.surfaceAlt,
      color: copied ? theme.success : theme.textMuted, fontSize: '11px', cursor: 'pointer',
    }}>
      {copied ? '✓' : t('common.copy')}
    </button>
  );
}

function HashRow({ label, value }) {
  if (!value) return null;
  const short = value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-10)}` : value;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{ color: theme.textMuted, fontSize: '12px', minWidth: '110px' }}>{label}</span>
      <code style={{ color: theme.textPrimary, fontSize: '12px', fontFamily: theme.fontMono, wordBreak: 'break-all' }}>
        {short}
      </code>
      <CopyButton text={value} />
    </div>
  );
}

export default function ProvablyFair({ provablyFair, onSetClientSeed, status }) {
  const { t } = useI18n();
  const { serverSeedHash, clientSeed, nonce, serverSeed } = provablyFair;

  const [open,     setOpen]     = useState(false);
  const [editSeed, setEditSeed] = useState('');
  const [editMode, setEditMode] = useState(false);

  // Verifier state
  const [vServerSeed, setVServerSeed] = useState('');
  const [vClientSeed, setVClientSeed] = useState('default');
  const [vNonce,       setVNonce]       = useState('');
  const [vStep,         setVStep]         = useState('1');
  const [vDifficulty,   setVDifficulty]   = useState('easy');
  const [vResult,       setVResult]       = useState(null);
  const [vLoading,      setVLoading]      = useState(false);

  const canEditSeed = status === 'idle' || status === 'busted' || status === 'cashed';

  const handleSetSeed = () => {
    const s = editSeed.trim().replace(/[^\w-]/g, '').slice(0, 64);
    if (s) { onSetClientSeed(s); setEditSeed(''); }
    setEditMode(false);
  };

  const handleVerify = async () => {
    if (!vServerSeed || !vClientSeed || !vNonce || !vStep) return;
    setVLoading(true);
    setVResult(null);
    try {
      const deathChance = DIFFICULTIES[vDifficulty].deathChance;
      const step = parseInt(vStep, 10);
      const { outcome } = await computeStepOutcome(vServerSeed, vClientSeed, parseInt(vNonce, 10), step, deathChance);
      const multiplier = outcome === 'safe' ? computeStepMultiplier(deathChance, step) : null;
      setVResult({ ok: true, outcome, multiplier });
    } catch {
      setVResult({ ok: false });
    } finally {
      setVLoading(false);
    }
  };

  const prefillVerifier = () => {
    if (serverSeed) {
      setVServerSeed(serverSeed);
      setVClientSeed(clientSeed);
      setVNonce(String(nonce));
      setVResult(null);
    }
  };

  return (
    <div style={{
      marginTop: '14px', borderRadius: '16px', border: `1px solid ${theme.borderSoft}`,
      background: theme.surfaceAlt,
      // 'clip', not 'hidden' — the two look identical here (just clipping the rounded
      // corners) but 'hidden' creates an implicit scroll container, which combined with
      // the Historique list below growing to its 10-entry cap made Chrome intermittently
      // fail to repaint this block (present and correct in the DOM/inspector, just not
      // painted) until a full reload. 'clip' doesn't create that scroll container and
      // sidesteps the bug. Confirmed live in devtools before landing this.
      overflow: 'clip',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: theme.accent,
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          🔒 {t('fair.title')}
        </span>
        <span style={{ fontSize: '11px', color: theme.textMuted }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', display: 'grid', gap: '12px' }}>

          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ color: theme.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('fair.round', { nonce: nonce || '—' })}
            </div>
            <HashRow label={t('fair.serverHash')} value={serverSeedHash} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: theme.textMuted, fontSize: '12px', minWidth: '110px' }}>{t('fair.clientSeed')}</span>
              {editMode ? (
                <>
                  <input
                    value={editSeed}
                    onChange={e => setEditSeed(e.target.value)}
                    placeholder={clientSeed}
                    style={{
                      padding: '4px 8px', borderRadius: '7px', border: `1px solid ${theme.border}`,
                      background: theme.surface, color: theme.textPrimary, fontSize: '12px', fontFamily: theme.fontMono,
                      width: '160px',
                    }}
                  />
                  <button onClick={handleSetSeed} style={{
                    padding: '4px 10px', borderRadius: '7px', border: 'none',
                    background: theme.successSoft, color: theme.success, fontSize: '11px', cursor: 'pointer',
                  }}>
                    {t('common.ok')}
                  </button>
                  <button onClick={() => setEditMode(false)} style={{
                    padding: '4px 8px', borderRadius: '7px', border: 'none',
                    background: theme.surface, color: theme.textMuted, fontSize: '11px', cursor: 'pointer',
                  }}>
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <>
                  <code style={{ color: theme.textPrimary, fontSize: '12px', fontFamily: theme.fontMono }}>
                    {clientSeed}
                  </code>
                  {canEditSeed && (
                    <button onClick={() => { setEditSeed(''); setEditMode(true); }} style={{
                      padding: '3px 8px', borderRadius: '6px', border: 'none',
                      background: theme.surface, color: theme.accent, fontSize: '11px', cursor: 'pointer',
                    }}>
                      {t('common.edit')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {serverSeed && (
            <div style={{
              padding: '10px 12px', borderRadius: '10px',
              background: theme.successSoft, border: `1px solid ${theme.success}33`,
              display: 'grid', gap: '6px',
            }}>
              <div style={{ color: theme.success, fontSize: '11px', fontWeight: 700 }}>{t('fair.serverSeedRevealed')}</div>
              <HashRow label={t('fair.serverSeed')} value={serverSeed} />
              <button
                onClick={prefillVerifier}
                style={{
                  alignSelf: 'start', marginTop: '4px', padding: '4px 10px', borderRadius: '7px',
                  border: 'none', background: `${theme.success}26`, color: theme.success,
                  fontSize: '11px', cursor: 'pointer',
                }}
              >
                {t('fair.prefill')}
              </button>
            </div>
          )}

          <div style={{ height: '1px', background: theme.borderSoft }} />

          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ color: theme.textMuted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('fair.verifyTitle')}
            </div>

            {[
              { label: t('fair.serverSeed'), val: vServerSeed, set: setVServerSeed, ph: t('fair.serverSeedPlaceholder') },
              { label: t('fair.clientSeed'), val: vClientSeed, set: setVClientSeed, ph: 'default' },
              { label: t('fair.nonce'),      val: vNonce,      set: setVNonce,      ph: '3' },
              { label: t('fair.step'),       val: vStep,       set: setVStep,       ph: '1' },
            ].map(({ label, val, set, ph }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: theme.textMuted, fontSize: '12px', minWidth: '110px' }}>{label}</span>
                <input
                  value={val}
                  onChange={e => { set(e.target.value); setVResult(null); }}
                  placeholder={ph}
                  style={{
                    flex: 1, padding: '5px 8px', borderRadius: '7px', border: `1px solid ${theme.border}`,
                    background: theme.surface, color: theme.textPrimary, fontSize: '12px', fontFamily: theme.fontMono,
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: theme.textMuted, fontSize: '12px', minWidth: '110px' }}>{t('fair.difficulty')}</span>
              <select
                value={vDifficulty}
                onChange={e => { setVDifficulty(e.target.value); setVResult(null); }}
                style={{
                  flex: 1, padding: '5px 8px', borderRadius: '7px', border: `1px solid ${theme.border}`,
                  background: theme.surface, color: theme.textPrimary, fontSize: '12px',
                }}
              >
                {DIFFICULTY_KEYS.map(k => (
                  <option key={k} value={k}>{t(`difficulty.${k}`)}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleVerify}
              disabled={vLoading || !vServerSeed || !vClientSeed || !vNonce || !vStep}
              style={{
                padding: '8px 16px', borderRadius: '10px', border: 'none',
                background: (vLoading || !vServerSeed || !vClientSeed || !vNonce || !vStep) ? theme.surface : theme.info,
                color: (vLoading || !vServerSeed || !vClientSeed || !vNonce || !vStep) ? theme.textMuted : theme.textOnAccent,
                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              }}
            >
              {vLoading ? t('fair.computing') : t('fair.compute')}
            </button>

            {vResult && (
              <div style={{
                padding: '10px 12px', borderRadius: '10px',
                background: vResult.ok && vResult.outcome === 'safe' ? theme.successSoft : theme.dangerSoft,
                border: `1px solid ${vResult.ok && vResult.outcome === 'safe' ? theme.success : theme.danger}33`,
              }}>
                {vResult.ok ? (
                  vResult.outcome === 'safe' ? (
                    <span style={{ color: theme.success, fontWeight: 700 }}>
                      {t('fair.safe', { multiplier: vResult.multiplier })}
                    </span>
                  ) : (
                    <span style={{ color: theme.danger, fontWeight: 700 }}>{t('fair.fatal')}</span>
                  )
                ) : (
                  <span style={{ color: theme.danger }}>{t('fair.calcError')}</span>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
