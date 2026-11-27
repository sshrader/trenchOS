'use client';

import { useEffect, useRef, useState } from 'react';
import { APPS } from '../lib/apps';
import { THEMES } from '../lib/themes';
import { Icon } from '../components/icons';
import Window from '../components/Window';
import RugVision from '../components/RugVision';
import WalletRoast from '../components/WalletRoast';
import { ComingSoon, Guide, Settings } from '../components/SmallApps';

const BOOT_LINES = [
  'TRENCHEROS 0.3 test build',
  'mounting data layer ........ ok',
  'loading risk checks ........ ok',
  'starting evidence store .... ok',
  'welcome.',
];

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

export default function Desktop() {
  const [wins, setWins] = useState({});
  const [code, setCode] = useState('');
  const [theme, setThemeState] = useState('matrix');
  const [launcher, setLauncher] = useState(false);
  const [now, setNow] = useState(null);
  const [booted, setBooted] = useState(false);
  const z = useRef(10);
  const opened = useRef(false);

  const setTheme = (id) => {
    setThemeState(id);
    write('trenchos-theme', id);
  };

  // Saved theme, and a clock (client only, so server and browser markup match).
  useEffect(() => {
    const saved = read('trenchos-theme');
    if (saved && THEMES.some((t) => t.id === saved)) setThemeState(saved);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // Short boot screen, shown once per tab.
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('trenchos-booted') === '1'; } catch {}
    if (seen) { setBooted(true); return; }
    const t = setTimeout(() => {
      setBooted(true);
      try { sessionStorage.setItem('trenchos-booted', '1'); } catch {}
    }, 1600);
    return () => clearTimeout(t);
  }, []);

  function openApp(id) {
    setLauncher(false);
    setWins((prev) => {
      const next = ++z.current;
      const cur = prev[id];
      if (cur) return { ...prev, [id]: { ...cur, min: false, z: next } };
      const n = Object.keys(prev).length;
      return { ...prev, [id]: { min: false, max: false, x: 112 + n * 32, y: 56 + n * 32, z: next } };
    });
  }

  // After boot: open RugVision, and the Guide the first time this browser visits.
  useEffect(() => {
    if (booted && !opened.current) {
      opened.current = true;
      if (!read('trenchos-welcomed')) {
        write('trenchos-welcomed', '1');
        openApp('guide');
      }
      openApp('rug');
    }
  }, [booted]);

  const patch = (id, p) => setWins((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...p } } : prev));
  const focus = (id) => patch(id, { z: ++z.current });
  const close = (id) => setWins((prev) => { const n = { ...prev }; delete n[id]; return n; });

  const visible = Object.entries(wins).filter(([, w]) => !w.min);
  const activeId = visible.length ? visible.reduce((a, b) => (b[1].z > a[1].z ? b : a))[0] : null;

  function dockClick(id) {
    if (wins[id] && !wins[id].min && activeId === id) patch(id, { min: true });
    else openApp(id);
  }

  function body(app) {
    if (app.id === 'rug') return <RugVision code={code} />;
    if (app.id === 'roast') return <WalletRoast code={code} />;
    if (app.id === 'guide') return <Guide onOpen={openApp} />;
    if (app.id === 'settings') return <Settings code={code} setCode={setCode} theme={theme} setTheme={setTheme} />;
    return <ComingSoon app={app} />;
  }

  function dockButton(app) {
    return (
      <button
        key={app.id}
        type="button"
        className={wins[app.id] ? 'dock-item running' : 'dock-item'}
        onClick={() => dockClick(app.id)}
        aria-label={app.soon ? `${app.name} (coming soon)` : app.name}
        title={app.soon ? `${app.name} (coming soon)` : app.name}
      >
        <Icon name={app.icon} size={24} />
        <span className="dock-label">{app.short}</span>
      </button>
    );
  }

  const time = now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const date = now ? now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';

  return (
    <div className="os" data-theme={theme}>
      {!booted && (
        <div className="boot" role="status" aria-live="polite">
          {BOOT_LINES.map((l) => <div key={l}>&gt; {l}</div>)}
        </div>
      )}

      <header className="panelbar">
        <button type="button" className="menu-btn" onClick={() => setLauncher((v) => !v)} aria-expanded={launcher}>
          <Icon name="grid" size={16} /> TRENCHEROS
        </button>
        <div className="clock">{date} {time}</div>
        <div className="tray">
          <span className="chip">TEST BUILD</span>
          <button type="button" className="tray-btn" onClick={() => openApp('settings')}>
            {code ? 'ACCESS SET' : 'NO ACCESS CODE'}
          </button>
        </div>
      </header>

      <nav className="dock" aria-label="Applications">
        {APPS.filter((a) => !a.system).map(dockButton)}
        <span className="dock-spacer" />
        {APPS.filter((a) => a.system).map(dockButton)}
      </nav>

      <main className="desktop">
        {!visible.length && booted && <div className="hint">Pick an app from the dock.</div>}
        {APPS.filter((a) => wins[a.id]).map((a) => (
          <Window
            key={a.id}
            app={a}
            state={wins[a.id]}
            active={activeId === a.id}
            onFocus={() => focus(a.id)}
            onMove={(x, y) => patch(a.id, { x, y })}
            onMin={() => patch(a.id, { min: true })}
            onMax={() => patch(a.id, { max: !wins[a.id].max })}
            onClose={() => close(a.id)}
          >
            {body(a)}
          </Window>
        ))}
      </main>

      {launcher && (
        <div className="launcher" onClick={() => setLauncher(false)}>
          <div className="launcher-grid" onClick={(e) => e.stopPropagation()} role="menu" aria-label="All applications">
            {APPS.map((a) => (
              <button key={a.id} type="button" className="launch-item" onClick={() => openApp(a.id)} role="menuitem">
                <Icon name={a.icon} size={32} />
                <span>{a.name}</span>
                {a.soon && <span className="note">SOON</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
