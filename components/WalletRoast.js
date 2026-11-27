'use client';

import { useState } from 'react';
import { post, f1 } from '../lib/client';

export default function WalletRoast({ code }) {
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [copied, setCopied] = useState(false);

  async function run(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setProfile(null);
    setCopied(false);
    try {
      setProfile(await post('/api/wallet-roast', { wallet }, code));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
    <>
      <p className="lead">
        A funny, evidence-based profile of a public wallet's trading habits. It roasts the behavior, never the person.
      </p>
      <form className="panel" onSubmit={run}>
        <label htmlFor="wallet">Public wallet address</label>
        <div className="row">
          <input id="wallet" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Paste a Solana wallet address" required />
          <button className="btn" type="submit" disabled={loading}>{loading ? 'PROFILING...' : 'GENERATE DOSSIER'}</button>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
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
          <div className="note" style={{ marginTop: 12 }}>
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
  );
}
