// App registry for the desktop. `soon` apps open a placeholder window; `system` apps sit at the bottom of the dock.
export const APPS = [
  {
    id: 'rug', name: 'RugVision', short: 'RugVision', icon: 'shield', w: 740, h: 640,
    desc: "Paste a token's mint address to get a checklist of risk signals, each with its evidence.",
  },
  {
    id: 'roast', name: 'Wallet Roast', short: 'Roast', icon: 'flame', w: 700, h: 660,
    desc: "Paste a wallet address for a funny profile built from its real trading habits.",
  },
  {
    id: 'whale', name: 'Whale Radar', short: 'Whales', icon: 'radar', w: 760, h: 680,
    desc: 'Paste a token mint to see its largest holders and whether the big wallets have been adding or reducing in their recent transactions. Past activity only.',
  },
  {
    id: 'nar', name: 'Narrative Scanner', short: 'Trends', icon: 'trend', w: 760, h: 680,
    desc: 'Groups recently promoted Solana tokens into name themes and shows which are crowded and whether more launched recently or earlier. Launch counts, not price.',
  },
  {
    id: 'kol', name: 'KOL Intelligence', short: 'KOLs', icon: 'user', w: 740, h: 700,
    desc: "Compare what a public wallet did with the times of an account's posts. You supply the wallet and how it is linked. Timing is a pattern, never proof.",
  },
  {
    id: 'agents', name: 'Agent Wars', short: 'Agents', icon: 'bot', w: 760, h: 700,
    desc: "Five rule-based agents trade a paper $1,000 over a token's recent price history, with fees and slippage. Every trade is listed. Simulated only.",
  },
  { id: 'guide', name: 'Guide', short: 'Guide', icon: 'help', system: true, w: 620, h: 560 },
  { id: 'settings', name: 'Settings', short: 'Settings', icon: 'gear', system: true, w: 480, h: 440 },
];
