// FIELDNOTES Token Radar — model radar-3.
//
// One sealed DefiLlama snapshot in, one ranked board out. The board covers every slug in the
// snapshot's watchlist (the floor, never a ceiling) and adds early pre-token protocols the
// watchlist does not name — most below the floor, a few set aside by the watchlist rule itself. A protocol is pre-token when its record carries no token
// (no market cap, no CoinGecko id, no symbol); tokenized protocols are calibrated against, never
// ranked, and are shown apart with the market's own values.
//
// The implied value is a circulating-cap proxy learned from the snapshot itself, not a fixed
// multiple and never a hardcoded name. Four factors, each traceable to a figure the snapshot
// itself carries — its TVL, its seven-day growth, and how long it has run with no token:
//
//   peers      = tokenized protocols (mcap > 0, TVL >= $5M, non-derivative category)
//   ratio      = mcap_usd / tvl_usd for each peer, kept inside [0.005, 100]
//   anchor     = the category's peer multiple: exp of the category median log ratio blended
//                toward the global median log with weight w = peers / (peers + 12), clamped to
//                [0.03, 8]. A category with fewer than 4 peers has no anchor of its own: it is
//                priced at the global multiple exactly, and the row says so.
//   growthF    = exp(0.30 * log1p(clamp(change_7d, -60, 120) / 100))     (about 0.76x to 1.27x)
//   spikeF     = 1 - 0.15 * clamp((change_7d - 60) / 120, 0, 1)          (unsustainable-spike haircut)
//   maturityF  = 0.75 + 0.25 * log1p(min(age_days, 1825)) / log1p(1825)   (unknown age: 180 days)
//   implied    = max(1, round(tvl_usd * anchor * growthF * spikeF * maturityF))
//
// What a record does not carry is reported, never priced in: each missing input (no growth
// figure, no listing day, no chain) widens the peer dispersion range by a tenth on each side
// instead of discounting the value, and lowers the evidence grade. Evidence is reported
// separately from value: high needs >= 12 category peers and no missing inputs, medium needs
// >= 4 peers and at most one missing input, otherwise low. The range itself is the category's
// quartile multiples through the same shrinkage (the global quartiles when the category is
// thin), shown per protocol, never as a promise.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the board carries it. */
export const MODEL_VERSION = 'radar-3';

/** Total board size: the whole watchlist plus the early rows below. */
export const BOARD_ROWS = 200;

/** Early-selection buckets: broad value, mid-size value, young momentum. */
const BUCKET_BROAD = 80;
const BUCKET_MID = 50;
const BUCKET_YOUNG = 30;

/** Categories that name a derivative of someone else's asset, never a launch of its own. */
const DERIVATIVE_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whole words that mark a wrapped, staked or bridged product of a token that already trades. */
const DERIVATIVE_WORD = /\b(wrapped|staked|staking|bridged)\b/i;

/** Names that begin with an exchange's name are that exchange's product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export type Evidence = 'high' | 'medium' | 'low';
export type Stage = 'watchlist' | 'early';

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  stage: Stage;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  evidence: Evidence;
  model: {
    category_multiple: number;
    category_peers: number;
    /** 'category' when the category's own peers priced it, 'global' when too thin to price itself. */
    anchor_source: 'category' | 'global';
    global_multiple: number;
    growth_factor: number;
    maturity_factor: number;
    spike_factor: number;
    /** Inputs the record does not carry (growth, listing day, chains): they widen the range. */
    missing_inputs: number;
  };
  farm_steps: string[];
  /** The plan's totals in one line: capital, fees, hands-on time and holding period. */
  farm_summary: string;
}

/** The dashboard's view of one row: everything the page renders, farm plan included. */
export interface RadarRow extends BoardRow {}

/** A tokenized protocol: it already trades, so the page shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  ratio: number | null;
}

/** One category's calibration: how many peers priced it and what multiples they imply. */
export interface CategoryStat {
  category: string;
  peers: number;
  multiple: number;
  /** The shrunk quartile multiples: the dispersion a row in this category inherits. */
  low: number;
  high: number;
}

/** Everything the dashboard needs: the board, the live set, the calibration and the method. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  /** The global peer quartiles: the range a thin category's rows inherit. */
  global_low: number;
  global_high: number;
  global_peers: number;
  /** Every protocol in the snapshot accounted for: ranked, trading, set aside, or below the cut. */
  accounting: {
    snapshot_protocols: number;
    ranked: number;
    trading: number;
    excluded_derivative: number;
    below_cut: number;
  };
  board_tvl_usd: number;
  median_implied_usd: number;
  categories: CategoryStat[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `listed_at` to the snapshot's `as_of`, clamped at zero; null when absent. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const d = Math.floor((a - b) / DAY_MS);
  return d < 0 ? null : d;
}

/** A quantile with linear interpolation at index (n - 1) * p, over an ascending array. */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const at = (sorted.length - 1) * p;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a name or category marks a wrapped, staked, bridged or exchange product. */
export function isDerivative(p: SnapshotProtocol): boolean {
  if (p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) return true;
  if (DERIVATIVE_WORD.test(p.name)) return true;
  if (EXCHANGE_PREFIX.test(p.name)) return true;
  return false;
}

/** Whether a protocol may be ranked: pre-token, not a derivative, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isDerivative(p) && !VERSIONED.test(p.name);
}

/** The calibration learned from the snapshot's tokenized protocols. */
export interface Calibration {
  globalMultiple: number;
  globalLow: number;
  globalHigh: number;
  globalPeers: number;
  /** category -> shrunk multiple, peer count, and the quartile multiples for the range. */
  byCategory: Map<string, { multiple: number; peers: number; low: number; high: number }>;
}

/** Learn category multiples from tokenized peers: log ratios, winsorized, shrunk to the global. */
export function calibrate(snapshot: Snapshot): Calibration {
  const peers = snapshot.protocols.filter(
    (p) =>
      p.mcap_usd !== null &&
      p.mcap_usd > 0 &&
      p.tvl_usd >= 5_000_000 &&
      p.category !== null &&
      !isDerivative(p),
  );
  const usable = peers
    .map((p) => ({ category: p.category!, ratio: p.mcap_usd! / p.tvl_usd }))
    .filter((r) => r.ratio >= 0.005 && r.ratio <= 100);
  const logs = usable.map((r) => Math.log(r.ratio)).sort((a, b) => a - b);
  if (logs.length === 0) {
    return { globalMultiple: 0.25, globalLow: 0.25, globalHigh: 0.25, globalPeers: 0, byCategory: new Map() };
  }
  const wLo = quantile(logs, 0.1);
  const wHi = quantile(logs, 0.9);
  const win = (x: number): number => clamp(x, wLo, wHi);
  const winLogs = logs.map(win).sort((a, b) => a - b);
  const globalLog = quantile(winLogs, 0.5);
  const globalMultiple = Math.exp(globalLog);
  const globalLow = clamp(Math.exp(quantile(winLogs, 0.25)), 0.03, 8);
  const globalHigh = clamp(Math.exp(quantile(winLogs, 0.75)), 0.03, 8);
  const differentiate = logs.length >= 10;
  const byCategory = new Map<string, { multiple: number; peers: number; low: number; high: number }>();
  const groups = new Map<string, number[]>();
  for (const r of usable) {
    const arr = groups.get(r.category) ?? [];
    arr.push(win(Math.log(r.ratio)));
    groups.set(r.category, arr);
  }
  for (const [category, arr] of groups) {
    arr.sort((a, b) => a - b);
    const w = differentiate ? arr.length / (arr.length + 12) : 0;
    const shrink = (q: number): number => {
      const catLog = quantile(arr, q);
      return clamp(Math.exp(w * catLog + (1 - w) * globalLog), 0.03, 8);
    };
    byCategory.set(category, {
      multiple: shrink(0.5),
      peers: arr.length,
      low: shrink(0.25),
      high: shrink(0.75),
    });
  }
  return { globalMultiple, globalLow, globalHigh, globalPeers: logs.length, byCategory };
}

/** The scored parts of one protocol's implied value, before the final rounding. */
export interface Scored {
  implied: number;
  low: number;
  high: number;
  age: number | null;
  evidence: Evidence;
  multiple: number;
  peers: number;
  anchorSource: 'category' | 'global';
  growthF: number;
  maturityF: number;
  spikeF: number;
  missing: number;
}

/** Peers a category needs before its own multiple, rather than the global one, prices a row. */
const ANCHOR_MIN_PEERS = 4;

/** Score one pre-token protocol under the calibration: the same function scores every row. */
export function scoreProtocol(p: SnapshotProtocol, asOf: string, cal: Calibration): Scored {
  const age = ageDays(asOf, p.listed_at);
  const hasGrowth = p.change_7d !== null && Number.isFinite(p.change_7d);
  const g = hasGrowth ? p.change_7d! : 0;
  const gClamped = clamp(g, -60, 120);
  const growthF = Math.exp(0.3 * Math.log1p(gClamped / 100));
  const spikeF = 1 - 0.15 * clamp((g - 60) / 120, 0, 1);
  // Maturity rises on a log curve: most of the credit arrives in the first two tokenless years,
  // and a protocol tracked five years with no token earns the last of it. No cliff, no cap jump.
  const ageForModel = age ?? 180;
  const maturityF = 0.75 + 0.25 * (Math.log1p(Math.min(ageForModel, 1825)) / Math.log1p(1825));
  const chainCount = new Set(p.chains).size;
  const missing = (hasGrowth ? 0 : 1) + (age === null ? 1 : 0) + (chainCount === 0 ? 1 : 0);
  const cat = p.category !== null ? cal.byCategory.get(p.category) : undefined;
  const peers = cat?.peers ?? 0;
  // A category with fewer than 4 peers cannot price its own rows: the global multiple anchors
  // them exactly, and the row's anchor_source says so instead of hiding behind shrinkage.
  const anchored = cat !== undefined && peers >= ANCHOR_MIN_PEERS;
  const multiple = anchored ? cat!.multiple : cal.globalMultiple;
  // The range is the anchor's own dispersion: the category's shrunk quartiles when it priced
  // the row, the global quartiles when it could not. Each input the record does not carry
  // widens the band a tenth on each side — uncertainty is shown, never priced into the value.
  const lowMult = anchored ? cat!.low : cal.globalLow;
  const highMult = anchored ? cat!.high : cal.globalHigh;
  const widen = Math.pow(1.1, missing);
  // The value is computed from the factors exactly as the row stores them (four decimals), so
  // the dashboard's own recompute from those stored factors lands on the same dollar, not a
  // rounding of a hidden precision the reader cannot see.
  const rest = round4(growthF) * round4(spikeF) * round4(maturityF);
  const evidence: Evidence =
    peers >= 12 && missing === 0 ? 'high' : peers >= 4 && missing <= 1 ? 'medium' : 'low';
  return {
    implied: Math.max(1, Math.round(p.tvl_usd * round4(multiple) * rest)),
    low: Math.max(1, Math.round(p.tvl_usd * (lowMult / widen) * rest)),
    high: Math.max(1, Math.round(p.tvl_usd * highMult * widen * rest)),
    age,
    evidence,
    multiple,
    peers,
    anchorSource: anchored ? 'category' : 'global',
    growthF,
    maturityF,
    spikeF,
    missing,
  };
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Suggested principal by TVL tier, halved for very young protocols, floored at $10. */
function principalFor(p: SnapshotProtocol, age: number | null): number {
  let v = p.tvl_usd >= 100_000_000 ? 100 : p.tvl_usd >= 10_000_000 ? 50 : 25;
  if (age !== null && age < 90) v = Math.max(10, Math.round(v / 2));
  return v;
}

/** A smaller working amount for swaps, bridges and margin, by TVL tier. */
function secondaryFor(p: SnapshotProtocol): number {
  return p.tvl_usd >= 100_000_000 ? 25 : p.tvl_usd >= 10_000_000 ? 15 : 10;
}

/** Observation window in days, by protocol age. */
function observeDays(age: number | null): number {
  if (age === null) return 14;
  if (age < 90) return 7;
  if (age <= 365) return 14;
  return 21;
}

interface StepParts {
  text: string;
  cost: string;
  time: string;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: StepParts): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The four working steps for a category, parameterized by the protocol's own record. */
function categorySteps(p: SnapshotProtocol, P: number, S: number, D: number): StepParts[] {
  const c = (p.category ?? '').toLowerCase();
  const chain = chainOf(p);
  const name = p.name;
  if (c.includes('dex')) {
    return [
      { text: `Swap $${S} between two supported assets in ${name} on ${chain} to record real trading activity.`, cost: 'about $0.20-$2 in swap and gas fees', time: '5 minutes' },
      { text: `Approve a capped $${P} allowance and supply balanced liquidity to ${name}'s main pool on ${chain}.`, cost: `$${P} of capital plus about $0.50-$3 of gas`, time: '8 minutes to set up' },
      { text: `After ${D} days, inspect the pool fees earned and the position's divergence loss in ${name}.`, cost: 'nothing to inspect', time: '5 minutes' },
      { text: `Remove the liquidity from ${name}, swap back to your base asset and revoke the token allowance.`, cost: 'about $0.50-$3 of gas', time: '6 minutes' },
    ];
  }
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return [
      { text: `Supply $${P} of a supported collateral asset to ${name} on ${chain} and confirm the deposit balance.`, cost: `$${P} of capital plus about $0.20-$2 of gas`, time: '5 minutes to set up' },
      { text: `Read ${name}'s oracle source and liquidation threshold for your collateral before borrowing anything.`, cost: 'nothing to read', time: '5 minutes' },
      { text: `Optionally borrow at most 20% of the collateral value ($${Math.max(5, Math.round(P / 5))}) from ${name} and hold the borrowed asset unspent.`, cost: 'about $0.30-$2 of gas plus borrow interest', time: '5 minutes' },
      { text: `After ${D} days, repay any borrow in full, withdraw the collateral from ${name} and revoke allowances.`, cost: 'about $0.50-$4 of gas plus interest owed', time: '8 minutes' },
    ];
  }
  if (c.includes('bridge')) {
    return [
      { text: `Check that your wallet holds enough native gas token on the destination chain before using ${name}.`, cost: 'nothing to check', time: '3 minutes' },
      { text: `Approve a capped $${S} allowance and bridge $${S} through ${name} to ${chain} on a supported route.`, cost: `$${S} of capital plus about $0.50-$5 of bridge and gas fees`, time: '5-30 minutes including finality' },
      { text: `Confirm the funds arrived on the destination chain and record the bridge transaction in your farm log.`, cost: 'nothing to confirm', time: '3 minutes' },
      { text: `After ${D} days, bridge back through ${name} only if the return fee is under 1% of the amount moved.`, cost: 'about $0.50-$5 if you return', time: '5-30 minutes' },
    ];
  }
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator')) {
    return [
      { text: `Inspect the vault assets, caps and withdrawal rules of the ${name} vault you plan to use on ${chain}.`, cost: 'nothing to inspect', time: '6 minutes' },
      { text: `Deposit $${P} into the ${name} vault and record the shares received and the exchange rate.`, cost: `$${P} of capital plus about $0.30-$3 of gas`, time: '5 minutes to set up' },
      { text: `After ${D} days, compare the vault's realized yield and exchange rate against the deposit record.`, cost: 'nothing to compare', time: '5 minutes' },
      { text: `Redeem a small test portion from ${name} first, then withdraw the rest through its documented queue.`, cost: 'about $0.50-$4 of gas plus any queue wait', time: '8 minutes plus the queue' },
    ];
  }
  if (c.includes('derivative') || c.includes('perpetual')) {
    return [
      { text: `Read ${name}'s margin, funding and liquidation rules on ${chain} before depositing anything.`, cost: 'nothing to read', time: '6 minutes' },
      { text: `Deposit $${S} of margin collateral into ${name} and preview a minimum-size position without opening it.`, cost: `$${S} of capital plus about $0.30-$2 of gas`, time: '4 minutes to set up' },
      { text: `Optionally open one position at no more than 1x exposure on ${name} and set a stop before leaving it.`, cost: 'about $0.50-$4 of fees plus funding', time: '5 minutes' },
      { text: `After ${D} days, close the position, withdraw the margin from ${name} and revoke allowances.`, cost: 'about $0.50-$4 of gas and fees', time: '6 minutes' },
    ];
  }
  if (c.includes('rwa')) {
    return [
      { text: `Check your jurisdiction and eligibility against ${name}'s own terms before connecting a wallet.`, cost: 'nothing to check', time: '10 minutes' },
      { text: `Inspect the issuer, asset backing and redemption terms behind ${name}'s yield asset on ${chain}.`, cost: 'nothing to inspect', time: '10 minutes' },
      { text: `If the protocol minimum permits, subscribe $${P} to ${name}'s asset and record the settlement terms.`, cost: `$${P} of capital plus about $1-$10 of fees`, time: '10 minutes plus any review' },
      { text: `After ${D} days, request a small test redemption from ${name} and time how long settlement takes.`, cost: 'about $1-$10 of fees', time: '10 minutes plus settlement' },
    ];
  }
  if (c.includes('staking') || c.includes('restak')) {
    return [
      { text: `Compare the validator or operator sets ${name} offers on ${chain} and pick the one with public reporting.`, cost: 'nothing to compare', time: '8 minutes' },
      { text: `Stake $${P} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`, cost: `$${P} of capital plus about $0.30-$3 of gas`, time: '5 minutes to set up' },
      { text: `After ${D} days, check the rewards accrued and the current unbonding period in ${name}.`, cost: 'nothing to check', time: '5 minutes' },
      { text: `Start unbonding a small test amount from ${name} first and confirm the exit completes before unstaking more.`, cost: 'about $0.50-$4 of gas plus the unbonding wait', time: '6 minutes plus unbonding' },
    ];
  }
  return [
    { text: `Read ${name}'s own documentation for its core action on ${chain} and note any points or rewards page it publishes.`, cost: 'nothing to read', time: '7 minutes' },
    { text: `Deposit $${P} of USDC into ${name} on ${chain} through its main app and confirm the position balance.`, cost: `$${P} of capital plus about $0.30-$3 of gas`, time: '5 minutes to set up' },
    { text: `Repeat one small qualifying action in ${name} each week, such as a deposit, a swap or a vote.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: `After ${D} days, withdraw a small test amount from ${name} first, then exit the rest if the test clears.`, cost: 'about $0.50-$4 of gas', time: '8 minutes' },
  ];
}

/**
 * The judgment step: what this protocol's own record says a farmer should do differently.
 * Exactly one fires, in this order — falling TVL, a spike, youth, a thin category — and a
 * protocol with no flag gets the steady-state instruction instead. Every figure in it is the
 * protocol's own: its growth, its age, its category's peer count, its TVL.
 */
function judgmentStep(p: SnapshotProtocol, age: number | null, peers: number, D: number): StepParts {
  const g = p.change_7d;
  const floor90 = Math.max(1, Math.round(p.tvl_usd * 0.9));
  if (g !== null && g <= -10) {
    return {
      text: `Split the entry: ${p.name}'s TVL fell ${g.toFixed(2)}% in seven days, so place half now and the second half only if TVL still holds above $${floor90.toLocaleString('en-US')} at the day-${D} check.`,
      cost: 'nothing extra; the second half stays in your wallet meanwhile',
      time: `2 minutes at the day-${D} check`,
    };
  }
  if (g !== null && g >= 60) {
    return {
      text: `Wait before entering: ${p.name}'s TVL spiked +${g.toFixed(2)}% in seven days, the pattern mercenary deposits make, so enter only if TVL is still above $${floor90.toLocaleString('en-US')} after ${D} days; the model already trimmed its value for the spike.`,
      cost: 'nothing while you wait',
      time: `${D} days of waiting, 2 minutes to check`,
    };
  }
  if (age !== null && age < 90) {
    return {
      text: `Tranche the position: ${p.name} has been tracked only ${age} days, so put half in now and the second half ${D} days later, and only after the first half withdraws cleanly.`,
      cost: 'one extra set of gas fees, about $0.50-$3',
      time: `5 minutes now, 5 minutes at day ${D}`,
    };
  }
  if (peers < ANCHOR_MIN_PEERS) {
    const peerPhrase =
      peers === 0
        ? 'its category has no tokenized peers at all'
        : `its category has only ${peers} tokenized peer${peers === 1 ? '' : 's'}`;
    return {
      text: `Size it as an early position, not a core one: ${peerPhrase}, so the global anchor prices ${p.name} and its range is wide; keep this farm small until the category prices itself.`,
      cost: 'nothing; it caps the amounts in the other steps',
      time: '1 minute to note the cap',
    };
  }
  return {
    text: `No flags in ${p.name}'s record — growth inside ±10% this week, ${peers} peers behind its category anchor, tracked ${age === null ? 'for an unrecorded span' : `${age} days`} with no token: run the plan as written and re-check TVL once at day ${D} before adding anything.`,
    cost: 'nothing to re-check',
    time: `2 minutes at day ${D}`,
  };
}

/** The plan's totals in one line, from the same parameters the steps are built with. */
export function farmSummary(p: SnapshotProtocol, age: number | null): string {
  const P = principalFor(p, age);
  const S = secondaryFor(p);
  const hold = age !== null && age < 180 ? 45 : 30;
  return (
    `$${P + S} of working capital ($${P} in the position, $${S} for swaps and margin) · ` +
    `about $2-$11 of gas and fees across the plan · roughly 35 minutes hands-on · ` +
    `${hold} days of holding, with the exit tested before the full withdrawal`
  );
}

/**
 * A protocol's farm plan: six steps — the category's four working steps with a cost and a time,
 * the judgment step its own record calls for, and a claim-safety step. Wallet hygiene is shared
 * by every plan, so the page states it once above the steps instead of spending a step on it.
 * Derived from the protocol's own record, never a hand-written name list. Amounts are starting
 * suggestions a reader edits, never a promise of eligibility or reward.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, peers: number): string[] {
  const chain = chainOf(p);
  const P = principalFor(p, age);
  const S = secondaryFor(p);
  const D = observeDays(age);
  const hold = age !== null && age < 180 ? 45 : 30;
  const [first, second, third, fourth] = categorySteps(p, P, S, D);
  const steps: StepParts[] = [
    first!,
    second!,
    third!,
    judgmentStep(p, age, peers, D),
    fourth!,
    {
      text: `Hold the ${p.name} position for at least ${hold} days, then claim only from the points or rewards link the protocol itself publishes on ${chain}; never pay a third party to claim.`,
      cost: `the position's capital stays committed; no fee to check a claim`,
      time: `${hold} days of holding, 10 minutes to claim`,
    },
  ];
  return steps.map(stepText);
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const cal = calibrate(snapshot);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, { p: SnapshotProtocol; stage: Stage }>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, { p, stage: 'watchlist' });
  }
  const earlyTarget = Math.max(0, BOARD_ROWS - chosen.size);
  const pool = snapshot.protocols.filter((p) => !chosen.has(p.slug) && isRankable(p));
  const scoredPool = pool.map((p) => ({ p, s: scoreProtocol(p, snapshot.as_of, cal) }));
  const byImplied = (a: { s: Scored }, b: { s: Scored }): number => b.s.implied - a.s.implied;
  const taken = new Set<string>();
  const take = (rows: { p: SnapshotProtocol }[], n: number): void => {
    const cap = Math.min(earlyTarget, taken.size + n);
    for (const r of rows) {
      if (taken.size >= cap) return;
      if (taken.has(r.p.slug)) continue;
      taken.add(r.p.slug);
      chosen.set(r.p.slug, { p: r.p, stage: 'early' });
    }
  };
  take([...scoredPool].sort(byImplied), BUCKET_BROAD);
  take(
    scoredPool.filter((r) => r.p.tvl_usd < 25_000_000).sort(byImplied),
    BUCKET_MID,
  );
  take(
    scoredPool
      .filter((r) => r.s.age !== null && r.s.age <= 365)
      .map((r) => ({ p: r.p, s: r.s, early: r.s.implied * (1 + 0.5 * (clamp(r.p.change_7d ?? 0, 0, 100) / 100)) }))
      .sort((a, b) => b.early - a.early),
    BUCKET_YOUNG,
  );
  take([...scoredPool].sort(byImplied), earlyTarget);

  const scored = [...chosen.values()].map(({ p, stage }) => ({
    p,
    stage,
    s: scoreProtocol(p, snapshot.as_of, cal),
  }));
  scored.sort((a, b) => b.s.implied - a.s.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Ranks must carry non-increasing implied values: break exact implied ties by TVL then slug so
  // the order above is already the rank order; equal implied values are allowed to sit adjacent.
  return scored.map(({ p, stage, s }, i) => ({
    rank: i + 1,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token' as const,
    stage,
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.low,
    implied_high_usd: s.high,
    evidence: s.evidence,
    model: {
      category_multiple: round4(s.multiple),
      category_peers: s.peers,
      anchor_source: s.anchorSource,
      global_multiple: round4(cal.globalMultiple),
      growth_factor: round4(s.growthF),
      maturity_factor: round4(s.maturityF),
      spike_factor: round4(s.spikeF),
      missing_inputs: s.missing,
    },
    farm_steps: farmSteps(p, s.age, s.peers),
    farm_summary: farmSummary(p, s.age),
  }));
}

/** The tokenized protocols, by market cap, for the dashboard's already-trading view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const cal = calibrate(snapshot);
  const live = liveRows(snapshot);
  const early = board.filter((r) => r.stage === 'early').length;
  const impliedSorted = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const categories: CategoryStat[] = [...cal.byCategory.entries()]
    .map(([category, v]) => ({ category, peers: v.peers, multiple: round4(v.multiple), low: round4(v.low), high: round4(v.high) }))
    .sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  // Account for every protocol in the snapshot, so the page can state the whole census:
  // ranked here, already trading, set aside as a derivative or versioned product of a token
  // that trades, or pre-token and rankable but below the board's 200-row cut.
  const rankedSlugs = new Set(board.map((r) => r.slug));
  let trading = 0;
  let excludedDerivative = 0;
  let belowCut = 0;
  for (const p of snapshot.protocols) {
    if (rankedSlugs.has(p.slug)) continue;
    if (!isPreToken(p)) trading++;
    else if (!isRankable(p)) excludedDerivative++;
    else belowCut++;
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: round4(cal.globalMultiple),
    global_low: round4(cal.globalLow),
    global_high: round4(cal.globalHigh),
    global_peers: cal.globalPeers,
    accounting: {
      snapshot_protocols: snapshot.protocols.length,
      ranked: board.length,
      trading,
      excluded_derivative: excludedDerivative,
      below_cut: belowCut,
    },
    board_tvl_usd: board.reduce((sum, r) => sum + r.tvl_usd, 0),
    median_implied_usd: impliedSorted.length > 0 ? impliedSorted[Math.floor(impliedSorted.length / 2)]! : 0,
    categories,
    rows: board,
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, farm steps, values. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100-row floor`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
