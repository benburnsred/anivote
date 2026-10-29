# AniVote Awards — Tier List Ballot

A prototype awards ballot: voters drag nominees into S/A/B/C/D tiers, each tier is worth points, and ballots are saved to Google Sheets.

Live (after merge to `main`): https://benburnsred.github.io/anivote/awards/

## How voting works

- Tap a card then tap a tier, or drag it on desktop. Tap ▶ to hear the song on YouTube.
- Nominees left in the pool score 0, so voters only rank what they know.
- Tier caps force real choices. You set them in `TIERS` in `index.html`:

| Tier | Points | Max per ballot |
|---|---|---|
| S | 5 | 1 |
| A | 4 | 2 |
| B | 3 | 3 |
| C | 2 | — |
| D | 1 | — |

- **Ranking:** nominees are ordered by total points. Ties go to whoever has more S placements, then more A, and so on.
- **After voting:** each voter gets a shareable tier-list image.

## Modes

- **Demo** (default, `APPS_SCRIPT_URL = ''`): ballots are stored in the browser. The Results tab has an **Add 25 demo ballots** button to preview the leaderboard.
- **Live:** ballots are sent to a Google Sheet through Apps Script.

## Connecting Google Sheets

1. Create a Google Sheet, then open **Extensions → Apps Script**.
2. Replace `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs) and save.
3. Run `setup` once from the editor and approve the permissions. This creates the `Votes` and `Codes` tabs.
4. Go to **Deploy → New deployment → Web app**, with *Execute as: Me* and *Who has access: Anyone*. Copy the `/exec` URL.
5. Paste the URL into `APPS_SCRIPT_URL` near the top of `awards/index.html` and push.

### Sheet layout

`Votes` has one row per voter per nominee, so a pivot table (Rows: Nominee, Values: SUM of Points) gives you the leaderboard directly:

| Timestamp | Voter | Code | Category | Nominee | Tier | Points |
|---|---|---|---|---|---|---|

`Codes` is optional. By default the page asks for a name only (`USE_VOTER_CODES = false` in `index.html`) and the script allows one ballot per name per category. To use codes, set `USE_VOTER_CODES = true`:
- Put voter codes in column A, one per row, and leave the other columns blank. Once any codes are listed, every ballot needs a valid code, and each code can vote once per category.
- If you leave `Codes` empty, voting is open, with one ballot per voter name per category.

The script recalculates points and re-checks tier caps on the server, so a modified page can't change the scoring. Set `SHOW_RESULTS = false` in `Code.gs` to hide the public results until awards night.

## Adding categories and nominees

Add entries to `CATEGORIES` in `index.html`:
- Each nominee needs a unique `id`.
- `q` is the search text used to fetch cover art from Jikan (MyAnimeList).

When there's more than one category, category tabs appear automatically.

## Sample nominees

These are popular 2026 anime songs from the Billboard JAPAN Hot Animation mid-year chart and the Anime Corner and Anime!Anime! seasonal fan polls. Treat them as placeholder data. "IRIS OUT" is a movie theme rather than a TV opening.
