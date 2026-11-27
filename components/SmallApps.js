'use client';

import { APPS } from '../lib/apps';
import { THEMES } from '../lib/themes';
import { Icon } from './icons';

export function ComingSoon({ app }) {
  return (
    <div className="panel">
      <div className="chip" style={{ display: 'inline-block', marginBottom: 12 }}>COMING SOON</div>
      <h2 style={{ margin: '0 0 8px' }}>{app.name}</h2>
      <p style={{ margin: 0 }}>{app.desc}</p>
      <p className="note" style={{ marginBottom: 0 }}>Not built yet. Nothing in this window is live data.</p>
    </div>
  );
}

export function Guide({ onOpen }) {
  return (
    <>
      <p className="lead">Everything in TrencherOS opens from the dock on the left. Here is what each app does.</p>
      {APPS.filter((a) => !a.system).map((a) => (
        <div className="guide-row" key={a.id}>
          <div className="guide-icon"><Icon name={a.icon} size={26} /></div>
          <div className="guide-text">
            <div className="guide-name">{a.name} {a.soon && <span className="note">(coming soon)</span>}</div>
            <div className="note">{a.desc}</div>
          </div>
          <button type="button" className="btn ghost small" onClick={() => onOpen(a.id)}>OPEN</button>
        </div>
      ))}
      <div className="panel" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700 }}>How to read the results</div>
        <div className="note">
          PASS, REVIEW and FLAG are shown with words as well as colors. Every flag lists its evidence and how confident the check is. No scan can guarantee safety, and nothing here predicts prices.
        </div>
      </div>
    </>
  );
}

export function Settings({ code, setCode, theme, setTheme }) {
  return (
    <>
      <div className="panel">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Theme</div>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={theme === t.id ? 'theme-btn selected' : 'theme-btn'}
              aria-pressed={theme === t.id}
              onClick={() => setTheme(t.id)}
            >
              <span className="swatch" aria-hidden="true">
                <span style={{ background: t.swatch[0] }} />
                <span style={{ background: t.swatch[1] }} />
              </span>
              <span className="theme-name">{t.name}</span>
              <span className="note">{t.note}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <label htmlFor="code">Access code (if the server requires one)</label>
        <input id="code" type="password" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: '100%' }} />
        <p className="note" style={{ marginBottom: 0 }}>Kept in this tab only and sent with each request. API keys never reach the browser.</p>
      </div>
      <div className="panel">
        <div style={{ fontWeight: 700 }}>TrencherOS</div>
        <div className="note">Test build. Code does the math and the checks; AI only explains computed results. Nothing here predicts prices or gives trading advice.</div>
      </div>
    </>
  );
}
