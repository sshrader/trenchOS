'use client';

import { useState } from 'react';

const MODULES = [
  { name: 'RugVision', active: true },
  { name: 'Wallet Roast', soon: true },
  { name: 'Whale Radar', soon: true },
  { name: 'Narrative Scanner', soon: true },
  { name: 'KOL Intelligence', soon: true },
  { name: 'Agent Wars', soon: true },
];

export default function Home() {
  const [mint, setMint] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  async function scan(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const res = await fetch('/api/rug-scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-code': code },
        body: JSON.stringify({ mint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed.');
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="brand">TRENCHEROS</div>
          <div className="sub">Classified intelligence for the trenches.</div>
        </div>
        <span className="chip">TEST BUILD</span>
      </header>

      <div className="layout">
        <nav className="nav" aria-label="Modules">
          {MODULES.map((m) => (
            <div key={m.name} className={m.active ? 'item active' : 'item'}>
              <span>{m.name}</span>
              {m.soon && <span className="note">SOON</span>}
            </div>
          ))}
        </nav>

        <main className="main">
          <h1>RugVision</h1>
          <p className="lead">
            Paste a token mint address. You get a checklist with evidence, not a single rug score. No scan can guarantee safety.
          </p>

          <form className="panel" onSubmit={scan}>
            <label htmlFor="mint">Token mint address</label>
            <div className="row">
              <input id="mint" value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Paste a Solana token mint" required />
              <button className="btn" type="submit" disabled={loading}>{loading ? 'SCANNING...' : 'RUN SCAN'}</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <label htmlFor="code">Access code (if required)</label>
              <input id="code" type="password" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            {error && <div className="err" role="alert">{error}</div>}
          </form>

          {report && (
            <section className="panel" aria-live="polite">
              <div className="note">Generated {new Date(report.generatedAt).toLocaleString()}</div>
              <h2 style={{ margin: '4px 0' }}>RISK SIGNALS REQUIRE REVIEW</h2>
              <div className="note">
                {report.summary.flags} flags · {report.summary.reviews} to review · {report.summary.passes} passed
              </div>
              {report.explanation && <p className="explain">{report.explanation}</p>}
              {report.checks.map((c) => (
                <div className="check" key={c.name}>
                  <div className="head"><span>{c.name}</span><span className={c.status}>{c.status}</span></div>
                  <div>{c.evidence}</div>
                  <div className="note">Confidence: {c.confidence}</div>
                </div>
              ))}
              <div className="note">Sources: {report.sources.join(' · ')}. A token can be risky without being a scam.</div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
