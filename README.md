# TrencherOS

Solana token intelligence with evidence-based risk checks. First module: **RugVision** (paste a mint address, get a checklist with evidence and a short AI explanation).

Design rule: code does all arithmetic and risk checks. The AI only explains the computed results. It never predicts prices or gives buy/sell advice.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in keys
npm run dev
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `HELIUS_API_KEY` | Solana RPC data. Falls back to the public RPC (rate limited) if unset. |
| `ANTHROPIC_API_KEY` | AI explanation. Scans still work without it. |
| `ANTHROPIC_MODEL` | Optional model override. |
| `ACCESS_CODE` | Optional invite gate for testing. |
| `RATE_LIMIT_PER_MIN` | Scans per minute per IP (default 10). |

## Deploy on Railway

1. In Railway, choose **New Project > Deploy from GitHub repo** and select this repo.
2. Add the variables above in the service's **Variables** tab. Set `ACCESS_CODE` while testing.
3. In **Settings > Networking**, generate a public domain.
4. Pushes to `main` redeploy automatically.
5. Set spend limits on your Helius and Anthropic accounts before sharing the URL.

## Notes

- Never collect private keys or seed phrases. Read-only public addresses are enough.
- The rate limiter is in memory (one instance). Use Redis or Postgres if you scale out.
- Thresholds for each check are in `lib/checks.js`, shown to users in the evidence text.
- Not in this version: liquidity lock/burn detection, deployer history, bundled-buy detection.
