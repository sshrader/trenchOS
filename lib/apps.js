// App registry for the desktop. `soon` apps open a placeholder window.
export const APPS = [
  { id: 'rug', name: 'RugVision', icon: 'shield', w: 740, h: 640 },
  { id: 'roast', name: 'Wallet Roast', icon: 'flame', w: 700, h: 660 },
  {
    id: 'whale', name: 'Whale Radar', icon: 'radar', soon: true, w: 520, h: 280,
    desc: 'A live radar for notable wallet activity: large buys and sells, dormant wallets waking up, and wallets buying the same token together. Every alert will explain why it was flagged.',
  },
  {
    id: 'nar', name: 'Narrative Scanner', icon: 'trend', soon: true, w: 520, h: 280,
    desc: 'Groups new token names and public chatter into themes, and shows whether each is accelerating, crowded or fading, with the examples behind it.',
  },
  {
    id: 'kol', name: 'KOL Intelligence', icon: 'user', soon: true, w: 520, h: 300,
    desc: "Research a public account's observable Solana footprint. Wallet links are labeled confirmed, self-disclosed, probable or unknown, and timing is never presented as proof.",
  },
  {
    id: 'agents', name: 'Agent Wars', icon: 'bot', soon: true, w: 520, h: 300,
    desc: 'AI agents with different strategies compete on paper portfolios, with fees, slippage and every trade published. Simulated results only, never real funds.',
  },
  { id: 'settings', name: 'Settings', icon: 'gear', system: true, w: 440, h: 330 },
];
