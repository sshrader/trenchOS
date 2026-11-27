'use client';

import { useState } from 'react';

const MODULES = [
  { id: 'rug', name: 'RugVision' },
  { id: 'roast', name: 'Wallet Roast' },
  { id: 'whale', name: 'Whale Radar', soon: true },
  { id: 'nar', name: 'Narrative Scanner', soon: true },
  { id: 'kol', name: 'KOL Intelligence', soon: true },
  { id: 'agents', name: 'Agent Wars', soon: true },
];

async function post(url, body, code) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': code },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error([data.error || 'Request failed.', data.detail].filter(Boolean).join(' '));
  return data;
}

const f1 = (n) => (n == null ? 'n/a' : n.toFixed(1));

export default function Home() {
  const [mod, setMod] = useState('rug');
  const [code, setCode] = useState('');

  const [mint, setMint] = useState('');
  const [rugLoading, setRugLoading] = useState(false);
  const [rugError, setRugError] = useState('');
  const [report, setReport] = useState(null);

  const [wallet, setWallet] = useState('');
  const [roastLoading, setRoastLoading] = useState(false);
  const [roastError, setRoastError] = useState('');
  const [profile, setProfile] = useState(null);
  const [copied, setCopied] = useState(false);

  async function scan(e) {
    e.preventDefault();
    setRugLoading(true);
    setRugError('');
    setReport(null);
    try {
      setReport(await post('/api/rug-scan', { mint }, code));
    } catch (err) {
      setRugError(err.message);
    } finally {
      setRugLoading(false);
    }
  }

  async function runRoast(e) {
    e.preventDefault();
    setRoastLoading(true);
    setRoastError('');
    setProfile(null);
    setCopied(false);
    try {
      setProfile(await post('/api/wallet-roast', { wallet }, code));
    } catch (err) {
      setRoastError(err.message);
    } finally {
      setRoastLoading(false);
    }
  }

  async function copySummary() {
    const m = profile.metrics;
    const text = [
      `TRENCHEROS WALLET DOSSIER: ${profile.archetype.name}`,
      profile.roast,
      `Trades analyzed: ${m.tradesAnalyzed} · Closed tokens: ${m.closedTokens} · Win rate: ${f1(m.winRatePct)}% · Median hold: ${f1(m.medianHoldMin)} min`,
      'Entertainment only. Based on recent swaps.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
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
          {MODULES.map((m) =>
            m.soon ? (
              <div key={m.id} className="item">
                <span>{m.name}</span>
                <span className="note">SOON</span>
              </div>
            ) : (
              <button
                key={m.id}
                type="button"
                className={mod === m.id ? 'item active' : 'item'}
                aria-current={mod === m.id ? 'page' : undefined}
                onClick={() => setMod(m.id)}
              >
                {m.name}
              </button>
            ),
          )}
        </nav>

        <main className="main">
          <div className="panel">
            <label htmlFor="code">Access code (if required)</label>
            <input id="code" type="password" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>

          {mod === 'rug' && (
            <>
              <h1>RugVision</h1>
              <p className="lead">
                Paste a token mint address. You get a checklist with evidence, not a single rug score. No scan can guarantee safety.
              </p>
              <form className="panel" onSubmit={scan}>
                <label htmlFor="mint">Token mint address</label>
                <div className="row">
                  <input id="mint" value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Paste a Solana token mint" required />
                  <button className="btn" type="submit" disabled={rugLoading}>{rugLoading ? 'SCANNING...' : 'RUN SCAN'}</button>
                </div>
                {rugError && <div className="err" role="alert">{rugError}</div>}
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
            </>
          )}

          {mod === 'roast' && (
            <>
              <h1>Wallet Roast</h1>
              <p className="lead">
                A funny, evidence-based profile of a public wallet's trading habits. It roasts the behavior, never the person.
              </p>
              <form className="panel" onSubmit={runRoast}>
                <label htmlFor="wallet">Public wallet address</label>
                <div className="row">
                  <input id="wallet" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Paste a Solana wallet address" required />
                  <button className="btn" type="submit" disabled={roastLoading}>{roastLoading ? 'PROFILING...' : 'GENERATE DOSSIER'}</button>
                </div>
                {roastError && <div className="err" role="alert">{roastError}</div>}
              </form>
              {profile && (
                <section className="panel card" aria-live="polite">
                  <div className="note">WALLET DOSSIER GENERATED</div>
                  <h2 className="archetype">{profile.archetype.name}</h2>
                  <div className="note">{profile.archetype.blurb}</div>
                  <div className="metrics">
                    <div className="metric"><div className="note">Trades analyzed</div><b>{profile.metrics.tradesAnalyzed}</b></div>
                    <div className="metric"><div className="note">Closed tokens</div><b>{profile.metrics.closedTokens}</b></div>
                    <div className="metric"><div className="note">Win rate</div><b>{f1(profile.metrics.winRatePct)}%</b></div>
                    <div className="metric"><div className="note">Median hold</div><b>{f1(profile.metrics.medianHoldMin)} min</b></div>
                    <div className="metric"><div className="note">Best trade</div><b>{profile.metrics.bestPct == null ? 'n/a' : `${f1(profile.metrics.bestPct)}%`}</b></div>
                    <div className="metric"><div className="note">Worst trade</div><b>{profile.metrics.worstPct == null ? 'n/a' : `${f1(profile.metrics.worstPct)}%`}</b></div>
                  </div>
                  <p className="explain">{profile.roast}</p>
                  <button type="button" className="btn ghost" onClick={copySummary}>{copied ? 'COPIED' : 'COPY SUMMARY'}</button>
                  <div className="note">
                    Sample: {profile.diagnostics.transactionsFetched} transactions fetched, {profile.diagnostics.usableTrades} usable as token buys or sells
                    {profile.diagnostics.widenedSearch ? ' (widened search used)' : ''}.
                    {Object.keys(profile.sample.skipped).length > 0 && (
                      <> Skipped: {Object.entries(profile.sample.skipped).map(([k, v]) => `${k} ${v}`).join(', ')}.</>
                    )}
                  </div>
                  <ul className="note caveats">
                    {profile.caveats.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
