import { useState } from 'react';
import {
  DIFFICULTIES, DIFFICULTY_KEYS,
  hmacMessage, hexToUnitInterval, outcomeFromUnitInterval, computeStepMultiplier,
} from '../shared/gameConfig';

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
      background: copied ? 'rgba(39,195,131,0.2)' : '#1e2a3a',
      color: copied ? '#27c383' : '#7a8fa8', fontSize: '11px', cursor: 'pointer',
    }}>
      {copied ? '✓' : 'copier'}
    </button>
  );
}

function HashRow({ label, value }) {
  if (!value) return null;
  const short = value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-10)}` : value;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{ color: '#4a6a8a', fontSize: '12px', minWidth: '110px' }}>{label}</span>
      <code style={{ color: '#b0c4d8', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {short}
      </code>
      <CopyButton text={value} />
    </div>
  );
}

export default function ProvablyFair({ provablyFair, onSetClientSeed, status }) {
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
      marginTop: '14px', borderRadius: '16px', border: '1px solid rgba(138,184,255,0.08)',
      background: '#080f1d', overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#8ab8ff',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          🔒 Provably Fair
        </span>
        <span style={{ fontSize: '11px', color: '#4a6a8a' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', display: 'grid', gap: '12px' }}>

          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ color: '#4a6a8a', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tour #{nonce || '—'}
            </div>
            <HashRow label="Server hash" value={serverSeedHash} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#4a6a8a', fontSize: '12px', minWidth: '110px' }}>Client seed</span>
              {editMode ? (
                <>
                  <input
                    value={editSeed}
                    onChange={e => setEditSeed(e.target.value)}
                    placeholder={clientSeed}
                    style={{
                      padding: '4px 8px', borderRadius: '7px', border: '1px solid #27303f',
                      background: '#0a1220', color: 'white', fontSize: '12px', fontFamily: 'monospace',
                      width: '160px',
                    }}
                  />
                  <button onClick={handleSetSeed} style={{
                    padding: '4px 10px', borderRadius: '7px', border: 'none',
                    background: 'rgba(39,195,131,0.2)', color: '#27c383', fontSize: '11px', cursor: 'pointer',
                  }}>
                    OK
                  </button>
                  <button onClick={() => setEditMode(false)} style={{
                    padding: '4px 8px', borderRadius: '7px', border: 'none',
                    background: '#1e2a3a', color: '#7a8fa8', fontSize: '11px', cursor: 'pointer',
                  }}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <code style={{ color: '#b0c4d8', fontSize: '12px', fontFamily: 'monospace' }}>
                    {clientSeed}
                  </code>
                  {canEditSeed && (
                    <button onClick={() => { setEditSeed(''); setEditMode(true); }} style={{
                      padding: '3px 8px', borderRadius: '6px', border: 'none',
                      background: '#1e2a3a', color: '#8ab8ff', fontSize: '11px', cursor: 'pointer',
                    }}>
                      modifier
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {serverSeed && (
            <div style={{
              padding: '10px 12px', borderRadius: '10px',
              background: 'rgba(39,195,131,0.06)', border: '1px solid rgba(39,195,131,0.15)',
              display: 'grid', gap: '6px',
            }}>
              <div style={{ color: '#27c383', fontSize: '11px', fontWeight: 700 }}>✓ Server seed révélé</div>
              <HashRow label="Server seed" value={serverSeed} />
              <button
                onClick={prefillVerifier}
                style={{
                  alignSelf: 'start', marginTop: '4px', padding: '4px 10px', borderRadius: '7px',
                  border: 'none', background: 'rgba(39,195,131,0.15)', color: '#27c383',
                  fontSize: '11px', cursor: 'pointer',
                }}
              >
                Pré-remplir le vérificateur →
              </button>
            </div>
          )}

          <div style={{ height: '1px', background: '#1e2a3a' }} />

          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ color: '#4a6a8a', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Vérifier une case
            </div>

            {[
              { label: 'Server seed', val: vServerSeed, set: setVServerSeed, ph: '64 hex chars…' },
              { label: 'Client seed', val: vClientSeed, set: setVClientSeed, ph: 'default' },
              { label: 'Nonce (tour)', val: vNonce,      set: setVNonce,      ph: '3' },
              { label: 'Case (step)',  val: vStep,        set: setVStep,        ph: '1' },
            ].map(({ label, val, set, ph }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#4a6a8a', fontSize: '12px', minWidth: '110px' }}>{label}</span>
                <input
                  value={val}
                  onChange={e => { set(e.target.value); setVResult(null); }}
                  placeholder={ph}
                  style={{
                    flex: 1, padding: '5px 8px', borderRadius: '7px', border: '1px solid #27303f',
                    background: '#0a1220', color: 'white', fontSize: '12px', fontFamily: 'monospace',
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#4a6a8a', fontSize: '12px', minWidth: '110px' }}>Difficulté</span>
              <select
                value={vDifficulty}
                onChange={e => { setVDifficulty(e.target.value); setVResult(null); }}
                style={{
                  flex: 1, padding: '5px 8px', borderRadius: '7px', border: '1px solid #27303f',
                  background: '#0a1220', color: 'white', fontSize: '12px',
                }}
              >
                {DIFFICULTY_KEYS.map(k => (
                  <option key={k} value={k}>{DIFFICULTIES[k].label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleVerify}
              disabled={vLoading || !vServerSeed || !vClientSeed || !vNonce || !vStep}
              style={{
                padding: '8px 16px', borderRadius: '10px', border: 'none',
                background: (vLoading || !vServerSeed || !vClientSeed || !vNonce || !vStep) ? '#1e2a3a' : '#1e3a7a',
                color: (vLoading || !vServerSeed || !vClientSeed || !vNonce || !vStep) ? '#4a6a8a' : '#8ab8ff',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              }}
            >
              {vLoading ? 'Calcul…' : "Calculer l'issue de la case"}
            </button>

            {vResult && (
              <div style={{
                padding: '10px 12px', borderRadius: '10px',
                background: vResult.ok ? (vResult.outcome === 'safe' ? 'rgba(39,195,131,0.06)' : 'rgba(255,90,90,0.06)') : 'rgba(255,90,90,0.06)',
                border: `1px solid ${vResult.ok ? (vResult.outcome === 'safe' ? 'rgba(39,195,131,0.2)' : 'rgba(255,90,90,0.2)') : 'rgba(255,90,90,0.2)'}`,
              }}>
                {vResult.ok ? (
                  vResult.outcome === 'safe' ? (
                    <span style={{ color: '#27c383', fontWeight: 700 }}>
                      Case sûre — multiplicateur {vResult.multiplier.toFixed(2)}x
                    </span>
                  ) : (
                    <span style={{ color: '#ff5a5a', fontWeight: 700 }}>🥷 Étoile ninja — case fatale</span>
                  )
                ) : (
                  <span style={{ color: '#ff5a5a' }}>Erreur de calcul — vérifiez les valeurs.</span>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
