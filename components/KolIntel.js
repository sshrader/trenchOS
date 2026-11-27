'use client';

import { useState } from 'react';
import { post, f1 } from '../lib/client';

const LINK_OPTIONS = [
  ['self', 'Self-disclosed by the account'],
  ['confirmed', 'Confirmed (signed message or on-chain proof)'],
  ['probable', 'Probable (inferred)'],
  ['unknown', 'Unknown'],
];
const short = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const fmtMin = (m) => {
  const a = Math.abs(m);
  const t = a < 90 ? `${a} min` : a < 2880 ? `${(a / 60).toFixed(1)} h` : `${(a / 1440).toFixed(1)} d`;
  return t;
};
function describe(r) {
  if (r.status === 'outside-history') return 'Mention is older than the fetched history';
  if (r.status === 'no-activity') return 'No activity found';
  const parts = [];
  if (r.status === 'bought-before') parts.push(`First buy ${fmtMin(r.firstBuyOffsetMin)} before the mention`);
  else parts.push(r.firstBuyOffsetMin == null ? 'No buy found' : `First buy ${fmtMin(r.firstBuyOffsetMin)} after the mention`);
  if (r.soldWithin24hMin != null) parts.push(`sold ${fmtMin(r.soldWithin24hMin)} after the mention`);
  return parts.join(' · ');
}

export default function KolIntel({ code }) {
  const [handle, setHandle] = useState('');
  const [wallet, setWallet] = useState('');
  const [link, setLink] = useState('self');
  const [calls, setCalls] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  async function run(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setReport(null);
    try {
      setReport(await post('/api/kol-intel', { handle, wallet, link, calls }, code));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const s = report?.summary;
  return (
    <>
      <p className="lead">
        Compare what a public wallet did with the times of an account's posts about specific tokens. You supply the wallet, how it is linked, and the post times. Timing is a pattern, never proof.
      </p>
      <form className="panel" onSubmit={run}>
        <label htmlFor="kol-handle">Account handle (optional, shown as a label only)</label>
        <input id="kol-handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" style={{ width: '100%', marginBottom: 12 }} />
        <label htmlFor="kol-wallet">Wallet address</label>
        <input id="kol-wallet" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Paste a Solana wallet address" required style={{ width: '100%', marginBottom: 12 }} />
        <label htmlFor="kol-link">How is this wallet linked to the account?</label>
        <select id="kol-link" value={link} onChange={(e) => setLink(e.target.value)} className="select" style={{ marginBottom: 12 }}>
          {LINK_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label htmlFor="kol-calls">Posts about tokens (one per line: mint, date and time in UTC)</label>
        <textarea id="kol-calls" value={calls} onChange={(e) => setCalls(e.target.value)} className="textarea" rows={4} placeholder={'TokenMintAddress, 2025-11-20 14:30\nAnotherMintAddress, 2025-11-21T09:05:00Z'} required />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Comparing…' : 'Compare timing'}</button>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
      </form>
      {report && (
        <section className="panel" aria-live="polite">
          <div className="note">Generated {new Date(report.generatedAt).toLocaleString()}</div>
          <h2 style={{ margin: '4px 0' }}>{report.handle ? `@${report.handle}` : 'Wallet'} · <code>{short(report.wallet)}</code></h2>
          <div><span className="tag">Link: {report.link.label}</span></div>
          <div className="note" style={{ marginTop: 6 }}>{report.link.note}</div>
          {report.problems.map((p) => <div className="note" key={p}>Note: {p}</div>)}
          <div className="metrics">
            <div className="metric"><div className="note">Mentions checked</div><b>{s.calls}</b></div>
            <div className="metric"><div className="note">Wallet traded</div><b>{s.evaluable}</b></div>
            <div className="metric"><div className="note">First buy before / after</div><b>{s.boughtBefore} / {s.boughtAfter}</b></div>
            <div className="metric"><div className="note">Early buy, sold within 24 h</div><b>{s.boughtBeforeThenSold24h}</b></div>
          </div>
          {report.explanation && <p className="explain">{report.explanation}</p>}
          {report.results.map((r) => (
            <div className="check" key={r.mint + r.at}>
              <div className="head"><span><code>{short(r.mint)}</code></span><span className="note">{new Date(r.at).toLocaleString()}</span></div>
              <div>{describe(r)}</div>
            </div>
          ))}
          {report.footprint && (
            <div className="note">Wallet's overall trading style: {report.footprint.archetype} (win rate {f1(report.footprint.metrics.winRatePct)}%, median hold {f1(report.footprint.metrics.medianHoldMin)} min). Entertainment-grade profile from recent swaps.</div>
          )}
          <div className="note">Checked {report.window.transactions} recent transactions{report.window.start ? `, back to ${new Date(report.window.start).toLocaleDateString()}` : ''}.</div>
          <ul className="note caveats">{report.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="note">Sources: {report.sources.join(' · ')}.</div>
        </section>
      )}
    </>
  );
}
