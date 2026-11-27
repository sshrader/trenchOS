'use client';

import { useRef } from 'react';
import { Icon } from './icons';

const ctl = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export default function Window({ app, state, active, onFocus, onMove, onMin, onMax, onClose, children }) {
  const drag = useRef(null);

  const style = state.max
    ? { zIndex: state.z }
    : { left: state.x, top: state.y, width: app.w, height: app.h, zIndex: state.z };

  function down(e) {
    if (e.target.closest('button')) return;
    onFocus();
    if (state.max) return;
    drag.current = { px: e.clientX, py: e.clientY, x: state.x, y: state.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e) {
    const d = drag.current;
    if (!d) return;
    const x = Math.max(-app.w + 120, Math.min(window.innerWidth - 120, d.x + e.clientX - d.px));
    const y = Math.max(0, Math.min(window.innerHeight - 100, d.y + e.clientY - d.py));
    onMove(x, y);
  }
  function up() {
    drag.current = null;
  }

  const cls = ['window', active ? 'active' : '', state.max ? 'max' : '', state.min ? 'min' : ''].join(' ').trim();

  return (
    <section className={cls} style={style} aria-label={app.name} onPointerDown={onFocus}>
      <div className="titlebar" onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={onMax}>
        <span className="title"><Icon name={app.icon} size={16} /> {app.name}</span>
        <span className="controls">
          <button type="button" className="ctl" aria-label={`Minimize ${app.name}`} onClick={onMin}>
            <svg width="11" height="11" viewBox="0 0 12 12" {...ctl}><path d="M2 6h8" /></svg>
          </button>
          <button type="button" className="ctl" aria-label={state.max ? `Restore ${app.name}` : `Maximize ${app.name}`} onClick={onMax}>
            {state.max ? (
              <svg width="11" height="11" viewBox="0 0 12 12" {...ctl}><rect x="2" y="4" width="6" height="6" rx="1" /><path d="M4 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H8" /></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" {...ctl}><rect x="2" y="2" width="8" height="8" rx="1" /></svg>
            )}
          </button>
          <button type="button" className="ctl close" aria-label={`Close ${app.name}`} onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 12 12" {...ctl}><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
          </button>
        </span>
      </div>
      <div className="win-body">{children}</div>
    </section>
  );
}
