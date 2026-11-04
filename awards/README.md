# Anime X Angas Awards

| Page | URL | What it is |
|---|---|---|
| Awards site | https://benburnsred.github.io/anivote/awards/ | Public page: event info, countdown, categories, nominees, winners |
| Ballot | https://benburnsred.github.io/anivote/awards/vote/ | Tier-list voting, saved to a private Google Sheet |

# Awards site (`awards/index.html`)

Everything on the page comes from two tables, so you never edit code to change it:
- `data/nominees.csv`: categories and nominees
- `data/settings.csv`: event details

Either edit those files or point the page at a Google Sheet you manage.

## Nominees table

One row per nominee. Rows with the same `category` are grouped, in sheet order. A row with only a category name (no nominee) shows that category as "Nominees coming soon".

| Column | Required | Example | Notes |
|---|---|---|---|
| `category` | yes | Best Anime Opening | |
| `category_description` | no | The opening that never got skipped. | Only needed on one row per category |
| `category_color` | no | #8aa8ff | Accent colour for that award section. Blank = automatic palette |
| `nominee` | yes* | lulu. | Leave blank for a category with no nominees yet |
| `subtitle` | no | Mrs. GREEN APPLE · Frieren Season 2 | Artist, studio, show… |
| `image` | no | https://…/poster.jpg | Direct image link. Tall (3:4) images look best |
| `image_search` | no | Sousou no Frieren 2nd Season | If `image` is blank, cover art is looked up on AniList (then MyAnimeList) by this anime title. Use `image` to pick an exact picture |
| `link` | no | https://youtube.com/… | Makes the card clickable |
| `winner` | no | TRUE | `TRUE`, `yes` or `x` marks the winner. Shown only when `reveal_winners` is on |
| `result` | no | 412 pts · 31% | Free text under the nominee. Shown only when `show_results` is on |

## Settings table

Two columns, `key` and `value`:

| key | Example | Effect |
|---|---|---|
| `title` | Anime X Angas Awards 2026 | Big heading and browser tab |
| `tagline` | Celebrating the year's best anime | Line under the title |
| `date` | 2026-12-20T19:00:00+08:00 | Date line and countdown. Blank = "Date to be announced". Include the time zone offset |
| `venue` | Online · YouTube | Shown next to the date |
| `stream_url` | https://youtube.com/live/… | Shows a **Watch live** button |
| `vote_url` | vote/ | Where **Vote now** goes |
| `vote_open` | TRUE | Show or hide the **Vote now** buttons |
| `reveal_winners` | FALSE | Turn on at the ceremony. Winners get a gold highlight and move to the front |
| `show_results` | FALSE | Show the `result` text (points, percentages) |
| `trophy_image` | https://…/trophy.png | Trophy picture beside the title on laptops and tablets. Blank = no trophy. A transparent PNG looks best |

For a live ceremony, set `reveal_winners` to TRUE and fill in each `winner` cell as you announce it. As soon as one winner is revealed, a **The Winners** summary appears under the title, with one card per award linking to its full category, and the hero button changes to **See the winners**.

**After the awards:** keep `reveal_winners` TRUE, set `vote_open` to FALSE to hide the vote buttons, and optionally set `show_results` to TRUE with points or percentages in the `result` column. The page then works as a permanent results page. Open pages re-check the sheet every 60 seconds, and Google's published copy can lag by a few minutes.

## Managing it from Google Sheets

1. Create a **new** Google Sheet just for the awards content. Don't use the one that stores votes.
2. Make two tabs, `Nominees` and `Settings`. Import [`data/nominees.csv`](data/nominees.csv) and [`data/settings.csv`](data/settings.csv) as starting templates (**File → Import → Upload → Replace current sheet**).
3. Go to **File → Share → Publish to web**, choose the `Nominees` tab and **Comma-separated values (.csv)**, then click **Publish** and copy the link. Do the same for `Settings`.
4. Paste the two links into `NOMINEES_CSV` and `SETTINGS_CSV` at the top of `awards/index.html` (or send them to me).

Only the two published tabs become public, and only you can edit them. Anything you type there is what visitors see.

# Ballot (`awards/vote/index.html`)

## How voting works

- Tap a card then tap a tier, or drag it on desktop. Tap ▶ to hear the song on YouTube.
- Nominees left in the pool score 0, so voters only rank what they know.
- Tier caps force real choices. You set them in `TIERS` in `vote/index.html`:

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
6. Paste it into `APPS_SCRIPT_URL` near the top of `awards/vote/index.html` and push to `main`.

After changing `Code.gs` later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

## What's public and what stays private

| | Who can see it |
|---|---|
| The page and its code, including the `/exec` URL | Anyone. The URL isn't a password: it can only submit ballots. |
| The Google Sheet, voter names, every ballot | Only you, as long as you don't share the Sheet. |
| Your Google account and email | Nobody. The web app's responses contain only `ok` and an error message. |
| Point totals | Nobody, until you set `SHOW_RESULTS = true` in `Code.gs` and `SHOW_RESULTS_TAB = true` in `vote/index.html`. |

The script checks every ballot, so a tampered page can't change the scoring or inject data:
- It accepts only known categories, nominees and tiers, and enforces tier caps.
- It calculates points itself.
- Names starting with `=`, `+`, `-` or `@` are stored as plain text, never as formulas.
- It allows one ballot per name per category, or per code if you use codes.

## Your Sheet

`Results` shows a live leaderboard (points and voter count per nominee). `Votes` has one row per voter per nominee:

| Timestamp | Voter | Code | Category | Nominee | Tier | Points |
|---|---|---|---|---|---|---|

`Codes` is optional. By default the page asks for a name only (`USE_VOTER_CODES = false` in `vote/index.html`). To use codes, set `USE_VOTER_CODES = true` and put one code per row in column A, leaving the other columns blank. Each code can then vote once per category.

## Adding categories and nominees

Add entries to `CATEGORIES` in `vote/index.html`, and add the same nominee ids to `NOMINEES` in `Code.gs` (redeploy afterwards):
- Each nominee needs a unique `id`.
- `q` is the anime title used to look up cover art (AniList, then MyAnimeList).

When there's more than one category, category tabs appear automatically.

## Sample nominees

These are popular 2026 anime songs from the Billboard JAPAN Hot Animation mid-year chart and the Anime Corner and Anime!Anime! seasonal fan polls. Treat them as placeholder data. "IRIS OUT" is a movie theme rather than a TV opening.
