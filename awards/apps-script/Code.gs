/**
 * Anime X Angas Awards — Google Sheets backend.
 *
 * Bound to a private Google Sheet (Extensions → Apps Script). Deploy as a web app:
 *   Execute as: Me · Who has access: Anyone
 * then paste the /exec URL into APPS_SCRIPT_URL in awards/vote/index.html.
 *
 * The web app only accepts ballots. It never returns sheet contents, voter names or your account
 * details, and the Sheet itself stays private to you. Read results in the Results tab.
 *
 * Tabs (created by setup()):
 *   Votes   — one row per voter per nominee: Timestamp | Voter | Code | Category | Nominee | Tier | Points
 *   Results — live leaderboard formula over Votes (only you can see it)
 *   Codes   — optional voter codes: Code | Category | Used By | Used At
 *             Add codes in column A with the other columns blank; a row is appended each time a code
 *             votes in a category. Leave empty for name-only voting (one ballot per name per category).
 */

// Must match TIERS in awards/vote/index.html. Points are always computed here, never trusted from the browser.
const TIERS = {
  S: {points: 5, cap: 1},
  A: {points: 4, cap: 2},
  B: {points: 3, cap: 3},
  C: {points: 2, cap: 0},
  D: {points: 1, cap: 0}
};

// The same nominees file the ballot reads (NOMINEES_CSV in awards/vote/index.html). Ballots naming any
// category or nominee not in it are rejected, so updating that file is all it takes to open a new category.
const NOMINEES_URL = 'https://benburnsred.github.io/anivote/awards/2026/data/nominees.csv';

// true = anyone with the page link can fetch the point totals (never names). Keep false until awards night.
const SHOW_RESULTS = false;

const VOTES = 'Votes';
const CODES = 'Codes';
const RESULTS = 'Results';

function setup() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(VOTES)) {
    ss.insertSheet(VOTES).appendRow(['Timestamp', 'Voter', 'Code', 'Category', 'Nominee', 'Tier', 'Points']);
  }
  if (!ss.getSheetByName(CODES)) {
    ss.insertSheet(CODES).appendRow(['Code', 'Category', 'Used By', 'Used At']);
  }
  if (!ss.getSheetByName(RESULTS)) {
    ss.insertSheet(RESULTS).getRange('A1').setFormula(
      '=QUERY(' + VOTES + '!A:G,"select D, E, sum(G), count(G) where D is not null group by D, E ' +
      'order by D, sum(G) desc label D \'Category\', E \'Nominee\', sum(G) \'Points\', count(G) \'Voters\'",1)');
  }
}

// Must match slug() in awards/vote/index.html.
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// {categoryId: {nomineeId: nomineeName}}, cached for 10 minutes; the last good copy is kept in case the fetch fails.
function nominees() {
  const cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  const hit = cache.get('nominees');
  if (hit) return JSON.parse(hit);
  try {
    const rows = Utilities.parseCsv(UrlFetchApp.fetch(NOMINEES_URL).getContentText());
    const head = rows.shift().map(h => h.trim().toLowerCase());
    const ci = head.indexOf('category'), ni = head.indexOf('nominee');
    const out = {};
    rows.forEach(r => {
      if (!r[ci] || !r[ni]) return;
      (out[slug(r[ci])] = out[slug(r[ci])] || {})[slug(r[ni])] = r[ni].trim();
    });
    const text = JSON.stringify(out);
    cache.put('nominees', text, 600);
    props.setProperty('nominees', text);
    return out;
  } catch (err) {
    console.error(err);
    return JSON.parse(props.getProperty('nominees') || '{}');
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'results') {
    if (!SHOW_RESULTS) return json({ok: false, error: 'Results will be revealed at the awards'});
    return json(results(p.category));
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

  // Serialize writes so two ballots arriving together can't both pass the duplicate check.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json({ok: false, error: 'Busy — please try again'});
  try {
    return json(recordVote(body));
  } catch (err) {
    console.error(err);
    return json({ok: false, error: 'Something went wrong — please try again'});
  } finally {
    lock.releaseLock();
  }
}

function recordVote(b) {
  setup();
  const ss = SpreadsheetApp.getActive();
  const voter = String(b.voter || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const code = String(b.code || '').trim().toUpperCase().slice(0, 20);
  const category = String(b.category || '');
  const placements = Array.isArray(b.placements) ? b.placements : [];
  const allowed = nominees()[category];
  if (!voter) return {ok: false, error: 'Please enter your name'};
  if (!allowed) return {ok: false, error: 'Invalid ballot'};
  if (!placements.length || placements.length > Object.keys(allowed).length) return {ok: false, error: 'Invalid ballot'};

  // Validate nominees, tiers, caps and duplicates.
  const counts = {};
  const seen = {};
  for (const p of placements) {
    const t = TIERS[p && p.tier];
    if (!t || !Object.prototype.hasOwnProperty.call(allowed, p.nominee) || seen[p.nominee]) return {ok: false, error: 'Invalid ballot'};
    seen[p.nominee] = true;
    counts[p.tier] = (counts[p.tier] || 0) + 1;
    if (t.cap && counts[p.tier] > t.cap) return {ok: false, error: p.tier + ' tier allows only ' + t.cap};
  }

  // Voter codes: if the Codes sheet lists any, a valid unused code is required.
  const codeSheet = ss.getSheetByName(CODES);
  const codeRows = codeSheet.getDataRange().getValues().slice(1);
  if (codeRows.length) {
    const known = codeRows.some(r => String(r[0]).toUpperCase() === code && !r[1]);
    if (!known) return {ok: false, error: 'Unknown voter code'};
    const used = codeRows.some(r => String(r[0]).toUpperCase() === code && r[1] === category);
    if (used) return {ok: false, error: 'This code already voted in this category'};
    codeSheet.appendRow([cell(code), category, cell(voter), new Date()]);
  } else {
    const key = voter.toLowerCase();
    const votes = ss.getSheetByName(VOTES).getDataRange().getValues().slice(1);
    if (votes.some(r => String(r[1]).replace(/^'/, '').toLowerCase() === key && r[3] === category)) {
      return {ok: false, error: 'You already voted in this category'};
    }
  }

  const now = new Date();
  // Store the nominee's display name so the Sheet is readable.
  const rows = placements.map(p => [now, cell(voter), cell(code), category, cell(allowed[p.nominee]), p.tier, TIERS[p.tier].points]);
  const sheet = ss.getSheetByName(VOTES);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return {ok: true};
}

// Stops typed text such as "=IMPORTXML(...)" from being stored as a formula in your Sheet.
function cell(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function results(category) {
  setup();
  const rows = SpreadsheetApp.getActive().getSheetByName(VOTES).getDataRange().getValues().slice(1)
    .filter(r => !category || r[3] === category);
  const out = {};
  const ballots = {};
  for (const r of rows) {
    const nominee = r[4], tier = r[5];
    const s = out[nominee] = out[nominee] || {points: 0, voters: 0, dist: {}};
    s.points += Number(r[6]) || 0;
    s.voters++;
    s.dist[tier] = (s.dist[tier] || 0) + 1;
    ballots[r[1] + '|' + r[3]] = true;
  }
  return {ok: true, ballots: Object.keys(ballots).length, results: out};
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
