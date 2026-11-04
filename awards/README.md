# Anime X Angas Awards

| Page | URL | What it is |
|---|---|---|
| Awards 2025 | https://benburnsred.github.io/anivote/awards/2025/ | Permanent page for the 2025 edition: categories, nominees, winners |
| Awards 2026 | https://benburnsred.github.io/anivote/awards/2026/ | Current edition: voting open, winners hidden until the ceremony |
| Latest awards | https://benburnsred.github.io/anivote/awards/ | Forwards to the newest edition (currently 2026) |
| Ballot | https://benburnsred.github.io/anivote/awards/vote/ | Tier-list voting, saved to a private Google Sheet |

# Awards site (`awards/<year>/index.html`)

Each edition lives in its own folder (`awards/2025/`) with its own copy of the page and data, so it stays exactly as it is when the next year's page is built or redesigned. Shared images such as the trophy live in `awards/img/`.

Everything on a year's page comes from two tables in its folder, so you never edit code to change it:
- `data/nominees.csv`: categories and nominees
- `data/settings.csv`: event details

Either edit those files or point the page at a Google Sheet you manage.

## Cover art

Every deploy runs `awards/tools/fetch_covers.py`: for each nominee with an `image_search` title and no `image`, it finds the poster on AniList (then Jikan / MyAnimeList), saves it to `awards/img/covers/`, fills in `image`, and commits the result. Pages load covers from the site itself, so they keep working even when those services are down, and archived years stay complete. The step's summary on the Actions tab lists any titles it couldn't find; give those a different `image_search` (or alternatives separated by ` | `) or paste an image link into `image`.

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
| `image_search` | no | Sousou no Frieren 2nd Season | Anime title to fetch cover art for when `image` is blank. List alternatives with ` \| ` if one name doesn't match. Use `image` to pick an exact picture |
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
| `vote_url` | ../vote/ | Where **Vote now** goes |
| `vote_open` | TRUE | Show or hide the **Vote now** buttons |
| `reveal_winners` | FALSE | Turn on at the ceremony. Winners get a gold highlight and move to the front |
| `show_results` | FALSE | Show the `result` text (points, percentages) |
| `trophy_image` | https://…/trophy.png | Trophy picture beside the title on laptops and tablets. Blank = no trophy. A transparent PNG looks best |

For a live ceremony, set `reveal_winners` to TRUE and fill in each `winner` cell as you announce it. As soon as one winner is revealed, a **The Winners** summary appears under the title, with one card per award linking to its full category, and the hero button changes to **See the winners**.

**After the awards:** keep `reveal_winners` TRUE, set `vote_open` to FALSE to hide the vote buttons, and optionally set `show_results` to TRUE with points or percentages in the `result` column. If the page was reading a Google Sheet, export both tabs as CSV into the year's `data/` folder and point `NOMINEES_CSV` / `SETTINGS_CSV` back at them, so the archive no longer depends on the Sheet.

## Starting next year's edition

1. Copy the latest year's folder (e.g. `awards/2026/`) to the new year (`awards/2027/`).
2. Replace the new folder's `data/nominees.csv` with the new categories (or point it at a new Google Sheet) and update `settings.csv`: new `title`, `date`, `reveal_winners` FALSE, `vote_open` TRUE.
3. In `awards/index.html`, change every year link to the new year so `/awards/` forwards to the new edition.
4. Optionally add a link to the previous year in the new page's footer (2026 links to `../2025/`).

Earlier years keep working unchanged.

## Managing it from Google Sheets

1. Create a **new** Google Sheet just for the awards content. Don't use the one that stores votes.
2. Make two tabs, `Nominees` and `Settings`. Import [`2025/data/nominees.csv`](2025/data/nominees.csv) and [`2025/data/settings.csv`](2025/data/settings.csv) as starting templates (**File → Import → Upload → Replace current sheet**).
3. Go to **File → Share → Publish to web**, choose the `Nominees` tab and **Comma-separated values (.csv)**, then click **Publish** and copy the link. Do the same for `Settings`.
4. Paste the two links into `NOMINEES_CSV` and `SETTINGS_CSV` at the top of that year's `awards/<year>/index.html` (or send them to me).

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

## Categories and nominees

The ballot has no list of its own. It reads the current edition's nominees table (`NOMINEES_CSV`, now `../2026/data/nominees.csv`), so adding nominees on the awards side opens that category for voting:
- Every category appears as a tab. Ones without nominees show "Nominees coming soon".
- A nominee's `link` adds a ▶ button on its card (the 2026 openings link to a YouTube search).
- Category and nominee ids are made from their names, so renaming one after people have voted starts a fresh tally for it.

The Sheets script checks ballots against the same file (`NOMINEES_URL` in `Code.gs`, re-read every 10 minutes), so there's nothing to keep in sync. When you move to a new edition, point both at the new year's file.

The Results tab is hidden (`SHOW_RESULTS_TAB = false`) until it's decided how results are shown at the ceremony.

## Sample nominees

These are popular 2026 anime songs from the Billboard JAPAN Hot Animation mid-year chart and the Anime Corner and Anime!Anime! seasonal fan polls. Treat them as placeholder data. "IRIS OUT" is a movie theme rather than a TV opening.

# Committee page (2026 onwards)

Where the committee argues out what goes on the ballot: `…/exec?page=committee` (same deployment as the admin dashboard).

- **Propose** a category (name, type, voting method), a nominee (for an official or a proposed category), or a different voting method for an official category. Duplicates are refused.
- **Vote** 👍 / 👎 on any open proposal: one vote per member, changeable, and the proposer's 👍 is added automatically. Everyone can see who voted which way.
- **Comment** on proposals to make the case.
- See the **Official ballot** so far, and every **Decided** proposal.

Admins see the proposals ranked by support in the dashboard's **Proposals** tab and **Accept** (added to the official ballot) or **Reject** them. Accepting a proposed category carries its nominee proposals over to it. Who's an admin is set by the `role` column of the `Committee` tab (`admin` or `member`), so the dashboard can be handed to committee chairs by making them admins.

# Admin dashboard (2026 onwards)

A simple admin page for the committee, served by the same Apps Script (`apps-script/Code.gs` + `apps-script/Admin.html`). The committee can:

- **Create categories:** name, description, and type:
  - **Public vote:** appears on the ballot.
  - **Special award / mention:** no voting. The committee ticks the winner.
- **Choose a voting method per category:** tier list (S=5 … D=1), pick one, pick up to N, or rank top N (1st = N points … Nth = 1). Each category can have optional voting open/close times.
- **Add, edit and delete nominees:** with picture, subtitle, anime title for an automatic poster, and a watch/listen link. Categories and nominees that already have votes can't be deleted.
- **Reorder categories.**
- **See live results (committee only):** points, voters and first-place picks. Ties are flagged, and the committee ticks the winner(s).
- **Edit event settings:** title, date, voting open, reveal winners, social links.
- **Publish to site:** copies categories, nominees and winners to the `Site` tab, which the public awards page and ballot read.
- **Activity log:** who changed what.

## Setup (once per edition)

1. Create a new Google Sheet for the edition. Open **Extensions → Apps Script**, then:
   - paste `Code.gs`
   - add two HTML files, named `Admin` and `Committee`, with the contents of `Admin.html` and `Committee.html`
   - run `setup`
2. In the `Committee` tab, list each member's Google email, name and role (`admin` or `member`). Share the Sheet with them as **Editor**.
3. Make two deployments: **Deploy → New deployment → Web app**, once with each of these settings:
   - **Public:** Execute as *Me*, access *Anyone*. Paste this URL into `APPS_SCRIPT_URL` in `vote/index.html`.
   - **Committee:** Execute as *User accessing the web app*, access *Anyone with Google account*. Committee page: this URL + `?page=committee`; admin dashboard: this URL + `?page=admin`.
4. Publish the data to the site: **File → Share → Publish to web**, once for the `Site` tab and once for the `Settings` tab, choosing CSV each time. Put the two links in:
   - `NOMINEES_CSV` / `SETTINGS_CSV` at the top of `2026/index.html`
   - the same two variables in `vote/index.html`

After that, everything is done from the dashboard. Google's published CSV can take a few minutes to refresh after **Publish to site**.

## Locking

**Publish to site** locks every public-vote category that has nominees, so every voter sees the same ballot:
- While locked, nominees can't be added, edited or deleted, and the type and voting method can't change. The name, description and voting window can still be edited.
- **Unlock** is on the category, and every lock and unlock is in the activity log.

Only the committee decides categories and nominees; voters can only vote.

## Votes datasource

Votes can live in a separate Google Sheet, for example an existing one:
- Set **Votes spreadsheet ID** and **Votes tab name** in Settings.
- Map each field to that tab's column header in the `VotesMapping` tab:

| field | meaning | if the column is missing |
|---|---|---|
| timestamp | when the vote was cast | left blank |
| voter | voter name (one ballot per name per category) | — required |
| code | voter code | ignored |
| category | category id **or name** | — required |
| nominee | nominee id **or name** | — required |
| value | tier letter, rank number, or "pick" | — |
| points | points for this row | tier letters score their tier points, anything else 1 |

The Settings tab shows which fields are still unmapped. New ballots are written with readable names into a re-mapped sheet, and with ids into the built-in layout. Committee members need view access to the votes sheet to see results. An Excel file has to be converted first (open it in Google Drive → **File → Save as Google Sheets**). For a sheet that's shaped differently, such as one row per ballot like Google Forms, send it over and an adapter can be added.

## Moving to its own repository

Everything here is self-contained: pages link to each other with relative paths, and nothing refers to the repo name. To give the awards their own repo (e.g. `awards`, owned by animexangas), split out only this folder with its history: `git subtree split --prefix=awards -b awards-only`. Push that branch as `main` of the new repo, and copy `.github/workflows/pages.yml` there with every `awards/` path prefix removed. The AniVote polls page (repo root `index.html`) stays behind.

## Hosting

- **Now (testing and development):** the Google Sheet and Apps Script run on the repo owner's personal Google account.
- **Production:** everything moves to **animexangas@gmail.com**: the Sheet, the Apps Script deployments and, later, this repository (as its own `awards` repo).

To move the Sheet:
1. Transfer ownership of the Sheet (Share → *Transfer ownership*), or make a fresh copy under animexangas.
2. Signed in as animexangas, create both web app deployments again. Deployments run as the account that made them, so the URLs change.
3. Update `APPS_SCRIPT_URL` and the published CSV links in `vote/index.html` and the edition's `index.html`.
4. Clear test data (`Votes`, `Proposals`, `ProposalVotes`, `Comments`, `Log`) before launch.
