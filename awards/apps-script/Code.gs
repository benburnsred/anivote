/**
 * AniVote Awards — Google Sheets backend.
 *
 * Bound to a Google Sheet (Extensions → Apps Script). Deploy as a web app:
 *   Execute as: Me · Who has access: Anyone
 * then paste the /exec URL into APPS_SCRIPT_URL in awards/index.html.
 *
 * Sheets (created automatically on first run of setup()):
 *   Votes — one row per voter per nominee: Timestamp | Voter | Code | Category | Nominee | Tier | Points
 *   Codes — optional voter codes: Code | Category | Used By | Used At
 *           Add codes in column A with the other columns blank; a row is appended each time a code
 *           votes in a category. Leave empty to allow open voting (one ballot per voter name per category).
 */

// Must match TIERS in awards/index.html. Points are always computed here, never trusted from the browser.
const TIERS = {
  S: {points: 5, cap: 1},
  A: {points: 4, cap: 2},
  B: {points: 3, cap: 3},
  C: {points: 2, cap: 0},
  D: {points: 1, cap: 0}
};

// Set to false to hide results from the public page until awards night (you can still read the Votes sheet).
const SHOW_RESULTS = true;

const VOTES = 'Votes';
const CODES = 'Codes';

function setup() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(VOTES)) {
    ss.insertSheet(VOTES).appendRow(['Timestamp', 'Voter', 'Code', 'Category', 'Nominee', 'Tier', 'Points']);
  }
  if (!ss.getSheetByName(CODES)) {
    ss.insertSheet(CODES).appendRow(['Code', 'Category', 'Used By', 'Used At']);
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'results') {
    if (!SHOW_RESULTS) return json({ok: false, error: 'Results are hidden until the awards night'});
    return json(results(p.category));
  }
  return json({ok: true, service: 'anivote-awards'});
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ok: false, error: 'Invalid request'});
  }
  if (body.action !== 'vote') return json({ok: false, error: 'Unknown action'});

  // Serialize writes so two ballots arriving together can't both claim the same code.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json({ok: false, error: 'Busy — please try again'});
  try {
    return json(recordVote(body));
  } finally {
    lock.releaseLock();
  }
}

function recordVote(b) {
  setup();
  const ss = SpreadsheetApp.getActive();
  const voter = String(b.voter || '').trim().slice(0, 40);
  const code = String(b.code || '').trim().toUpperCase();
  const category = String(b.category || '').trim();
  const placements = Array.isArray(b.placements) ? b.placements : [];
  if (!voter || !category) return {ok: false, error: 'Missing name or category'};
  if (!placements.length) return {ok: false, error: 'Empty ballot'};

  // Validate tiers, caps and duplicates.
  const counts = {};
  const seen = {};
  for (const p of placements) {
    const t = TIERS[p.tier];
    if (!t) return {ok: false, error: 'Unknown tier ' + p.tier};
    if (seen[p.nominee]) return {ok: false, error: 'Nominee listed twice'};
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
    codeSheet.appendRow([code, category, voter, new Date()]);
  } else {
    const key = voter.toLowerCase();
    const votes = ss.getSheetByName(VOTES).getDataRange().getValues().slice(1);
    if (votes.some(r => String(r[1]).toLowerCase() === key && r[3] === category)) {
      return {ok: false, error: 'You already voted in this category'};
    }
  }

  const now = new Date();
  const rows = placements.map(p => [now, voter, code, category, String(p.nominee), p.tier, TIERS[p.tier].points]);
  const sheet = ss.getSheetByName(VOTES);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return {ok: true};
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
