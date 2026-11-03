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
- **Connected:** ballots go to your private Google Sheet through Apps Script. Voters see only the ballot: the Results tab, demo badge and "Prototype" label are hidden.

## Connecting Google Sheets

1. Create a new Google Sheet in your account. Don't share it with anyone.
2. Open **Extensions → Apps Script**, replace the contents of `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs), and save.
3. In the function dropdown pick `setup`, click **Run**, and approve the permission prompt. Google warns that the app isn't verified because it's your own script: click **Advanced → Go to (project name)**. This creates the `Votes`, `Results` and `Codes` tabs.
4. Click **Deploy → New deployment**, choose **Web app**, and set:
   - **Execute as:** Me
   - **Who has access:** Anyone (not "Anyone with Google account", which would make voters sign in)
5. Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
6. Paste it into `APPS_SCRIPT_URL` near the top of `awards/index.html` and push to `main`.

After changing `Code.gs` later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

## What's public and what stays private

| | Who can see it |
|---|---|
| The page and its code, including the `/exec` URL | Anyone. The URL isn't a password: it can only submit ballots. |
| The Google Sheet, voter names, every ballot | Only you, as long as you don't share the Sheet. |
| Your Google account and email | Nobody. The web app's responses contain only `ok` and an error message. |
| Point totals | Nobody, until you set `SHOW_RESULTS = true` in `Code.gs` and `SHOW_RESULTS_TAB = true` in `index.html`. |

The script checks every ballot, so a tampered page can't change the scoring or inject data:
- It accepts only known categories, nominees and tiers, and enforces tier caps.
- It calculates points itself.
- Names starting with `=`, `+`, `-` or `@` are stored as plain text, never as formulas.
- It allows one ballot per name per category, or per code if you use codes.

## Your Sheet

`Results` shows a live leaderboard (points and voter count per nominee). `Votes` has one row per voter per nominee:

| Timestamp | Voter | Code | Category | Nominee | Tier | Points |
|---|---|---|---|---|---|---|

`Codes` is optional. By default the page asks for a name only (`USE_VOTER_CODES = false` in `index.html`). To use codes, set `USE_VOTER_CODES = true` and put one code per row in column A, leaving the other columns blank. Each code can then vote once per category.

## Adding categories and nominees

Add entries to `CATEGORIES` in `index.html`, and add the same nominee ids to `NOMINEES` in `Code.gs` (redeploy afterwards):
- Each nominee needs a unique `id`.
- `q` is the search text used to fetch cover art from Jikan (MyAnimeList).

When there's more than one category, category tabs appear automatically.

## Sample nominees

These are popular 2026 anime songs from the Billboard JAPAN Hot Animation mid-year chart and the Anime Corner and Anime!Anime! seasonal fan polls. Treat them as placeholder data. "IRIS OUT" is a movie theme rather than a TV opening.
