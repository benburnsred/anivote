/**
 * Anime X Angas Awards — Google Sheets backend and committee dashboard (2026 onwards).
 *
 * Bound to a private Google Sheet (Extensions → Apps Script) holding one edition. Two web app deployments of
 * this same script (see awards/README.md):
 *   Public   — Execute as: Me · Who has access: Anyone. Accepts ballots from the public ballot page.
 *   Committee — Execute as: User accessing · Who has access: Anyone with Google account. Open it with
 *               ?page=admin for the dashboard. Members must be in the Committee tab and have edit access to
 *               the Sheet.
 *
 * Tabs (created by setup()):
 *   Settings   — key | value                 (title, date, vote_open, reveal_winners, …)
 *   Categories — id | name | description | type | method | max_picks | opens | closes | order | locked
 *                locked: TRUE once published with nominees — nominees and voting method can't change until unlocked
 *                type: vote (public ballot) or special (committee picks the winner, not on the ballot)
 *                method: tier, single, multi or rank (see METHODS)
 *   Nominees   — id | category_id | name | subtitle | image | image_search | link | winner
 *   Votes      — Timestamp | Voter | Code | Category | Nominee | Value | Points. Lives in this spreadsheet, or in a
 *                separate one (votes_sheet_id setting). VotesMapping maps each field to a column header there, so an
 *                existing sheet with its own headers can be used as the datasource.
 *   VotesMapping — field | column   (timestamp, voter, code, category, nominee, value, points)
 *   Codes      — optional voter codes: Code | Category | Used By | Used At
 *   Committee  — email | name
 *   Log        — Timestamp | Email | Action | Details
 *   Site       — written by Publish: the public pages read this tab (published to the web as CSV)
 */

// Tier list points and caps (max nominees per tier, 0 = no limit). Must match TIERS in awards/vote/index.html.
const TIERS = {
  S: {points: 5, cap: 1},
  A: {points: 4, cap: 2},
  B: {points: 3, cap: 3},
  C: {points: 2, cap: 0},
  D: {points: 1, cap: 0}
};

// Voting methods a category can use. Points are always computed here, never trusted from the browser.
const METHODS = {
  tier: 'Tier list (S=5 … D=1 points)',
  single: 'Pick one',
  multi: 'Pick up to N',
  rank: 'Rank top N (1st = N points … Nth = 1)'
};

// true = anyone with the ballot link can fetch point totals (never names). Keep false until the ceremony.
const SHOW_RESULTS = false;

const TABS = {
  Settings: ['key', 'value'],
  Categories: ['id', 'name', 'description', 'type', 'method', 'max_picks', 'opens', 'closes', 'order', 'locked'],
  Nominees: ['id', 'category_id', 'name', 'subtitle', 'image', 'image_search', 'link', 'winner'],
  Votes: ['Timestamp', 'Voter', 'Code', 'Category', 'Nominee', 'Value', 'Points'],
  Codes: ['Code', 'Category', 'Used By', 'Used At'],
  VotesMapping: ['field', 'column'],
  Committee: ['email', 'name'],
  Log: ['Timestamp', 'Email', 'Action', 'Details']
};
const SITE_HEADERS = ['category', 'category_description', 'category_color', 'nominee', 'subtitle', 'image', 'image_search',
  'link', 'winner', 'result', 'image_style', 'category_image', 'category_id', 'nominee_id', 'category_type', 'method',
  'max_picks', 'opens', 'closes', 'locked'];
const VOTE_FIELDS = ['timestamp', 'voter', 'code', 'category', 'nominee', 'value', 'points'];
const DEFAULT_SETTINGS = [['title', 'Anime X Angas Awards 2026'], ['tagline', ''], ['date', ''], ['venue', ''],
  ['stream_url', ''], ['vote_url', '../vote/'], ['vote_open', 'TRUE'], ['reveal_winners', 'FALSE'], ['show_results', 'FALSE'],
  ['trophy_image', '../img/trophy.webp'], ['votes_sheet_id', ''], ['votes_tab', 'Votes'], ['facebook_url', 'https://www.facebook.com/AnimexAngas'],
  ['youtube_url', 'https://www.youtube.com/@AnimexAngas'], ['discord_url', 'https://discord.gg/AnimexAngas']];

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach(name => {
    if (name !== 'Votes' && !ss.getSheetByName(name)) {
      const sh = ss.insertSheet(name);
      sh.appendRow(TABS[name]);
      sh.setFrozenRows(1);
    }
  });
  const settings = ss.getSheetByName('Settings');
  if (settings.getLastRow() < 2) settings.getRange(2, 1, DEFAULT_SETTINGS.length, 2).setValues(DEFAULT_SETTINGS);
  const mapping = ss.getSheetByName('VotesMapping');
  if (mapping.getLastRow() < 2) mapping.getRange(2, 1, VOTE_FIELDS.length, 2).setValues(VOTE_FIELDS.map((f, i) => [f, TABS.Votes[i]]));
  const committee = ss.getSheetByName('Committee');
  const me = Session.getEffectiveUser().getEmail();
  if (committee.getLastRow() < 2 && me) committee.appendRow([me, 'Owner']);
  if (!ss.getSheetByName('Site')) ss.insertSheet('Site').appendRow(SITE_HEADERS);
}

/* ===== Sheet helpers ===== */

function sheet(name) {
  return SpreadsheetApp.getActive().getSheetByName(name);
}

function readTable(name) {
  const values = sheet(name).getDataRange().getValues();
  const head = values.shift().map(String);
  return values.filter(r => r.some(v => v !== '')).map(r => {
    const o = {};
    head.forEach((h, i) => o[h] = r[i] instanceof Date ? r[i].toISOString() : typeof r[i] === 'boolean' ? (r[i] ? 'TRUE' : 'FALSE') : String(r[i]));
    return o;
  });
}

function writeTable(name, headers, rows) {
  const sh = sheet(name);
  sh.clearContents();
  const data = [headers].concat(rows.map(o => headers.map(h => o[h] === undefined ? '' : cell(String(o[h])))));
  // Plain text, so Sheets doesn't turn "TRUE" into a checkbox or a date string into a date.
  sh.getRange(1, 1, Math.max(data.length, sh.getMaxRows()), headers.length).setNumberFormat('@');
  sh.getRange(1, 1, data.length, headers.length).setValues(data);
}

// Stops typed text such as "=IMPORTXML(...)" from being stored as a formula in the Sheet.
function cell(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function newId() {
  return Utilities.getUuid().slice(0, 8);
}

function settingsMap() {
  const out = {};
  readTable('Settings').forEach(r => { if (r.key) out[r.key] = r.value; });
  return out;
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Busy — please try again');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===== Votes datasource ===== */

// The votes tab, and which column header holds each field.
function votesSource() {
  const s = settingsMap();
  const ss = s.votes_sheet_id ? SpreadsheetApp.openById(s.votes_sheet_id.trim()) : SpreadsheetApp.getActive();
  const tab = (s.votes_tab || 'Votes').trim();
  let sh = ss.getSheetByName(tab);
  if (!sh) {
    sh = ss.insertSheet(tab);
    sh.appendRow(TABS.Votes);
    sh.setFrozenRows(1);
  }
  const map = {};
  VOTE_FIELDS.forEach((f, i) => map[f] = TABS.Votes[i]);
  readTable('VotesMapping').forEach(r => { if (r.field && r.column) map[r.field.trim().toLowerCase()] = r.column.trim(); });
  const head = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim()) : [];
  return {ss: ss, sheet: sh, map: map, head: head};
}

// Every vote row as {timestamp, voter, code, category, nominee, value, points}. Category and nominee may be stored as
// ids or names; names are resolved to ids. Without a points column, a tier letter (S…D) scores its tier points
// and anything else counts as 1 point.
function readVotes() {
  const src = votesSource();
  const idx = {};
  VOTE_FIELDS.forEach(f => idx[f] = src.head.indexOf(src.map[f]));
  const cats = readTable('Categories'), noms = readTable('Nominees');
  const values = src.sheet.getDataRange().getValues().slice(1);
  return values.filter(r => r.some(v => v !== '')).map(r => {
    const o = {};
    VOTE_FIELDS.forEach(f => {
      const v = idx[f] >= 0 ? r[idx[f]] : '';
      o[f] = v instanceof Date ? v.toISOString() : String(v).replace(/^'/, '').trim();
    });
    const c = cats.find(x => x.id === o.category || x.name.toLowerCase() === o.category.toLowerCase());
    if (c) o.category = c.id;
    const n = noms.find(x => x.category_id === o.category && (x.id === o.nominee || x.name.toLowerCase() === o.nominee.toLowerCase()));
    if (n) o.nominee = n.id;
    if (o.points === '') o.points = String(TIERS[o.value.toUpperCase()] ? TIERS[o.value.toUpperCase()].points : 1);
    return o;
  });
}

// A sheet with its own (re-mapped) category/nominee columns gets readable names; the built-in layout stores ids.
function appendVotes(list) {
  const src = votesSource();
  if (src.map.category !== 'Category' || src.map.nominee !== 'Nominee') {
    const cats = readTable('Categories'), noms = readTable('Nominees');
    list = list.map(o => Object.assign({}, o, {
      category: cell((cats.find(c => c.id === o.category) || {}).name || o.category),
      nominee: cell((noms.find(n => n.id === o.nominee) || {}).name || o.nominee)}));
  }
  const rows = list.map(o => src.head.map(h => {
    const f = VOTE_FIELDS.find(k => src.map[k] === h);
    return f ? o[f] : '';
  }));
  src.sheet.getRange(src.sheet.getLastRow() + 1, 1, rows.length, src.head.length).setValues(rows);
}

/* ===== Web app ===== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.page === 'admin') {
    return HtmlService.createHtmlOutputFromFile('Admin').setTitle('Awards Committee')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  if (p.action === 'results') {
    if (!SHOW_RESULTS) return json({ok: false, error: 'Results will be revealed at the awards'});
    return json({ok: true, results: tally(p.category)});
  }
  return json({ok: true});
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ok: false, error: 'Invalid request'});
  }
  if (!body || body.action !== 'vote') return json({ok: false, error: 'Invalid request'});
  try {
    return json(withLock(() => recordVote(body)));
  } catch (err) {
    console.error(err);
    return json({ok: false, error: err.message === 'Busy — please try again' ? err.message : 'Something went wrong — please try again'});
  }
}

/* ===== Public voting ===== */

function isOpen(c, now) {
  if (c.type === 'special') return false;
  if (c.opens && now < new Date(c.opens)) return false;
  if (c.closes && now > new Date(c.closes)) return false;
  return true;
}

function maxPicks(c, count) {
  const n = parseInt(c.max_picks, 10);
  return n > 0 ? Math.min(n, count) : Math.min(3, count);
}

// Returns [{nominee, value, points}] for a valid ballot, or throws with a message for the voter.
function scoreBallot(c, nomineeIds, placements) {
  const seen = {};
  for (const p of placements) {
    if (!p || nomineeIds.indexOf(p.nominee) < 0 || seen[p.nominee]) throw new Error('Invalid ballot');
    seen[p.nominee] = true;
  }
  const method = c.method || 'tier';
  if (method === 'tier') {
    const counts = {};
    return placements.map(p => {
      const t = TIERS[p.value];
      if (!t) throw new Error('Invalid ballot');
      counts[p.value] = (counts[p.value] || 0) + 1;
      if (t.cap && counts[p.value] > t.cap) throw new Error(p.value + ' tier allows only ' + t.cap);
      return {nominee: p.nominee, value: p.value, points: t.points};
    });
  }
  if (method === 'single') {
    if (placements.length !== 1) throw new Error('Pick exactly one nominee');
    return [{nominee: placements[0].nominee, value: 'pick', points: 1}];
  }
  const n = maxPicks(c, nomineeIds.length);
  if (placements.length > n) throw new Error('Pick at most ' + n);
  if (method === 'multi') return placements.map(p => ({nominee: p.nominee, value: 'pick', points: 1}));
  if (method === 'rank') return placements.map((p, i) => ({nominee: p.nominee, value: String(i + 1), points: n - i}));
  throw new Error('Invalid ballot');
}

function recordVote(b) {
  const voter = String(b.voter || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const code = String(b.code || '').trim().toUpperCase().slice(0, 20);
  const categoryId = String(b.category || '');
  const placements = Array.isArray(b.placements) ? b.placements.slice(0, 100) : [];
  if (!voter) return {ok: false, error: 'Please enter your name'};
  if (settingsMap().vote_open === 'FALSE') return {ok: false, error: 'Voting is closed'};
  const c = readTable('Categories').find(x => x.id === categoryId);
  if (!c) return {ok: false, error: 'Invalid ballot'};
  if (!isOpen(c, new Date())) return {ok: false, error: 'Voting for this award is closed'};
  if (!placements.length) return {ok: false, error: 'Empty ballot'};
  const nomineeIds = readTable('Nominees').filter(n => n.category_id === categoryId).map(n => n.id);
  let scored;
  try {
    scored = scoreBallot(c, nomineeIds, placements.map(p => ({nominee: String(p.nominee), value: String(p.tier || p.value || '')})));
  } catch (err) {
    return {ok: false, error: err.message};
  }

  // Voter codes: if the Codes sheet lists any, a valid unused code is required.
  const codeRows = sheet('Codes').getDataRange().getValues().slice(1);
  if (codeRows.length) {
    if (!codeRows.some(r => String(r[0]).toUpperCase() === code && !r[1])) return {ok: false, error: 'Unknown voter code'};
    if (codeRows.some(r => String(r[0]).toUpperCase() === code && r[1] === categoryId)) {
      return {ok: false, error: 'This code already voted in this category'};
    }
    sheet('Codes').appendRow([cell(code), categoryId, cell(voter), new Date()]);
  } else {
    const key = voter.toLowerCase();
    if (readVotes().some(v => v.voter.toLowerCase() === key && v.category === categoryId)) {
      return {ok: false, error: 'You already voted in this category'};
    }
  }
  const now = new Date();
  appendVotes(scored.map(s => ({timestamp: now, voter: cell(voter), code: cell(code), category: categoryId,
    nominee: s.nominee, value: s.value, points: s.points})));
  return {ok: true};
}

// {categoryId: {nomineeId: {points, voters, top}}} — top = first-place picks (S tier, rank 1 or a pick), for tie-breaks.
function tally(categoryId) {
  const out = {};
  readVotes().forEach(v => {
    if (categoryId && v.category !== categoryId) return;
    const c = out[v.category] = out[v.category] || {};
    const n = c[v.nominee] = c[v.nominee] || {points: 0, voters: 0, top: 0};
    n.points += Number(v.points) || 0;
    n.voters++;
    if (v.value === 'S' || v.value === '1' || v.value === 'pick') n.top++;
  });
  return categoryId ? (out[categoryId] || {}) : out;
}

/* ===== Committee dashboard (called from Admin.html with google.script.run) ===== */

function requireCommittee() {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const members = readTable('Committee').map(r => r.email.trim().toLowerCase());
  if (!email || members.indexOf(email) < 0) {
    throw new Error('Not on the committee list' + (email ? ' (' + email + ')' : ' — open the Committee deployment link, signed in to Google'));
  }
  return email;
}

function log(email, action, details) {
  sheet('Log').appendRow([new Date(), email, action, cell(String(details || '').slice(0, 500))]);
}

function adminState() {
  const email = requireCommittee();
  const categories = readTable('Categories').sort((a, b) => Number(a.order) - Number(b.order));
  const counts = {};
  let votes = [], votesInfo;
  try {
    const src = votesSource();
    votes = readVotes();
    votesInfo = {url: src.ss.getUrl(), name: src.ss.getName(), tab: src.sheet.getName(), rows: votes.length,
      missing: VOTE_FIELDS.filter(f => src.head.indexOf(src.map[f]) < 0)};
  } catch (err) {
    votesInfo = {error: 'Can\'t open the votes sheet: ' + err.message};
  }
  votes.forEach(v => {
    counts[v.category] = counts[v.category] || {};
    counts[v.category][v.voter.toLowerCase()] = true;
  });
  return {
    email: email,
    methods: METHODS,
    settings: settingsMap(),
    categories: categories.map(c => Object.assign(c, {ballots: Object.keys(counts[c.id] || {}).length})),
    nominees: readTable('Nominees'),
    results: votesInfo.error ? {} : tally(),
    votesInfo: votesInfo,
    log: readTable('Log').slice(-30).reverse()
  };
}

function adminSaveCategory(c) {
  const email = requireCommittee();
  return withLock(() => {
    const rows = readTable('Categories');
    const name = String(c.name || '').trim();
    if (!name) throw new Error('Category needs a name');
    const clean = {
      name: name,
      description: String(c.description || '').trim(),
      type: c.type === 'special' ? 'special' : 'vote',
      method: METHODS[c.method] ? c.method : 'tier',
      max_picks: String(parseInt(c.max_picks, 10) || ''),
      opens: String(c.opens || ''),
      closes: String(c.closes || '')
    };
    let row = rows.find(r => r.id === c.id);
    if (row && row.locked === 'TRUE' && (clean.method !== row.method || clean.max_picks !== row.max_picks || clean.type !== row.type)) {
      throw new Error('This category is locked: unlock it to change its type or voting method');
    }
    if (row) Object.assign(row, clean);
    else rows.push(row = Object.assign({id: newId(), order: String(rows.length + 1)}, clean));
    writeTable('Categories', TABS.Categories, rows);
    log(email, c.id ? 'edit category' : 'add category', name);
    return adminState();
  });
}

function adminDeleteCategory(id) {
  const email = requireCommittee();
  return withLock(() => {
    const rows = readTable('Categories');
    const c = rows.find(r => r.id === id);
    if (!c) throw new Error('Category not found');
    if (readVotes().some(v => v.category === id)) throw new Error('This category already has votes; it can\'t be deleted');
    writeTable('Categories', TABS.Categories, rows.filter(r => r.id !== id).map((r, i) => Object.assign(r, {order: String(i + 1)})));
    writeTable('Nominees', TABS.Nominees, readTable('Nominees').filter(n => n.category_id !== id));
    log(email, 'delete category', c.name);
    return adminState();
  });
}

function adminMoveCategory(id, dir) {
  const email = requireCommittee();
  return withLock(() => {
    const rows = readTable('Categories').sort((a, b) => Number(a.order) - Number(b.order));
    const i = rows.findIndex(r => r.id === id), j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= rows.length) return adminState();
    [rows[i], rows[j]] = [rows[j], rows[i]];
    writeTable('Categories', TABS.Categories, rows.map((r, k) => Object.assign(r, {order: String(k + 1)})));
    log(email, 'reorder categories', rows[j].name);
    return adminState();
  });
}

function adminSaveNominee(n) {
  const email = requireCommittee();
  return withLock(() => {
    const rows = readTable('Nominees');
    const name = String(n.name || '').trim();
    if (!name) throw new Error('Nominee needs a name');
    const cat = readTable('Categories').find(c => c.id === n.category_id);
    if (!cat) throw new Error('Category not found');
    if (cat.locked === 'TRUE') throw new Error('This category is locked: unlock it to change nominees');
    const clean = {name: name, subtitle: String(n.subtitle || '').trim(), image: String(n.image || '').trim(),
      image_search: String(n.image_search || '').trim(), link: String(n.link || '').trim()};
    let row = rows.find(r => r.id === n.id);
    if (row) Object.assign(row, clean);
    else rows.push(Object.assign({id: newId(), category_id: n.category_id, winner: ''}, clean));
    writeTable('Nominees', TABS.Nominees, rows);
    log(email, n.id ? 'edit nominee' : 'add nominee', name);
    return adminState();
  });
}

function adminDeleteNominee(id) {
  const email = requireCommittee();
  return withLock(() => {
    const rows = readTable('Nominees');
    const n = rows.find(r => r.id === id);
    if (!n) throw new Error('Nominee not found');
    if (readTable('Categories').some(c => c.id === n.category_id && c.locked === 'TRUE')) throw new Error('This category is locked: unlock it to change nominees');
    if (readVotes().some(v => v.nominee === id)) throw new Error('This nominee already has votes; it can\'t be deleted');
    writeTable('Nominees', TABS.Nominees, rows.filter(r => r.id !== id));
    log(email, 'delete nominee', n.name);
    return adminState();
  });
}

// Marks the given nominees as the category's winner(s); an empty list clears the winners.
function adminSetWinners(categoryId, nomineeIds) {
  const email = requireCommittee();
  return withLock(() => {
    const rows = readTable('Nominees');
    rows.forEach(r => { if (r.category_id === categoryId) r.winner = nomineeIds.indexOf(r.id) >= 0 ? 'TRUE' : ''; });
    writeTable('Nominees', TABS.Nominees, rows);
    log(email, 'set winners', categoryId + ': ' + rows.filter(r => r.winner && r.category_id === categoryId).map(r => r.name).join(', '));
    return adminState();
  });
}

function adminSaveSettings(values) {
  const email = requireCommittee();
  return withLock(() => {
    const current = settingsMap();
    Object.keys(values).forEach(k => { if (/^[a-z_]+$/.test(k)) current[k] = String(values[k]); });
    writeTable('Settings', TABS.Settings, Object.keys(current).map(k => ({key: k, value: current[k]})));
    log(email, 'edit settings', Object.keys(values).join(', '));
    return adminState();
  });
}

// Copies categories and nominees into the Site tab, which the public awards page and ballot read.
function adminPublish() {
  const email = requireCommittee();
  return withLock(() => {
    const cats = readTable('Categories').sort((a, b) => Number(a.order) - Number(b.order));
    const noms = readTable('Nominees');
    const rows = [];
    cats.forEach(c => {
      const base = {category: c.name, category_description: c.description, category_id: c.id, category_type: c.type,
        method: c.method, max_picks: c.max_picks, opens: c.opens, closes: c.closes};
      const list = noms.filter(n => n.category_id === c.id);
      if (!list.length) rows.push(base);
      list.forEach(n => rows.push(Object.assign({}, base, {nominee: n.name, subtitle: n.subtitle, image: n.image,
        image_search: n.image_search, link: n.link, winner: n.winner, nominee_id: n.id})));
    });
    // Lock public-vote categories that now have published nominees, so the ballot can't change mid-vote.
    const locked = [];
    cats.forEach(c => {
      if (c.type !== 'special' && c.locked !== 'TRUE' && noms.some(n => n.category_id === c.id)) { c.locked = 'TRUE'; locked.push(c.name); }
    });
    if (locked.length) writeTable('Categories', TABS.Categories, cats);
    rows.forEach(r => { const c = cats.find(x => x.id === r.category_id); r.locked = c ? c.locked : ''; });
    writeTable('Site', SITE_HEADERS, rows);
    log(email, 'publish', rows.length + ' rows' + (locked.length ? '; locked ' + locked.join(', ') : ''));
    return adminState();
  });
}

function adminUnlockCategory(id) {
  const email = requireCommittee();
  return withLock(() => {
    const rows = readTable('Categories');
    const c = rows.find(r => r.id === id);
    if (!c) throw new Error('Category not found');
    c.locked = '';
    writeTable('Categories', TABS.Categories, rows);
    log(email, 'unlock category', c.name);
    return adminState();
  });
}
