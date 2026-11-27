'use client';

export function ComingSoon({ app }) {
  return (
    <div className="panel">
      <div className="chip" style={{ display: 'inline-block', marginBottom: 12 }}>COMING SOON</div>
      <h2 style={{ margin: '0 0 8px' }}>{app.name}</h2>
      <p style={{ margin: 0 }}>{app.desc}</p>
      <p className="note" style={{ marginBottom: 0 }}>Not built yet. Nothing in this window is live data.</p>
    </div>
  );
}

export function Settings({ code, setCode }) {
  return (
    <>
      <div className="panel">
        <label htmlFor="code">Access code (if the server requires one)</label>
        <input id="code" type="password" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: '100%' }} />
        <p className="note" style={{ marginBottom: 0 }}>Kept in this tab only and sent with each request. API keys never reach the browser.</p>
      </div>
      <div className="panel">
        <div style={{ fontWeight: 700 }}>TrencherOS</div>
        <div className="note">Test build. Code does the math and the checks; AI only explains computed results. Nothing here predicts prices or gives trading advice.</div>
      </div>
    </>
  );
}
