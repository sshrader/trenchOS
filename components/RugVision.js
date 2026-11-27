'use client';

import { useState } from 'react';
import { post } from '../lib/client';

export default function RugVision({ code }) {
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
      setReport(await post('/api/rug-scan', { mint }, code));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="lead">
        Paste a token mint address. You get a checklist with evidence, not a single rug score. No scan can guarantee safety.
      </p>
      <form className="panel" onSubmit={scan}>
        <label htmlFor="mint">Token mint address</label>
        <div className="row">
          <input id="mint" value={mint} onChange={(e) => setMint(e.target.value)} placeholder="Paste a Solana token mint" required />
          <button className="btn" type="submit" disabled={loading}>{loading ? 'SCANNING...' : 'RUN SCAN'}</button>
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
    </>
  );
}
