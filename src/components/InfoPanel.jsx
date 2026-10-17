import { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';
import { LEGAL } from '../legalInfo';
import { DIFFICULTIES, DIFFICULTY_KEYS, RTP, EDGE_FADE_STEPS, effectiveRTP, computeStepMultiplier } from '../shared/gameConfig';
import { WOOD, frame, woodText } from './woodSkin';
import { useI18n } from '../i18n/react/useI18n';
import RichText from '../i18n/react/RichText';

// Mandatory player information (rules, RTP, fairness, responsible gaming, legal notice,
// privacy), opened from the discreet "i" button over the scene and from the Drawer.
// Texts live in src/i18n/locales/*.js (info.*); every game figure (odds, multipliers,
// RTP, bet limits) is computed from src/shared/gameConfig.js at render time, never
// retyped, so the published rules can't drift from what the server actually applies.

const LAST_LANE = Math.max(...Object.values(DIFFICULTIES).map(d => d.lanes));
const SAMPLE_STEPS = [1, 2, 5, 10, 20];
const SECTION_KEYS = ['rules', 'rtp', 'fair', 'responsible', 'legal', 'privacy'];

const h3 = { fontFamily: theme.fontWood, fontWeight: 800, fontSize: '18px', color: theme.accentDeep, margin: '18px 0 6px' };
const list = { paddingLeft: '20px', margin: '4px 0' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '13px', margin: '6px 0 4px' };
const th = { textAlign: 'left', padding: '6px 8px', background: theme.surfaceAlt, borderBottom: `1px solid ${theme.borderSoft}`, fontWeight: 700 };
const td = { padding: '6px 8px', borderBottom: `1px solid ${theme.borderSoft}`, fontVariantNumeric: 'tabular-nums' };

function Todo({ what }) {
  const { t } = useI18n();
  return (
    <span style={{
      background: theme.warningSoft, border: `1px dashed ${theme.warning}`, borderRadius: '4px',
      padding: '0 4px', fontStyle: 'italic', color: theme.textMuted,
    }}>
      {t('info.todo', { what })}
    </span>
  );
}

function Table({ head, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={table}>
        <thead><tr>{head.map((cell, i) => <th key={i} style={th}>{cell}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} style={td}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function Rules({ minBet, maxBet }) {
  const { t, fmt, locale } = useI18n();
  const k = (key, params) => t(`info.rules.${key}`, params);
  const version = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(`${LEGAL.rulesVersion}T12:00:00`));
  return (
    <>
      <h3 style={h3}>{k('howTitle')}</h3>
      <p>{k('howBody')}</p>

      <h3 style={h3}>{k('roundTitle')}</h3>
      <ol style={list}>
        <li>{k('step1', { min: minBet, max: maxBet })}</li>
        {['step2', 'step3', 'step4', 'step5'].map(key => <li key={key}><RichText text={k(key)} /></li>)}
      </ol>
      <p>{k('roadEnd', { lanes: LAST_LANE })}</p>

      <h3 style={h3}>{k('difficultiesTitle')}</h3>
      <p>{k('difficultiesIntro')}</p>
      <Table
        head={[k('colDifficulty'), k('colStar'), k('colCleared')]}
        rows={DIFFICULTY_KEYS.map(key => [
          t(`difficulty.${key}`),
          fmt.percentWhole(DIFFICULTIES[key].deathChance),
          fmt.percentWhole(1 - DIFFICULTIES[key].deathChance),
        ])}
      />

      <h3 style={h3}>{k('multipliersTitle')}</h3>
      <p>{k('multipliersIntro')}</p>
      <Table
        head={[k('colStep'), ...DIFFICULTY_KEYS.map(key => t(`difficulty.${key}`))]}
        rows={SAMPLE_STEPS.map(step => [
          step,
          ...DIFFICULTY_KEYS.map(key => fmt.multiplier(computeStepMultiplier(DIFFICULTIES[key].deathChance, step))),
        ])}
      />
      <p>{k('noCap')}</p>

      <h3 style={h3}>{k('disconnectTitle')}</h3>
      <ul style={list}>
        {['disconnect1', 'disconnect2', 'disconnect3'].map(key => <li key={key}><RichText text={k(key)} /></li>)}
      </ul>
      <p style={{ color: theme.textMuted, fontSize: '12px' }}>{k('version', { date: version })}</p>
    </>
  );
}

function Rtp() {
  const { t, fmt } = useI18n();
  const k = (key, params) => t(`info.rtp.${key}`, params);
  const params = { rtp: RTP, fade: EDGE_FADE_STEPS, lastReduced: EDGE_FADE_STEPS - 1 };
  return (
    <>
      <h3 style={h3}>{k('title')}</h3>
      <p><RichText text={k('intro', params)} /></p>
      <p>{k('scope', params)}</p>
      <Table
        head={[k('colDifficulty'), k('colBase', params), k('colLowest')]}
        rows={DIFFICULTY_KEYS.map(key => [
          t(`difficulty.${key}`),
          fmt.percent(RTP),
          fmt.percent(effectiveRTP(DIFFICULTIES[key].deathChance, 2)),
        ])}
      />
    </>
  );
}

function Fair() {
  const { t } = useI18n();
  const k = key => t(`info.fair.${key}`);
  return (
    <>
      <h3 style={h3}>{k('title')}</h3>
      <p>{k('intro')}</p>
      <ul style={list}>
        {['item1', 'item2', 'item3'].map(key => <li key={key}><RichText text={k(key)} /></li>)}
      </ul>
      <p>{k('calc')}</p>
      <p>{k('reveal')}</p>
    </>
  );
}

function Responsible() {
  const { t } = useI18n();
  const k = key => t(`info.responsible.${key}`);
  return (
    <>
      <h3 style={h3}>{k('adultsTitle')}</h3>
      <p>{k('adultsBody')}</p>

      <h3 style={h3}>{k('playTitle')}</h3>
      <ul style={list}>
        {['tip1', 'tip2', 'tip3', 'tip4', 'tip5'].map(key => <li key={key}>{k(key)}</li>)}
      </ul>
      <p>{k('operatorTools')}</p>
    </>
  );
}

function Legal() {
  const { t } = useI18n();
  const k = (key, params) => t(`info.legal.${key}`, params);
  const { publisher: p, host: h } = LEGAL;
  return (
    <>
      <h3 style={h3}>{k('publisherTitle')}</h3>
      <p style={{ margin: '4px 0' }}>{p.name}</p>

      <h3 style={h3}>{k('hostingTitle')}</h3>
      <p style={{ margin: '4px 0' }}>
        {h.name ?? <Todo what={k('hostName')} />}<br />
        {h.address ?? <Todo what={k('hostAddress')} />}<br />
        {h.phone ?? <Todo what={k('hostPhone')} />}
      </p>

      <h3 style={h3}>{k('natureTitle')}</h3>
      <p><RichText text={k('natureBody')} /></p>

      <h3 style={h3}>{k('ipTitle')}</h3>
      <p>{k('ipBody', { publisher: p.name })}</p>
    </>
  );
}

function Privacy() {
  const { t } = useI18n();
  const k = key => t(`info.privacy.${key}`);
  const { publisher: p } = LEGAL;
  return (
    <>
      <h3 style={h3}>{k('dataTitle')}</h3>
      <p>{k('dataIntro')}</p>
      <ul style={list}>
        {['idBody', 'gameDataBody', 'logsBody', 'preferencesBody'].map(key => <li key={key}><RichText text={k(key)} /></li>)}
      </ul>

      <h3 style={h3}>{k('cookiesTitle')}</h3>
      <p>{k('cookiesBody')}</p>

      <h3 style={h3}>{k('rightsTitle')}</h3>
      <p>
        {k('rightsBody')}{' '}
        <a href={`mailto:${p.email}`} style={{ color: theme.accent }}>{p.email}</a>
      </p>
      <p>{k('operatorPolicy')}</p>
    </>
  );
}

const SECTION_COMPONENTS = { rules: Rules, rtp: Rtp, fair: Fair, responsible: Responsible, legal: Legal, privacy: Privacy };

export default function InfoPanel({ open, onClose, minBet, maxBet }) {
  const { t } = useI18n();
  const [section, setSection] = useState('rules');
  const closeRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0); }, [section]);

  if (!open) return null;
  const Section = SECTION_COMPONENTS[section];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: theme.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(4vw, 24px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-panel-title"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '760px', height: '100%', maxHeight: '860px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: theme.surface, color: theme.textPrimary, borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(20,8,2,0.45)', fontFamily: theme.fontBody,
        }}
      >
        <div style={{
          flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          padding: '10px 12px', background: theme.woodDark,
        }}>
          <h2 id="info-panel-title" style={{ ...woodText, margin: 0, fontSize: '20px' }}>{t('info.title')}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              ...frame(WOOD.miseBtn, 8, '3px'), ...woodText,
              width: '34px', height: '38px', padding: 0, fontSize: '16px', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div role="tablist" aria-label={t('info.sections')} style={{
          flex: '0 0 auto', display: 'flex', gap: '6px', overflowX: 'auto',
          padding: '8px 12px', borderBottom: `1px solid ${theme.borderSoft}`, background: theme.surfaceAlt,
        }}>
          {SECTION_KEYS.map(key => {
            const active = key === section;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                aria-controls="info-panel-body"
                onClick={() => setSection(key)}
                style={{
                  flexShrink: 0, padding: '6px 11px', borderRadius: '999px', cursor: 'pointer',
                  border: `1px solid ${active ? theme.accent : theme.borderSoft}`,
                  background: active ? theme.accent : theme.surface,
                  color: active ? theme.textOnAccent : theme.textPrimary,
                  fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
                }}
              >
                {t(`info.tabs.${key}`)}
              </button>
            );
          })}
        </div>

        <div
          id="info-panel-body"
          role="tabpanel"
          ref={bodyRef}
          style={{ flex: '1 1 auto', overflowY: 'auto', padding: '4px 16px 20px', fontSize: '14px', lineHeight: 1.55 }}
        >
          <Section minBet={minBet} maxBet={maxBet} />
        </div>
      </div>
    </div>
  );
}
