'use client';

import { useEffect, useRef, useState } from 'react';
import { APPS } from '../lib/apps';
import { THEMES } from '../lib/themes';
import { Icon } from '../components/icons';
import Window from '../components/Window';
import RugVision from '../components/RugVision';
import WalletRoast from '../components/WalletRoast';
import { ComingSoon, Guide, Settings } from '../components/SmallApps';

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

export default function Desktop() {
  const [wins, setWins] = useState({});
  const [code, setCode] = useState('');
  const [theme, setThemeState] = useState('windows');
  const [startOpen, setStartOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
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
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  function openApp(id) {
    setStartOpen(false);
    setQuery('');
    setWins((prev) => {
      const next = ++z.current;
      const cur = prev[id];
      if (cur) return { ...prev, [id]: { ...cur, min: false, z: next } };
      const n = Object.keys(prev).length;
      return { ...prev, [id]: { min: false, max: false, x: 150 + n * 30, y: 24 + n * 30, z: next } };
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

  function taskClick(id) {
    if (wins[id] && !wins[id].min && activeId === id) patch(id, { min: true });
    else openApp(id);
  }

  // Desktop icons: double-click to open; a single tap opens on touch screens.
  function iconClick(id) {
    let coarse = false;
    try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch {}
    if (coarse) openApp(id);
    else { setSelected(id); setStartOpen(false); }
  }

  function restart() {
    try { sessionStorage.removeItem('trenchos-booted'); } catch {}
    window.location.reload();
  }

  function body(app) {
    if (app.id === 'rug') return <RugVision code={code} />;
    if (app.id === 'roast') return <WalletRoast code={code} />;
    if (app.id === 'guide') return <Guide onOpen={openApp} />;
    if (app.id === 'settings') return <Settings code={code} setCode={setCode} theme={theme} setTheme={setTheme} />;
    return <ComingSoon app={app} />;
  }

  const q = query.trim().toLowerCase();
  const results = APPS.filter((a) => !q || `${a.name} ${a.desc ?? ''}`.toLowerCase().includes(q));

  const time = now ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const date = now ? now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="os" data-theme={theme}>
      {!booted && (
        <div className="boot" role="status" aria-live="polite">
          <div className="boot-logo"><Icon name="logo" size={64} /></div>
          <div className="boot-name">TrencherOS</div>
          <div className="boot-bar"><span /></div>
        </div>
      )}

      <main
        className="desktop"
        onPointerDown={(e) => { if (e.target === e.currentTarget) { setSelected(null); setStartOpen(false); } }}
      >
        <div className="icons" onPointerDown={(e) => { if (e.target === e.currentTarget) { setSelected(null); setStartOpen(false); } }}>
          {APPS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={selected === a.id ? 'dicon selected' : 'dicon'}
              onClick={() => iconClick(a.id)}
              onDoubleClick={() => openApp(a.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); openApp(a.id); } }}
              aria-label={a.soon ? `${a.name} (coming soon)` : a.name}
            >
              <span className="dicon-tile"><Icon name={a.icon} size={30} /></span>
              <span className="dicon-label">{a.name}</span>
            </button>
          ))}
        </div>

        {APPS.filter((a) => wins[a.id]).map((a) => (
          <Window
            key={a.id}
            app={a}
            state={wins[a.id]}
            active={activeId === a.id}
            onFocus={() => { focus(a.id); setStartOpen(false); }}
            onMove={(x, y) => patch(a.id, { x, y })}
            onMin={() => patch(a.id, { min: true })}
            onMax={() => patch(a.id, { max: !wins[a.id].max })}
            onClose={() => close(a.id)}
          >
            {body(a)}
          </Window>
        ))}
      </main>

      {startOpen && (
        <div className="start" role="dialog" aria-label="Start menu" onKeyDown={(e) => { if (e.key === 'Escape') setStartOpen(false); }}>
          <div className="start-search">
            <Icon name="search" size={16} />
            <input
              autoFocus
              type="search"
              placeholder="Search apps"
              aria-label="Search apps"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) openApp(results[0].id); }}
            />
          </div>
          <div className="start-label">Apps</div>
          <div className="start-grid">
            {results.map((a) => (
              <button key={a.id} type="button" className="start-tile" onClick={() => openApp(a.id)}>
                <span className="start-icon"><Icon name={a.icon} size={22} /></span>
                <span className="start-name">{a.name}{a.soon && <span className="note"> · soon</span>}</span>
              </button>
            ))}
            {results.length === 0 && <div className="note">No apps match.</div>}
          </div>
          <div className="start-foot">
            <span className="start-user">TrencherOS</span>
            <span className="start-actions">
              <button type="button" className="icon-btn" aria-label="Settings" title="Settings" onClick={() => openApp('settings')}><Icon name="gear" size={18} /></button>
              <button type="button" className="icon-btn" aria-label="Restart" title="Restart" onClick={restart}><Icon name="power" size={18} /></button>
            </span>
          </div>
        </div>
      )}

      <footer className="taskbar">
        <button type="button" className={startOpen ? 'start-btn open' : 'start-btn'} onClick={() => { setStartOpen((v) => !v); setQuery(''); }} aria-expanded={startOpen} aria-label="Start">
          <Icon name="logo" size={22} />
        </button>
        <div className="tasks">
          {APPS.filter((a) => wins[a.id]).map((a) => (
            <button
              key={a.id}
              type="button"
              className={['task-btn', activeId === a.id ? 'active' : '', wins[a.id].min ? 'minimized' : ''].join(' ').trim()}
              onClick={() => taskClick(a.id)}
              title={a.name}
            >
              <Icon name={a.icon} size={18} />
              <span className="task-label">{a.name}</span>
            </button>
          ))}
        </div>
        <div className="tray">
          <button type="button" className="tray-btn" onClick={() => openApp('settings')}>{code ? 'Access code set' : 'No access code'}</button>
          <span className="chip">Test build</span>
          <span className="clock"><span>{time}</span><span>{date}</span></span>
        </div>
      </footer>
    </div>
  );
}
