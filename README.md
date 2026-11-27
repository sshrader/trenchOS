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
| `OPENROUTER_API_KEY` | AI explanation via OpenRouter. Optional. |
| `LLM_MODEL` | Comma-separated model ids, tried in order (for example free `:free` models). |
| `ANTHROPIC_API_KEY` | Alternative provider, used if no OpenRouter key is set. |
| `LLM_PROVIDER` | Optional: `openrouter` or `anthropic`. Chosen automatically if unset. |

If no provider is set or every model fails, the app uses a plain-code summary, so scans always work.
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
- Not in this version: liquidity lock/burn detection, bundled-buy detection.

## Modules

- **RugVision** (`/api/rug-scan`): mint and freeze authority, holder concentration, liquidity depth, pair age, deployer history. The deployer is the fee payer of the token's oldest transaction; "other launches" are mints initialized in that wallet's last 40 transactions. It is a heuristic and does not link creators who use several wallets.
- **Wallet Roast** (`/api/wallet-roast`, needs `HELIUS_API_KEY`): reads recent parsed swaps from Helius, computes win rate, hold time and other metrics in code, picks an archetype by fixed rules, then writes a roast (LLM or template). PnL is approximate and limited to the sampled window. It describes behavior only and never identifies a person.

## Untested against live data

The parsing for Helius swaps and for mint creation in `lib/wallet.js` and `lib/deployer.js` was tested with fake data only. If a real wallet or token gives odd results, capture the output and adjust.

## Interface

The home page is a small desktop environment: a top panel with a clock, a left dock (bottom on phones), and draggable windows with minimize, maximize and close. Apps are registered in `lib/apps.js`. Apps marked `soon` open a placeholder window. Closing a window discards its results; minimizing keeps them.
