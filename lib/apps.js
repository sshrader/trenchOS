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
    id: 'whale', name: 'Whale Radar', short: 'Whales', icon: 'radar', soon: true, w: 520, h: 280,
    desc: 'A live radar for notable wallet activity: large buys and sells, dormant wallets waking up, and wallets buying the same token together. Every alert will explain why it was flagged.',
  },
  {
    id: 'nar', name: 'Narrative Scanner', short: 'Trends', icon: 'trend', soon: true, w: 520, h: 280,
    desc: 'Groups new token names and public chatter into themes, and shows whether each is accelerating, crowded or fading, with the examples behind it.',
  },
  {
    id: 'kol', name: 'KOL Intelligence', short: 'KOLs', icon: 'user', soon: true, w: 520, h: 300,
    desc: "Research a public account's observable Solana footprint. Wallet links are labeled confirmed, self-disclosed, probable or unknown, and timing is never presented as proof.",
  },
  {
    id: 'agents', name: 'Agent Wars', short: 'Agents', icon: 'bot', soon: true, w: 520, h: 300,
    desc: 'AI agents with different strategies compete on paper portfolios, with fees, slippage and every trade published. Simulated results only, never real funds.',
  },
  { id: 'guide', name: 'Guide', short: 'Guide', icon: 'help', system: true, w: 620, h: 560 },
  { id: 'settings', name: 'Settings', short: 'Settings', icon: 'gear', system: true, w: 480, h: 440 },
];
