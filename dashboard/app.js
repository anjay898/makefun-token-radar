// FIELDNOTES Token Radar. Reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, filters, a per-protocol detail drawer with the model's own arithmetic and the
// protocol's farm plan, and the already-trading view the calibration learned from. No network:
// every byte it shows is in data.js, and the page recomputes each implied value from the row's own
// factors so what the reader sees is the model's arithmetic, not a pasted number.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');

  var state = { q: '', category: 'all', stage: 'all', chain: 'all', tier: 'all', tab: 'board', sort: 'implied', dir: -1, page: 0, selected: null };
  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv.length !== 2) return;
      var k = decodeURIComponent(kv[0]);
      var v = decodeURIComponent(kv[1]);
      if (k === 'detail') state.selected = v;
      else if (k === 'cat') state.category = v;
      else if (k === 'stage') state.stage = v;
      else if (k === 'chain') state.chain = v;
      else if (k === 'tier') state.tier = v;
      else if (k === 'q') state.q = v;
      else if (k === 'tab') state.tab = v;
    });
  }
  readHash();

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return n.toFixed(2) + 'x'; }

  // The model in one function: the same arithmetic lib/model.ts runs, recomputed in the page from
  // the row's snapshot figures and its calibrated category multiple.
  function impliedWith(row, growthPct) {
    var g = growthPct === null || growthPct === undefined ? 0 : Math.min(120, Math.max(-60, growthPct));
    var growthF = Math.exp(0.3 * Math.log1p(g / 100));
    var spikeF = 1 - 0.15 * Math.min(1, Math.max(0, (g - 60) / 120));
    var m = row.model;
    return Math.max(1, Math.round(row.tvl_usd * m.category_multiple * growthF * m.maturity_factor * m.breadth_factor * m.data_factor * spikeF));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  var TIERS = [
    { id: 'all', label: 'Any TVL', test: function () { return true; } },
    { id: 'mega', label: 'TVL $100M+', test: function (r) { return r.tvl_usd >= 100000000; } },
    { id: 'mid', label: 'TVL $10M-$100M', test: function (r) { return r.tvl_usd >= 10000000 && r.tvl_usd < 100000000; } },
    { id: 'small', label: 'TVL under $10M', test: function (r) { return r.tvl_usd < 10000000; } },
  ];
  function tierOf(id) { for (var i = 0; i < TIERS.length; i++) if (TIERS[i].id === id) return TIERS[i]; return TIERS[0]; }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var tier = tierOf(state.tier);
    return DATA.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorized') !== state.category) return false;
      if (state.stage !== 'all' && r.stage !== state.stage) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (!tier.test(r)) return false;
      return true;
    });
  }
  var SORTS = {
    implied: function (r) { return r.implied_value_usd; },
    tvl: function (r) { return r.tvl_usd; },
    growth: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
    multiple: function (r) { return r.model.category_multiple; },
    age: function (r) { return r.age_days === null ? -1 : r.age_days; },
    rank: function (r) { return -r.rank; },
  };
  function sorted(rows) {
    var f = SORTS[state.sort] || SORTS.implied;
    return rows.slice().sort(function (a, b) {
      var d = (f(a) - f(b)) * state.dir;
      return d !== 0 ? d : a.rank - b.rank;
    });
  }

  function categoryList() {
    var seen = {};
    DATA.rows.forEach(function (r) { seen[r.category || 'Uncategorized'] = true; });
    return Object.keys(seen).sort();
  }
  function chainList() {
    var seen = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { seen[c] = true; }); });
    return Object.keys(seen).sort();
  }

  function render() {
    app.textContent = '';
    app.removeAttribute('aria-busy');
    var shell = el('div', { 'class': 'shell' });

    shell.appendChild(el('div', { 'class': 'masthead' },
      el('div', { 'class': 'brand', text: 'FIELDNOTES ' },
        el('em', { text: '/ TOKEN RADAR' })),
      el('div', { 'class': 'mast-note', text: 'Offline snapshot · DefiLlama protocols as of ' + DATA.as_of + ' · model ' + DATA.model_version })));

    shell.appendChild(el('h1', { 'class': 'title', text: 'Before the token.' }));
    shell.appendChild(el('p', { 'class': 'subtitle' },
      'Protocols that record no token yet, ranked by what a launch would be worth if their record stayed as it is. ',
      el('strong', { text: DATA.watchlist_size + ' watchlist candidates' }),
      ' at or above the ' + fmtUsd(DATA.floor_usd) + ' floor, plus ',
      el('strong', { text: DATA.early_size + ' early discoveries' }),
      ' below it. Wrapped, staked, bridged and versioned products of tokens that already trade are excluded; tokenized protocols are never ranked — they calibrate the model and sit under Already trading.'));

    var cards = el('div', { 'class': 'cards' });
    cards.appendChild(card('Board TVL', fmtUsd(DATA.board_tvl_usd), DATA.board_size + ' pre-token protocols ranked'));
    cards.appendChild(card('Median implied value', fmtUsd(DATA.median_implied_usd), 'the middle of the board, model ' + DATA.model_version));
    cards.appendChild(card('Global peer multiple', fmtMult(DATA.global_multiple), 'median market cap / TVL across ' + DATA.global_peers + ' tokenized peers'));
    cards.appendChild(card('Snapshot', DATA.as_of, 'sealed input; every run reads the same bytes'));
    shell.appendChild(cards);

    var method = el('div', { 'class': 'method' });
    method.appendChild(el('div', { 'class': 'formula', text: 'Implied value = TVL x Category anchor x Growth x Maturity x Chain breadth x Data coverage x Spike adjustment' }));
    method.appendChild(el('p', {},
      el('strong', { text: 'Category anchor: ' }),
      'the median market-cap/TVL of tokenized protocols in the same category, log-shrunk toward the global median (' + fmtMult(DATA.global_multiple) + ') with weight peers/(peers+12) and clamped to 0.03x-8x — learned from this snapshot, never a fixed 0.25x and never a list of names. ',
      el('strong', { text: 'Growth ' }),
      'rewards 7-day TVL momentum through exp(0.30 x log1p(g/100)), g clamped to -60%/+120%. ',
      el('strong', { text: 'Maturity ' }),
      'pays up to +25% for two years tracked with no token. ',
      el('strong', { text: 'Spike adjustment ' }),
      'takes back up to 15% when weekly growth passes +60%, and ',
      el('strong', { text: 'Data coverage ' }),
      'discounts 5% per missing input. Implied value is a circulating-cap proxy: it excludes supply, dilution and token rights, and predicts neither a launch nor an airdrop.'));
    shell.appendChild(method);

    var tabs = el('div', { 'class': 'tabs' });
    tabs.appendChild(el('button', { 'class': 'tab', 'aria-selected': state.tab === 'board' ? 'true' : 'false', onclick: function () { state.tab = 'board'; state.page = 0; render(); }, text: 'Pre-token board (' + DATA.board_size + ')' }));
    tabs.appendChild(el('button', { 'class': 'tab', 'aria-selected': state.tab === 'live' ? 'true' : 'false', onclick: function () { state.tab = 'live'; render(); }, text: 'Already trading (' + DATA.live_size + ' shown)' }));
    shell.appendChild(tabs);

    if (state.tab === 'live') shell.appendChild(liveView());
    else shell.appendChild(boardView());

    var rail = el('div', { 'class': 'rail' });
    rail.appendChild(calibrationPanel());
    rail.appendChild(limitsPanel());
    shell.appendChild(rail);

    shell.appendChild(el('p', { 'class': 'foot', text: 'Source: ' + DATA.source + '. A protocol here records no token in DefiLlama\'s record; that is not proof it has none. Farm steps are starting plans with suggested amounts a reader edits — not eligibility promises.' }));
    app.appendChild(shell);

    if (state.selected) {
      var row = null;
      DATA.rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
      if (row) app.appendChild(drawer(row));
    }
  }

  function card(k, v, s) {
    return el('div', { 'class': 'card' },
      el('div', { 'class': 'k', text: k }),
      el('div', { 'class': 'v', text: v }),
      el('div', { 'class': 's', text: s }));
  }

  function boardView() {
    var wrap = el('div', {});
    var bar = el('div', { 'class': 'toolbar' });
    var search = el('input', { type: 'search', placeholder: 'Search name or slug', value: state.q, 'aria-label': 'Search protocols' });
    search.addEventListener('input', function () { state.q = search.value; state.page = 0; refreshTable(wrap); });
    bar.appendChild(search);
    bar.appendChild(selectOf('Category', categoryList(), state.category, function (v) { state.category = v; }));
    bar.appendChild(selectOf('Stage', ['watchlist', 'early'], state.stage, function (v) { state.stage = v; }, { watchlist: 'Watchlist', early: 'Early' }));
    bar.appendChild(selectOf('Chain', chainList(), state.chain, function (v) { state.chain = v; }));
    bar.appendChild(selectOf('TVL tier', TIERS.map(function (t) { return t.id; }), state.tier, function (v) { state.tier = v; }, tierLabels()));
    bar.appendChild(el('button', { 'class': 'clear', onclick: function () { state.q = ''; state.category = 'all'; state.stage = 'all'; state.chain = 'all'; state.tier = 'all'; state.page = 0; render(); }, text: 'Clear filters' }));
    wrap.appendChild(bar);
    var holder = el('div', { 'class': 'tableholder' });
    wrap.appendChild(holder);
    refreshTable(wrap, holder);
    return wrap;
  }
  function tierLabels() { var m = {}; TIERS.forEach(function (t) { m[t.id] = t.label; }); return m; }

  function selectOf(label, values, current, onChange, labels) {
    var sel = el('select', { 'aria-label': label });
    sel.appendChild(el('option', { value: 'all', text: label + ': all' }));
    values.forEach(function (v) {
      var o = el('option', { value: v, text: (labels && labels[v]) || v });
      if (v === current) o.setAttribute('selected', 'selected');
      sel.appendChild(o);
    });
    if (current === 'all') sel.value = 'all';
    sel.addEventListener('change', function () { onChange(sel.value); state.page = 0; render(); });
    return sel;
  }

  function refreshTable(wrap, holder) {
    holder = holder || wrap.querySelector('.tableholder');
    if (!holder) return;
    holder.textContent = '';
    var rows = sorted(filtered());
    var per = 25;
    var pages = Math.max(1, Math.ceil(rows.length / per));
    if (state.page >= pages) state.page = pages - 1;
    var pageRows = rows.slice(state.page * per, state.page * per + per);

    var bits = [rows.length + ' of ' + DATA.board_size];
    if (state.category !== 'all') bits.push(state.category);
    if (state.stage !== 'all') bits.push(state.stage === 'watchlist' ? 'Watchlist' : 'Early');
    if (state.chain !== 'all') bits.push(state.chain);
    if (state.tier !== 'all') bits.push(tierOf(state.tier).label);
    if (state.q.trim()) bits.push('"' + state.q.trim() + '"');
    holder.appendChild(el('div', { 'class': 'countline' }, el('strong', { text: bits.join(' · ') }), ' — click a row for its detail and farm plan.'));

    var table = el('table', {});
    var head = el('tr', {});
    head.appendChild(thSort('Rank', 'rank', true));
    head.appendChild(el('th', { text: 'Protocol' }));
    head.appendChild(el('th', { text: 'Stage' }));
    head.appendChild(el('th', { text: 'Category' }));
    head.appendChild(thSort('TVL', 'tvl', true));
    head.appendChild(thSort('7d TVL', 'growth', true));
    head.appendChild(thSort('Peer multiple', 'multiple', true));
    head.appendChild(thSort('Implied value', 'implied', true));
    head.appendChild(el('th', { text: 'Evidence' }));
    head.appendChild(el('th', { 'class': 'num', text: 'Chains' }));
    head.appendChild(thSort('Age', 'age', true));
    table.appendChild(el('thead', {}, head));
    var body = el('tbody', {});
    pageRows.forEach(function (r) {
      var tr = el('tr', { 'class': state.selected === r.slug ? 'selected' : '', onclick: function () { state.selected = r.slug; render(); } });
      tr.appendChild(el('td', { 'class': 'num', text: '#' + r.rank }));
      tr.appendChild(el('td', {}, el('div', { 'class': 'pname', text: r.name }), el('div', { 'class': 'pslug', text: r.slug })));
      tr.appendChild(el('td', {}, el('span', { 'class': 'badge' + (r.stage === 'early' ? ' early' : ''), text: r.stage })));
      tr.appendChild(el('td', { text: r.category || 'Uncategorized' }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }));
      var pct = el('td', { 'class': 'num', text: fmtPct(r.change_7d) });
      if (r.change_7d !== null) pct.className += r.change_7d >= 0 ? ' pos' : ' neg';
      tr.appendChild(pct);
      tr.appendChild(el('td', { 'class': 'num', text: fmtMult(r.model.category_multiple) }));
      tr.appendChild(el('td', { 'class': 'num implied', text: fmtUsd(r.implied_value_usd) }));
      tr.appendChild(el('td', {}, el('span', { 'class': 'ev ' + r.evidence, text: r.evidence + ' · ' + r.model.category_peers + ' peers' })));
      tr.appendChild(el('td', { 'class': 'num', text: String(r.chains.length) }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtAge(r.age_days) }));
      body.appendChild(tr);
    });
    table.appendChild(body);
    holder.appendChild(table);

    var pager = el('div', { 'class': 'pager' });
    var prev = el('button', { text: 'Previous', onclick: function () { if (state.page > 0) { state.page--; render(); } } });
    if (state.page === 0) prev.setAttribute('disabled', 'disabled');
    var next = el('button', { text: 'Next', onclick: function () { if (state.page < pages - 1) { state.page++; render(); } } });
    if (state.page >= pages - 1) next.setAttribute('disabled', 'disabled');
    pager.appendChild(prev);
    pager.appendChild(next);
    pager.appendChild(el('span', { 'class': 'info', text: 'Page ' + (state.page + 1) + ' of ' + pages + ' · sorted by ' + state.sort + (state.dir < 0 ? ' descending' : ' ascending') }));
    holder.appendChild(pager);
  }

  function thSort(label, key, numeric) {
    var th = el('th', { 'class': numeric ? 'num' : '' });
    var arrow = state.sort === key ? (state.dir < 0 ? ' ↓' : ' ↑') : '';
    th.appendChild(el('button', { text: label + arrow, onclick: function () {
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = key === 'rank' ? 1 : -1; }
      state.page = 0;
      render();
    } }));
    return th;
  }

  function liveView() {
    var wrap = el('div', {});
    wrap.appendChild(el('div', { 'class': 'countline' }, el('strong', { text: DATA.live_size + ' tokenized protocols' }), ' — these already trade, so the board shows the market\'s own cap, never a model value. Their cap/TVL ratios are the calibration peers.'));
    var table = el('table', {});
    var head = el('tr', {});
    ['Protocol', 'Category', 'TVL', 'Market cap', 'Cap / TVL', '7d TVL', 'Chains'].forEach(function (t, i) {
      head.appendChild(el('th', { 'class': i >= 2 ? 'num' : '', text: t }));
    });
    table.appendChild(el('thead', {}, head));
    var body = el('tbody', {});
    DATA.live.forEach(function (r) {
      var tr = el('tr', {});
      tr.appendChild(el('td', {}, el('div', { 'class': 'pname', text: r.name }), el('div', { 'class': 'pslug', text: r.slug })));
      tr.appendChild(el('td', { text: r.category || 'Uncategorized' }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(r.mcap_usd) }));
      tr.appendChild(el('td', { 'class': 'num', text: r.ratio === null ? 'n/a' : fmtMult(r.ratio) }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtPct(r.change_7d) }));
      tr.appendChild(el('td', { 'class': 'num', text: String(r.chains.length) }));
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    return wrap;
  }

  function calibrationPanel() {
    var panel = el('div', { 'class': 'panel' });
    panel.appendChild(el('h3', { text: 'Category anchors from this snapshot' }));
    var table = el('table', {});
    var head = el('tr', {});
    head.appendChild(el('th', { text: 'Category' }));
    head.appendChild(el('th', { 'class': 'num', text: 'Tokenized peers' }));
    head.appendChild(el('th', { 'class': 'num', text: 'Anchor multiple' }));
    table.appendChild(el('thead', {}, head));
    var body = el('tbody', {});
    DATA.categories.slice(0, 10).forEach(function (c) {
      var tr = el('tr', {});
      tr.appendChild(el('td', { text: c.category }));
      tr.appendChild(el('td', { 'class': 'num', text: String(c.peers) }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtMult(c.multiple) }));
      body.appendChild(tr);
    });
    table.appendChild(body);
    panel.appendChild(table);
    panel.appendChild(el('p', { 'class': 'note', text: 'Thin categories shrink toward the global median ' + fmtMult(DATA.global_multiple) + ', so two expensive outliers cannot set a category\'s price.' }));
    return panel;
  }

  function limitsPanel() {
    var panel = el('div', { 'class': 'panel' });
    panel.appendChild(el('h3', { text: 'What this radar does not claim' }));
    var ul = el('ul', {});
    [
      'Implied value is the entry\'s own model claim about a hypothetical launch — not a prediction that a token will be issued, or when.',
      'Evidence grades the inputs (peer count, missing fields), never the chance of an airdrop.',
      'Protocols below the $50M floor and outside the watchlist can outrank watchlist rows when the model prices them higher; the watchlist is a floor, never a ceiling.',
      'Farm amounts are editable starting suggestions. Gas figures are low-fee-chain estimates, not quotes.',
    ].forEach(function (t) { ul.appendChild(el('li', { text: t })); });
    panel.appendChild(ul);
    return panel;
  }

  function drawer(row) {
    var frag = el('div', {});
    frag.appendChild(el('div', { 'class': 'scrim', onclick: function () { state.selected = null; render(); } }));
    var d = el('aside', { 'class': 'drawer', 'aria-label': 'Protocol detail' });
    d.appendChild(el('button', { 'class': 'close', text: 'Close', onclick: function () { state.selected = null; render(); } }));
    d.appendChild(el('h2', { text: row.name }));
    d.appendChild(el('div', { 'class': 'meta', text: row.slug + ' · rank #' + row.rank + ' · ' + (row.category || 'Uncategorized') + ' · tracked since ' + (row.listed_at || 'unknown') }));
    var head = el('div', { 'class': 'headline' });
    head.appendChild(el('div', {}, el('div', { 'class': 'k', text: 'IMPLIED VALUE' }), el('div', { 'class': 'big', text: fmtUsd(row.implied_value_usd) })));
    head.appendChild(el('div', { 'class': 'range', text: 'peer dispersion range ' + fmtUsd(row.implied_low_usd) + ' – ' + fmtUsd(row.implied_high_usd) + ' · evidence ' + row.evidence }));
    d.appendChild(head);

    var facts = el('table', {});
    var fb = el('tbody', {});
    [
      ['Stage', row.stage === 'watchlist' ? 'Watchlist (TVL at or above the ' + fmtUsd(DATA.floor_usd) + ' floor)' : 'Early (below the floor, found by the radar)'],
      ['TVL', fmtUsd(row.tvl_usd)],
      ['7-day TVL change', fmtPct(row.change_7d)],
      ['Age with no token recorded', fmtAge(row.age_days) + (row.age_days !== null ? ' (' + row.age_days + ' days)' : '')],
      ['Chains', row.chains.length ? row.chains.join(', ') : 'none recorded'],
      ['Token status', 'records no token in this snapshot (no market cap, no CoinGecko id, no symbol)'],
    ].forEach(function (pair) {
      var tr = el('tr', {});
      tr.appendChild(el('th', { text: pair[0] }));
      tr.appendChild(el('td', { text: pair[1] }));
      fb.appendChild(tr);
    });
    facts.appendChild(fb);
    d.appendChild(facts);

    d.appendChild(el('h3', { text: 'How the model prices it' }));
    var wf = el('table', {});
    var wb = el('tbody', {});
    var m = row.model;
    [
      ['TVL (snapshot)', fmtUsd(row.tvl_usd)],
      ['x Category anchor (' + (row.category || 'global') + ', ' + m.category_peers + ' peers, global ' + fmtMult(m.global_multiple) + ')', fmtMult(m.category_multiple)],
      ['x Growth (7d ' + fmtPct(row.change_7d) + ')', fmtMult(m.growth_factor)],
      ['x Maturity (' + fmtAge(row.age_days) + ' with no token)', fmtMult(m.maturity_factor)],
      ['x Chain breadth (' + row.chains.length + ' chains)', fmtMult(m.breadth_factor)],
      ['x Data coverage', fmtMult(m.data_factor)],
      ['x Spike adjustment', fmtMult(m.spike_factor)],
      ['= Implied value (page recomputes ' + fmtUsd(impliedWith(row, row.change_7d)) + ')', fmtUsd(row.implied_value_usd)],
    ].forEach(function (pair) {
      var tr = el('tr', {});
      tr.appendChild(el('td', { text: pair[0] }));
      tr.appendChild(el('td', { 'class': 'num', text: pair[1] }));
      wb.appendChild(tr);
    });
    wf.appendChild(wb);
    d.appendChild(wf);

    var wi = el('div', { 'class': 'whatif' });
    wi.appendChild(el('label', { text: 'What-if: 7-day TVL growth', 'for': 'growthRange' }));
    var slider = el('input', { type: 'range', id: 'growthRange', min: '-60', max: '120', step: '1', value: String(row.change_7d === null ? 0 : Math.round(row.change_7d)) });
    var out = el('div', {}, 'At ', el('span', { 'class': 'out', text: fmtPct(row.change_7d) }), ' growth the implied value is ', el('span', { 'class': 'out', text: fmtUsd(row.implied_value_usd) }), '. Drag to test the model — the board itself never changes.');
    slider.addEventListener('input', function () {
      var g = Number(slider.value);
      out.textContent = '';
      out.appendChild(document.createTextNode('At '));
      out.appendChild(el('span', { 'class': 'out', text: (g > 0 ? '+' : '') + g + '%' }));
      out.appendChild(document.createTextNode(' growth the implied value would be '));
      out.appendChild(el('span', { 'class': 'out', text: fmtUsd(impliedWith(row, g)) }));
      out.appendChild(document.createTextNode(' — growth and spike factors recomputed, everything else held.'));
    });
    wi.appendChild(slider);
    wi.appendChild(out);
    d.appendChild(wi);

    d.appendChild(el('h3', { text: 'Farm plan' }));
    var ol = el('ol', { 'class': 'farm' });
    row.farm_steps.forEach(function (s) { ol.appendChild(el('li', { text: s })); });
    d.appendChild(ol);
    d.appendChild(el('p', { 'class': 'note', text: 'Amounts scale with this protocol\'s TVL tier and age in the generator (lib/model.ts farmSteps). No step promises points, eligibility or a reward.' }));

    frag.appendChild(d);
    return frag;
  }

  render();
  app.setAttribute('aria-busy', 'false');
})();
