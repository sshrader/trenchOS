'use client';

import { useRef } from 'react';
import { Icon } from './icons';

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
    const y = Math.max(36, Math.min(window.innerHeight - 40, d.y + e.clientY - d.py));
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
          <button type="button" className="ctl" aria-label={`Minimize ${app.name}`} onClick={onMin}>&#8211;</button>
          <button type="button" className="ctl" aria-label={state.max ? `Restore ${app.name}` : `Maximize ${app.name}`} onClick={onMax}>{state.max ? '❐' : '□'}</button>
          <button type="button" className="ctl close" aria-label={`Close ${app.name}`} onClick={onClose}>&#215;</button>
        </span>
      </div>
      <div className="win-body">{children}</div>
    </section>
  );
}
