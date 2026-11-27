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

The home page is a small desktop environment: a wallpaper with double-click desktop icons, a taskbar with a Start menu, running apps and a clock, and draggable windows with minimize, maximize and close. Apps are registered in `lib/apps.js`. Apps marked `soon` open a placeholder window. Closing a window discards its results; minimizing keeps them.

## Whale Radar

Paste a token mint. The app lists the 20 largest token accounts, separates ordinary wallets from program-controlled accounts (pools, vaults, bonding curves) by checking whether the owner address is on the ed25519 curve, then reads recent transfers for the top 10 wallets (one Helius enhanced-transactions call per wallet when HELIUS_API_KEY is set, otherwise small paced RPC batches with retries) and computes each wallet's net change in that token. Code does all of the math; the model only phrases the summary, with a plain template when no model is configured. It describes past activity only. Moving tokens between a person's own wallets looks like a buy or sell, and the time window differs per wallet. Untested against live data until you run it on Railway.

## Narrative Scanner

Pulls Solana tokens from DexScreener's recent profiles and boosts, looks up their pools, and groups them by shared words in their names (each token goes in at most one theme). For each theme it reports the token count, how many launched in the last 3 hours versus the 3 to 24 hours before, the share with under $5k liquidity, and examples. "Accelerating", "steady" and "fading" describe launch counts only, never price. The sample is small and biased toward tokens whose creators paid for promotion. Only short lowercase theme words and numbers are sent to the model, and a plain template is used when no model is set. Results are cached for 3 minutes. Untested against live data.

## KOL Intelligence

You give it a wallet, how you know the wallet is linked to a public account (confirmed, self-disclosed, probable or unknown), and a list of "token mint, date and time (UTC)" lines for that account's posts. It fetches the wallet's last 500 transactions from Helius and reports, for each post, whether the wallet's first buy came before or after the mention and whether it sold within 24 hours after. The tool never reads X and never decides who owns a wallet. Results are patterns, not proof, and the window is limited to the fetched history. The account handle and any free text are never sent to the model, only counts and the link label.

## Agent Wars

Five rule-based agents (buy and hold, momentum, dip buyer, breakout with trailing stop, and a seeded random baseline) trade a paper $1,000 over up to the last 1,000 candles of a token's best pool (5-minute, or 1-minute for young tokens) (DexScreener for the pool, GeckoTerminal for candles, both free). Signals use only past candles and fills happen at the next candle's open. Costs are a 0.5% fee plus slippage estimated from the pool's current liquidity. All decisions are code; the model only writes commentary from the results. Simulated only, never advice. Untested against live data.
