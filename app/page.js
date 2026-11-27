'use client';

import { useEffect, useRef, useState } from 'react';
import { APPS } from '../lib/apps';
import { Icon } from '../components/icons';
import Window from '../components/Window';
import RugVision from '../components/RugVision';
import WalletRoast from '../components/WalletRoast';
import { ComingSoon, Settings } from '../components/SmallApps';

const BOOT_LINES = [
  'TRENCHEROS 0.2 test build',
  'mounting data layer ........ ok',
  'loading risk checks ........ ok',
  'starting evidence store .... ok',
  'welcome.',
];

export default function Desktop() {
  const [wins, setWins] = useState({});
  const [code, setCode] = useState('');
  const [launcher, setLauncher] = useState(false);
  const [now, setNow] = useState(null);
  const [booted, setBooted] = useState(false);
  const z = useRef(10);
  const opened = useRef(false);

  // Clock (client only, so server and browser markup match).
  useEffect(() => {
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
      return { ...prev, [id]: { min: false, max: false, x: 96 + n * 32, y: 56 + n * 32, z: next } };
    });
  }

  // Open RugVision once after boot so the desktop is not empty.
  useEffect(() => {
    if (booted && !opened.current) {
      opened.current = true;
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
    if (app.id === 'settings') return <Settings code={code} setCode={setCode} />;
    return <ComingSoon app={app} />;
  }

  const time = now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const date = now ? now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';

  return (
    <div className="os">
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
        {APPS.filter((a) => !a.system).map((a) => (
          <button
            key={a.id}
            type="button"
            className={wins[a.id] ? 'dock-item running' : 'dock-item'}
            onClick={() => dockClick(a.id)}
            aria-label={a.soon ? `${a.name} (coming soon)` : a.name}
            title={a.soon ? `${a.name} (soon)` : a.name}
          >
            <Icon name={a.icon} size={24} />
          </button>
        ))}
        <span className="dock-spacer" />
        <button type="button" className={wins.settings ? 'dock-item running' : 'dock-item'} onClick={() => dockClick('settings')} aria-label="Settings" title="Settings">
          <Icon name="gear" size={24} />
        </button>
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
