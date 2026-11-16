# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/anjay898/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/anjay898/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

FIELDNOTES Token Radar: a token launch radar that reads the sealed DefiLlama snapshot, ranks 198 pre-token protocols (all 40 watchlist protocols at or above the $50M TVL floor plus 158 early discoveries the watchlist does not name) by an implied launch value learned from the snapshot itself. Model radar-3 prices each protocol with four factors — its TVL, a category anchor (the median market-cap/TVL of its tokenized peers, log-shrunk toward the global median; a category with fewer than four peers is priced at the global median exactly), seven-day momentum with a haircut for unsustainable spikes, and a log maturity curve for time run with no token — and reports what the record does not carry as a wider peer range and a lower evidence grade, never as a discounted value. The static, no-network dashboard accounts for every protocol in the snapshot (ranked, already trading, set aside as a wrapped/staked/versioned product, or below the cut), and offers a sortable and filterable board, a per-protocol detail drawer showing the model's full arithmetic and peer dispersion range, a what-if growth slider, and a concrete six-step farm plan per protocol whose steps carry costs and times, whose totals are stated up front, and one of whose steps is the judgment the protocol's own record calls for. Tokenized protocols are never ranked: they calibrate the model and are shown apart with the market's own values.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=xwewnr0f&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
