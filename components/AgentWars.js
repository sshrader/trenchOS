'use client';

import { useState } from 'react';
import { post, f1 } from '../lib/client';

const usd = (n) => `$${n.toFixed(2)}`;
const signed = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
const px = (n) => (n < 0.01 ? n.toExponential(2) : n.toPrecision(4));

export default function AgentWars({ code }) {
  const [mint, setMint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  async function run(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setReport(null);
    try {
      setReport(await post('/api/agent-wars', { mint }, code));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="lead">
        Five rule-based agents trade a paper $1,000 over a token's recent price history, with fees and slippage. Every trade is listed. Simulated results only, never advice and never a forecast.
      </p>
      <form className="panel" onSubmit={run}>
        <label htmlFor="wars-mint">Token mint address</label>
        <div className="row">
          <input id="wars-mint" value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Paste a Solana token mint" required />
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Simulating…' : 'Start the war'}</button>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
      </form>
      {report && (
        <section aria-live="polite">
          <div className="panel">
            <div className="note">
              {report.symbol || 'Token'} · {Math.round(report.window.hours)} hours of {report.window.candleMinutes}-minute candles ({report.window.candles}) · start {usd(report.assumptions.startCash)} · fee {report.assumptions.feePct}% + slippage from ${Math.round(report.assumptions.liquidityUsd).toLocaleString()} pool liquidity
            </div>
            {report.explanation && <p className="explain">{report.explanation}</p>}
            <div className="note">Buy and hold: {signed(report.holdReturnPct)} · {report.beatHold} of 4 trading agents beat it.</div>
          </div>
          {report.results.map((r, i) => (
            <div className="check" key={r.id}>
              <div className="head">
                <span>#{i + 1} {r.name} <span className="note">· {r.style}</span></span>
                <span className="tag">{signed(r.returnPct)}</span>
              </div>
              <div className="note">{r.blurb}</div>
              <div className="note">
                Final {usd(r.finalValue)} · {r.trades} trades · win rate {r.winRatePct == null ? 'n/a' : `${f1(r.winRatePct)}%`} · worst drop {f1(r.maxDrawdownPct)}% · costs {usd(r.costsUsd)}
              </div>
              {r.ledger.length > 0 && (
                <details>
                  <summary>Trade ledger ({r.ledger.length})</summary>
                  <ul className="caveats note">
                    {r.ledger.map((t, k) => (
                      <li key={k}>
                        {new Date(t.t).toLocaleString()} · {t.side === 'buy' ? 'Bought' : 'Sold'} {usd(t.usd)} at {px(t.price)} · fee {usd(t.feeUsd)} · slippage {t.slipPct.toFixed(2)}%{t.note ? ` · ${t.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
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
