'use client';

import { useState } from 'react';
import { post } from '../lib/client';

const usd = (n) => (n == null ? 'n/a' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${Math.round(n)}`);
const age = (h) => (h == null ? 'n/a' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${Math.round(h / 24)} d`);
const MOM = { accelerating: 'Accelerating', steady: 'Steady', fading: 'Fading', 'too few to call': 'Too few to call' };

export default function NarrativeScanner({ code }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  async function run(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      setReport(await post('/api/narrative-scan', {}, code));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="lead">
        Groups recently promoted Solana tokens into name themes and shows how many launched recently versus earlier. It describes what is being launched, not what will pump.
      </p>
      <form className="panel" onSubmit={run}>
        <div className="row" style={{ alignItems: 'center' }}>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Scanning…' : report ? 'Scan again' : 'Scan now'}</button>
          <span className="note">Results are shared and refresh at most every 3 minutes.</span>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
      </form>
      {report && (
        <section aria-live="polite">
          <div className="panel">
            <div className="note">
              Generated {new Date(report.generatedAt).toLocaleString()} · {report.sample.tokens} tokens sampled · {report.sample.grouped} grouped into {report.themes.length} themes · {report.sample.ungrouped} did not match a theme
            </div>
            {report.explanation && <p className="explain">{report.explanation}</p>}
          </div>
          {report.themes.length === 0 && <div className="panel note">No shared name words were found in this sample.</div>}
          {report.themes.map((t) => (
            <div className="check" key={t.word}>
              <div className="head">
                <span style={{ textTransform: 'capitalize' }}>{t.word} <span className="note">· {t.count} tokens</span></span>
                <span>
                  <span className="tag">{MOM[t.momentum]}</span>{' '}
                  {t.crowded && <span className="tag">Crowded</span>}
                </span>
              </div>
              <div className="note">
                {t.recent} launched in the last 3 h · {t.earlier} launched 3–24 h ago · {Math.round(t.thinSharePct)}% have under $5k liquidity · median liquidity {usd(t.medianLiquidityUsd)} · 24 h volume {usd(t.volume24h)}
              </div>
              <ul className="caveats note">
                {t.examples.map((x) => (
                  <li key={x.mint}>
                    <a href={`https://dexscreener.com/solana/${x.mint}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      {x.name || 'Unnamed'} ({x.symbol || '?'})
                    </a>{' '}
                    · {usd(x.liquidityUsd)} liquidity · {age(x.ageHours)} old{x.boosted ? ' · boosted' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <ul className="note caveats">{report.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="note">Sources: {report.sources.join(' · ')}.</div>
        </section>
      )}
    </>
  );
}
