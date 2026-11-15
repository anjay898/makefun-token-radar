# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/anjay898/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/anjay898/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

FIELDNOTES Token Radar: a token launch radar that reads the sealed DefiLlama snapshot, ranks 198 pre-token protocols (all 40 watchlist protocols at or above the $50M TVL floor plus 158 early discoveries below it) by an implied launch value learned from the snapshot itself — each category's anchor is the median market-cap/TVL of its tokenized peers, log-shrunk toward the global median, then adjusted for 7-day growth, maturity, chain breadth, data coverage and unsustainable spikes — and renders a static, no-network dashboard with a sortable and filterable board, a per-protocol detail drawer showing the model's full arithmetic and a peer dispersion range, a what-if growth slider, and a concrete six-step farm plan per protocol with costs and times. Tokenized protocols are never ranked: they calibrate the model and are shown apart with the market's own values.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=xwewnr0f&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
