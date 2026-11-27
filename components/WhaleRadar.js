'use client';

import { useState } from 'react';
import { post } from '../lib/client';

const short = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : 'unknown');
const pct = (n, d = 2) => `${n.toFixed(d)}%`;
const signed = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const ago = (t) => {
  if (!t) return 'n/a';
  const m = Math.max(0, Math.round((Date.now() / 1000 - t) / 60));
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
const ROLE = { wallet: 'Wallet', program: 'Pool or program', unknown: 'Unknown' };
const DIR = { adding: 'Adding', reducing: 'Reducing', steady: 'Roughly flat' };

export default function WhaleRadar({ code }) {
  const [mint, setMint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  async function scan(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setReport(null);
    try {
      setReport(await post('/api/whale-radar', { mint }, code));
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
        Paste a token mint to see who holds it and what the biggest wallets did in their recent transactions. This describes the past. It does not predict anything.
      </p>
      <form className="panel" onSubmit={scan}>
        <label htmlFor="whale-mint">Token mint address</label>
        <div className="row">
          <input id="whale-mint" value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Paste a Solana token mint" required />
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Scanning…' : 'Scan holders'}</button>
        </div>
        {loading && <div className="note" style={{ marginTop: 10 }}>Reading recent transactions for the largest wallets. This can take 10 to 20 seconds.</div>}
        {error && <div className="err" role="alert">{error}</div>}
      </form>
      {report && (
        <section className="panel" aria-live="polite">
          <div className="note">Generated {new Date(report.generatedAt).toLocaleString()}</div>
          <div className="metrics">
            <div className="metric"><div className="note">Top wallets hold</div><b>{pct(s.walletsPct, 1)}</b></div>
            <div className="metric"><div className="note">Pools and programs</div><b>{pct(s.programPct, 1)}</b></div>
            <div className="metric"><div className="note">Adding / reducing / flat</div><b>{s.adding} / {s.reducing} / {s.steady}</b></div>
            <div className="metric"><div className="note">Net change, tracked wallets</div><b>{signed(s.netFlowPctOfSupply)}</b></div>
          </div>
          {report.coverage?.failed > 0 && (
            <div className="err" role="status">
              Partial result: {report.coverage.failed} of {report.coverage.requested} transactions could not be read because the data provider rate-limited the request. Try again in a minute.
            </div>
          )}
          {report.explanation && <p className="explain">{report.explanation}</p>}
          {report.holders.map((h, i) => (
            <div className="check" key={h.tokenAccount}>
              <div className="head">
                <span>#{i + 1} <code>{short(h.owner)}</code></span>
                <span className="tag">{ROLE[h.role]}</span>
              </div>
              <div>Holds {pct(h.holdingPct)} of supply</div>
              {h.tracked ? (
                <div className="note">
                  {DIR[h.direction]} · net {signed(h.netPctOfSupply)} of supply over {h.txs} recent transfers ({h.movedIn} in, {h.movedOut} out) · last active {ago(h.lastActive)}
                </div>
              ) : (
                <div className="note">{h.role === 'wallet' ? 'Not tracked (outside the top 10 wallets).' : 'Program-controlled, not tracked as a whale.'}</div>
              )}
            </div>
          ))}
          <ul className="note caveats">{report.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="note">Sources: {report.sources.join(' · ')}.</div>
        </section>
      )}
    </>
  );
}
